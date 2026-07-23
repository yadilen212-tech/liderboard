/**
 * IndexedDB persistence via Dexie. Original datasets and user edits live in SEPARATE
 * tables so the original stays intact — the future original-vs-edited comparison
 * reads both sides as-is. One dataset at a time: uploading replaces everything.
 */
import Dexie, { type Table } from "dexie";
import type { CellEdit, ImportedComment, PygDataset } from "./types";
import type { WorkspaceMeta } from "./workspace";

/** Singleton workspace metadata row (company, warnings, active selector id). */
interface WorkspaceMetaRow extends WorkspaceMeta {
  key: "workspace";
}

class PygDb extends Dexie {
  datasets!: Table<PygDataset, string>;
  edits!: Table<CellEdit, number>;
  meta!: Table<WorkspaceMetaRow, string>;

  constructor() {
    super("liderboard-pyg");
    this.version(1).stores({
      datasets: "id",
      edits: "++id, datasetId, &[datasetId+code+monthIndex]",
    });
    // v2: datasets may hold several rows (a workspace); add the meta singleton.
    // Existing v1 datasets are stamped role:"single" so they keep working.
    this.version(2)
      .stores({
        datasets: "id, role, order",
        edits: "++id, datasetId, &[datasetId+code+monthIndex]",
        meta: "key",
      })
      .upgrade(async (tx) => {
        await tx
          .table<PygDataset>("datasets")
          .toCollection()
          .modify((d) => {
            if (!d.role) {
              d.role = "single";
            }
          });
      });
  }
}

export const db = new PygDb();

/**
 * Atomically replaces the whole workspace: clears datasets/edits/meta, inserts the new
 * datasets, writes the meta singleton, and re-seeds imported comments as comment-only edits
 * per dataset (value edits are already baked into each dataset's values).
 */
export async function replaceWorkspace(
  datasets: PygDataset[],
  meta: WorkspaceMeta,
  commentsByDataset: { datasetId: string; comments: ImportedComment[] }[] = [],
): Promise<void> {
  await db.transaction("rw", db.datasets, db.edits, db.meta, async () => {
    await db.edits.clear();
    await db.datasets.clear();
    await db.meta.clear();
    await db.datasets.bulkAdd(datasets);
    await db.meta.add({ key: "workspace", ...meta });
    const now = Date.now();
    const seeds = commentsByDataset.flatMap(({ datasetId, comments }) =>
      comments.map((c) => ({
        datasetId,
        code: c.code,
        monthIndex: c.monthIndex,
        comment: c.comment,
        updatedAt: now,
      })),
    );
    if (seeds.length > 0) {
      await db.edits.bulkAdd(seeds);
    }
  });
}

export async function getWorkspaceMeta(): Promise<WorkspaceMeta | undefined> {
  const row = await db.meta.get("workspace");
  if (!row) {
    return undefined;
  }
  const { key: _key, ...meta } = row;
  return meta;
}

export async function saveActiveCenter(activeCenterId: string): Promise<void> {
  const row = await db.meta.get("workspace");
  if (row) {
    await db.meta.put({ ...row, activeCenterId });
  }
}

/** Back-compat single-statement helper: one dataset, single mode. */
export async function replaceDataset(
  dataset: PygDataset,
  comments: ImportedComment[] = [],
): Promise<void> {
  await replaceWorkspace(
    [{ ...dataset, role: "single" }],
    { companyName: dataset.companyName, warnings: dataset.warnings, activeCenterId: dataset.id },
    [{ datasetId: dataset.id, comments }],
  );
}

/**
 * Upserts one cell's override. An edit with no value and no comment means "back to
 * original" — the record is deleted, keeping the edits table a true diff.
 *
 * The lookup + write run in one explicit transaction so concurrent saves to the same
 * cell serialize instead of both inserting and colliding on the unique
 * &[datasetId+code+monthIndex] index (which two writes did in the browser).
 */
export async function saveCellEdit(edit: Omit<CellEdit, "id" | "updatedAt">): Promise<void> {
  const key: [string, string, number] = [edit.datasetId, edit.code, edit.monthIndex];
  await db.transaction("rw", db.edits, async () => {
    const existing = await db.edits.where("[datasetId+code+monthIndex]").equals(key).first();

    const isEmpty = edit.value === undefined && !edit.comment;
    if (isEmpty) {
      if (existing?.id !== undefined) {
        await db.edits.delete(existing.id);
      }
      return;
    }
    await db.edits.put({
      ...(existing?.id !== undefined ? { id: existing.id } : {}),
      ...edit,
      updatedAt: Date.now(),
    });
  });
}
