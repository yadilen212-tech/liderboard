/**
 * IndexedDB persistence via Dexie. Original datasets and user edits live in SEPARATE
 * tables so the original stays intact — the future original-vs-edited comparison
 * reads both sides as-is. One dataset at a time: uploading replaces everything.
 */
import Dexie, { type Table } from "dexie";
import type { CellEdit, PygDataset } from "./types";

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

/** Atomically replaces the active dataset and clears every edit. */
export async function replaceDataset(dataset: PygDataset): Promise<void> {
  await db.transaction("rw", db.datasets, db.edits, async () => {
    await db.edits.clear();
    await db.datasets.clear();
    await db.datasets.add(dataset);
  });
}

/**
 * Upserts one cell's override. An edit with no value and no comment means "back to
 * original" — the record is deleted, keeping the edits table a true diff.
 */
export async function saveCellEdit(edit: Omit<CellEdit, "id" | "updatedAt">): Promise<void> {
  const key = [edit.datasetId, edit.code, edit.monthIndex] as const;
  const existing = await db.edits
    .where("[datasetId+code+monthIndex]")
    .equals(key as unknown as [string, string, number])
    .first();

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
}
