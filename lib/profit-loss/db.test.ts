import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, getWorkspaceMeta, replaceDataset, replaceWorkspace, saveCellEdit } from "./db";
import type { PygDataset } from "./types";

function dataset(id: string): PygDataset {
  return {
    id,
    fileName: "reporte.xlsx",
    uploadedAt: 0,
    companyName: "HOTELERA ANDES S.A.",
    periodLabel: "Ene–Dic 2026",
    year: 2026,
    baseFrequency: "mensual",
    role: "single",
    accounts: [{ code: "4", name: "Ingresos", values: [1] }],
    resultFromFile: [1],
    warnings: [],
  };
}

function center(id: string, centerId: string): PygDataset {
  return { ...dataset(id), role: "center", centerId, order: 0, centerColor: "#000" };
}

beforeEach(async () => {
  await db.edits.clear();
  await db.datasets.clear();
  await db.meta.clear();
});

describe("replaceDataset", () => {
  it("replaces the previous dataset and wipes its edits atomically", async () => {
    await replaceDataset(dataset("a"));
    await saveCellEdit({ datasetId: "a", code: "4", monthIndex: 0, value: 9 });
    await replaceDataset(dataset("b"));
    expect(await db.datasets.toArray()).toHaveLength(1);
    expect((await db.datasets.toArray())[0].id).toBe("b");
    expect(await db.edits.count()).toBe(0);
  });

  it("seeds imported comments as comment-only edits on the new dataset", async () => {
    await replaceDataset(dataset("a"), [{ code: "4", monthIndex: 0, comment: "Nota importada" }]);
    const stored = await db.edits.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      datasetId: "a",
      code: "4",
      monthIndex: 0,
      comment: "Nota importada",
    });
    expect(stored[0].value).toBeUndefined();
    expect(stored[0].updatedAt).toBeGreaterThan(0);
  });
});

describe("saveCellEdit", () => {
  it("upserts on the same cell instead of duplicating", async () => {
    await replaceDataset(dataset("a"));
    await saveCellEdit({ datasetId: "a", code: "4.1.1", monthIndex: 0, value: 10 });
    await saveCellEdit({ datasetId: "a", code: "4.1.1", monthIndex: 0, value: 20, comment: "ok" });
    const stored = await db.edits.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0].value).toBe(20);
    expect(stored[0].comment).toBe("ok");
    expect(stored[0].updatedAt).toBeGreaterThan(0);
  });

  it("deletes the record when value and comment are both empty", async () => {
    await replaceDataset(dataset("a"));
    await saveCellEdit({ datasetId: "a", code: "4.1.1", monthIndex: 0, value: 10, comment: "x" });
    await saveCellEdit({ datasetId: "a", code: "4.1.1", monthIndex: 0 });
    expect(await db.edits.count()).toBe(0);
  });

  it("keeps a null value edit (an explicit clear) as a stored edit", async () => {
    await replaceDataset(dataset("a"));
    await saveCellEdit({ datasetId: "a", code: "4.1.1", monthIndex: 0, value: null });
    const stored = await db.edits.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0].value).toBeNull();
  });

  it("serializes concurrent saves on the same cell without colliding on the unique index", async () => {
    await replaceDataset(dataset("a"));
    // Fire two writes for the SAME cell concurrently — as React StrictMode's double-invoked
    // state updater did in the browser. Without atomic read-modify-write, both read "no
    // existing row" and both insert, so the second violates &[datasetId+code+monthIndex].
    await Promise.all([
      saveCellEdit({ datasetId: "a", code: "4.1.1", monthIndex: 0, value: 10 }),
      saveCellEdit({ datasetId: "a", code: "4.1.1", monthIndex: 0, value: 20 }),
    ]);
    const stored = await db.edits.toArray();
    expect(stored).toHaveLength(1);
  });
});

describe("replaceWorkspace", () => {
  it("stores several datasets + meta and clears the previous workspace", async () => {
    await replaceWorkspace(
      [center("a", "norte"), center("b", "sur")],
      { companyName: "ACME", warnings: ["w"], activeCenterId: "consolidado" },
      [
        { datasetId: "a", comments: [{ code: "4", monthIndex: 0, comment: "hola" }] },
        { datasetId: "b", comments: [] },
      ],
    );
    expect(await db.datasets.count()).toBe(2);
    const meta = await getWorkspaceMeta();
    expect(meta?.companyName).toBe("ACME");
    expect(meta?.activeCenterId).toBe("consolidado");
    const seeded = await db.edits.where("datasetId").equals("a").toArray();
    expect(seeded).toHaveLength(1);
    expect(seeded[0].comment).toBe("hola");
  });

  it("wipes datasets, edits and meta of the prior workspace", async () => {
    await replaceWorkspace(
      [center("a", "norte")],
      { companyName: "ACME", warnings: [], activeCenterId: "consolidado" },
      [{ datasetId: "a", comments: [] }],
    );
    await saveCellEdit({ datasetId: "a", code: "4", monthIndex: 0, value: 1 });
    await replaceWorkspace(
      [center("z", "z")],
      { companyName: "OTHER", warnings: [], activeCenterId: "consolidado" },
      [{ datasetId: "z", comments: [] }],
    );
    expect((await db.datasets.toArray()).map((d) => d.id)).toEqual(["z"]);
    expect(await db.edits.count()).toBe(0);
    expect((await getWorkspaceMeta())?.companyName).toBe("OTHER");
  });
});
