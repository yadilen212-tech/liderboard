/**
 * IndexedDB persistence via Dexie. Original datasets and user edits live in SEPARATE
 * tables so the original stays intact — the future original-vs-edited comparison
 * reads both sides as-is. One dataset at a time: uploading replaces everything.
 */
import Dexie, { type Table } from "dexie";
import type { CellEdit, ImportedComment, PygDataset } from "./types";

class PygDb extends Dexie {
  datasets!: Table<PygDataset, string>;
  edits!: Table<CellEdit, number>;

  constructor() {
    super("liderboard-pyg");
    this.version(1).stores({
      datasets: "id",
      edits: "++id, datasetId, &[datasetId+code+monthIndex]",
    });
  }
}

export const db = new PygDb();

/**
 * Atomically replaces the active dataset and clears every edit. Comments recovered from
 * an app-exported file's metadata sheet are re-seeded as comment-only edits on the new
 * dataset (value edits are already baked into its values, so they are not restored).
 */
export async function replaceDataset(
  dataset: PygDataset,
  comments: ImportedComment[] = [],
): Promise<void> {
  await db.transaction("rw", db.datasets, db.edits, async () => {
    await db.edits.clear();
    await db.datasets.clear();
    await db.datasets.add(dataset);
    if (comments.length > 0) {
      const now = Date.now();
      await db.edits.bulkAdd(
        comments.map((comment) => ({
          datasetId: dataset.id,
          code: comment.code,
          monthIndex: comment.monthIndex,
          comment: comment.comment,
          updatedAt: now,
        })),
      );
    }
  });
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
