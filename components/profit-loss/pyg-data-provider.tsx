"use client";

import { useLiveQuery } from "dexie-react-hooks";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  db,
  getWorkspaceMeta,
  replaceWorkspace,
  saveActiveCenter,
  saveCellEdit,
} from "@/lib/profit-loss/db";
import {
  allowedFrequencies,
  applyEditsToLeafAccounts,
  FREQUENCY_ORDER,
  mergeCenters,
} from "@/lib/profit-loss/derive";
import {
  accountOptions,
  collapsedForLevel,
  deepestLevel,
  type AccountOption,
} from "@/lib/profit-loss/filter";
import type { CellEdit, Frequency, PygDataset } from "@/lib/profit-loss/types";
import type { BuiltWorkspace } from "@/lib/profit-loss/workspace";
import { PygAnalyticsProvider } from "./pyg-analytics-provider";

const EMPTY_EDITS: CellEdit[] = [];
const EMPTY_DATASETS: PygDataset[] = [];
const CONSOLIDADO_ID = "consolidado";
const CONSOLIDADO_COLOR = "#334155";

/** One entry in the "Centro de costos" selector: Consolidado, a center, or Sin-centro. */
export interface CenterView {
  id: string;
  name: string;
  color?: string;
  role: "consolidado" | "center" | "sin-centro" | "single";
  dataset: PygDataset;
  editable: boolean;
}

interface PygDataValue {
  dataset: PygDataset | undefined;
  edits: CellEdit[];
  frequency: Frequency;
  allowed: Frequency[];
  setFrequency: (frequency: Frequency) => void;
  /** "single" = a lone statement (no cost-center tabs); "multi" = a workspace of centers. */
  mode: "single" | "multi";
  /** Selector entries (Consolidado + centers + Sin-centro); empty in single mode. */
  views: CenterView[];
  activeCenterId: string;
  setActiveCenter: (id: string) => void;
  commitWorkspace: (built: BuiltWorkspace) => Promise<void>;
  /** Workspace-level cuadre warnings (from meta). */
  warnings: string[];
  saveEdit: (
    code: string,
    monthIndex: number,
    value: number | null | undefined,
    comment: string,
  ) => Promise<void>;
  /** Depth of the deepest movement account across ALL files in the workspace; 0 with no
   * dataset. Bounds the "Nivel" filter options. */
  deepestLevel: number;
  /** Accounts of the active view as "Cuenta contable" options; [] with no dataset. */
  accountOptions: AccountOption[];
  /** "Cuenta contable" focus selection (empty = no filter). */
  selectedAccounts: Set<string>;
  toggleAccount: (code: string) => void;
  clearAccounts: () => void;
  /** Datos tree collapse state; shared so the "Nivel" filter and per-row toggles agree. */
  collapsed: Set<string>;
  toggleCollapsed: (code: string) => void;
  setExpandLevel: (level: number | "all") => void;
}

const PygDataContext = createContext<PygDataValue | null>(null);

/**
 * Shared PyG data state: the active Dexie workspace (one or more datasets) + edits (live
 * queries), the selected view frequency, the active cost-center view, and the upload pipeline.
 * Mounted in the dashboard layout because the header (ActiveClient) and the module content
 * consume it from different branches.
 */
export function PygDataProvider({ children }: { children: ReactNode }) {
  // toArray() (NOT orderBy("order")): IndexedDB indexes exclude rows whose key is undefined,
  // so `order`-less single/migrated datasets would vanish from an orderBy. buildViews sorts
  // centers by `order` itself.
  const datasets = useLiveQuery(() => db.datasets.toArray(), []) ?? EMPTY_DATASETS;
  const allEdits = useLiveQuery(() => db.edits.toArray(), []) ?? EMPTY_EDITS;
  const metaRow = useLiveQuery(() => getWorkspaceMeta(), []);

  // buildViews needs every center's edits so the computed Consolidado reflects them.
  const views = useMemo<CenterView[]>(() => buildViews(datasets, allEdits), [datasets, allEdits]);
  const mode: "single" | "multi" =
    views.length <= 1 && views[0]?.role === "single" ? "single" : "multi";

  const [frequency, setFrequencyState] = useState<Frequency>("mensual");
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(() => new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [activeCenterId, setActiveCenterId] = useState<string>(CONSOLIDADO_ID);

  // Resolve the active view: the current id, else the persisted one, else the first view.
  const resolvedActiveId =
    views.find((v) => v.id === activeCenterId)?.id ??
    (metaRow?.activeCenterId && views.some((v) => v.id === metaRow.activeCenterId)
      ? metaRow.activeCenterId
      : (views[0]?.id ?? CONSOLIDADO_ID));
  const activeView = views.find((v) => v.id === resolvedActiveId) ?? views[0];
  const dataset = activeView?.dataset;

  // Edits of the active view's dataset — for display (comments) and, on editable centers, values.
  // The synthetic Consolidado (id "consolidado") has no stored edits: they are already merged
  // into its accounts by buildViews.
  const datasetId = dataset?.id;
  const edits = useMemo(
    () => (datasetId ? allEdits.filter((e) => e.datasetId === datasetId) : EMPTY_EDITS),
    [allEdits, datasetId],
  );

  const base = dataset?.baseFrequency;
  const accounts = dataset?.accounts;
  const allowed = useMemo(() => (base ? allowedFrequencies(base) : [...FREQUENCY_ORDER]), [base]);

  // A NEW workspace (its set of dataset ids changed) resets to the base frequency and clears
  // the account/level filters and tree collapse state.
  const workspaceKey = datasets.map((d) => d.id).join("|");
  useEffect(() => {
    if (base) {
      setFrequencyState(base);
    }
  }, [workspaceKey, base]);
  useEffect(() => {
    setSelectedAccounts(new Set());
    setCollapsed(new Set());
  }, [workspaceKey]);

  // Switching to a coarser view (e.g. Sin-centro = anual) clamps the frequency into range.
  useEffect(() => {
    setFrequencyState((prev) => (allowed.includes(prev) ? prev : (base ?? prev)));
  }, [resolvedActiveId, allowed, base]);

  // The deepest movement account across ALL files in the workspace (not just the active
  // view) — so the Nivel options are stable across center tabs and reflect the deepest Excel.
  const deepest = useMemo(
    () => datasets.reduce((max, d) => Math.max(max, deepestLevel(d.accounts)), 0),
    [datasets],
  );
  const options = useMemo(() => (accounts ? accountOptions(accounts) : []), [accounts]);

  const setFrequency = useCallback(
    (next: Frequency) => {
      if (allowed.includes(next)) {
        setFrequencyState(next);
      }
    },
    [allowed],
  );

  const toggleAccount = useCallback((code: string) => {
    setSelectedAccounts((current) => {
      const next = new Set(current);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }, []);

  const clearAccounts = useCallback(() => setSelectedAccounts(new Set()), []);

  const toggleCollapsed = useCallback((code: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }, []);

  const setExpandLevel = useCallback(
    (level: number | "all") => {
      setCollapsed(level === "all" ? new Set() : collapsedForLevel(accounts ?? [], level));
    },
    [accounts],
  );

  const setActiveCenter = useCallback((id: string) => {
    setActiveCenterId(id);
    void saveActiveCenter(id);
  }, []);

  const commitWorkspace = useCallback(async (built: BuiltWorkspace) => {
    await replaceWorkspace(built.datasets, built.meta, built.commentsByDataset);
    setActiveCenterId(built.meta.activeCenterId);
  }, []);

  const saveEdit = useCallback(
    async (code: string, monthIndex: number, value: number | null | undefined, comment: string) => {
      if (!dataset?.id || !activeView?.editable) {
        return;
      }
      await saveCellEdit({
        datasetId: dataset.id,
        code,
        monthIndex,
        ...(value !== undefined ? { value } : {}),
        ...(comment ? { comment } : {}),
      });
    },
    [dataset?.id, activeView?.editable],
  );

  const value = useMemo<PygDataValue>(
    () => ({
      dataset,
      edits,
      frequency,
      allowed,
      setFrequency,
      mode,
      views,
      activeCenterId: resolvedActiveId,
      setActiveCenter,
      commitWorkspace,
      warnings: metaRow?.warnings ?? [],
      saveEdit,
      deepestLevel: deepest,
      accountOptions: options,
      selectedAccounts,
      toggleAccount,
      clearAccounts,
      collapsed,
      toggleCollapsed,
      setExpandLevel,
    }),
    [
      dataset,
      edits,
      frequency,
      allowed,
      setFrequency,
      mode,
      views,
      resolvedActiveId,
      setActiveCenter,
      commitWorkspace,
      metaRow?.warnings,
      saveEdit,
      deepest,
      options,
      selectedAccounts,
      toggleAccount,
      clearAccounts,
      collapsed,
      toggleCollapsed,
      setExpandLevel,
    ],
  );

  // The analytics selection lives in its own file but inside this tree, so the layout keeps a
  // single mount point and `CompareBar` and the content panel still read one state.
  return (
    <PygDataContext.Provider value={value}>
      <PygAnalyticsProvider allEdits={allEdits}>{children}</PygAnalyticsProvider>
    </PygDataContext.Provider>
  );
}

export function usePygData(): PygDataValue {
  const context = useContext(PygDataContext);
  if (!context) {
    throw new Error("usePygData debe usarse dentro de <PygDataProvider>.");
  }
  return context;
}

/**
 * Builds the selector views: single mode → the lone dataset; multi mode → Consolidado (a
 * computed sum of the monthly centers) + each center + Sin-centro. The Consolidado dataset is
 * synthetic (never persisted): its accounts are the column-wise sum of the centers.
 */
function buildViews(datasets: PygDataset[], allEdits: CellEdit[]): CenterView[] {
  if (datasets.length === 0) {
    return [];
  }
  const single = datasets.find((d) => d.role === "single");
  if (single && datasets.length === 1) {
    return [
      {
        id: single.id,
        name: single.companyName,
        role: "single",
        dataset: single,
        editable: single.baseFrequency !== "anual",
      },
    ];
  }

  const centers = datasets
    .filter((d) => d.role === "center")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const sin = datasets.find((d) => d.role === "sin-centro");
  const views: CenterView[] = [];

  if (centers.length > 0) {
    const merged = mergeCenters(
      centers.map((c) =>
        applyEditsToLeafAccounts(
          c.accounts,
          allEdits.filter((e) => e.datasetId === c.id),
        ),
      ),
    );
    const base = centers[0];
    const consolidated: PygDataset = {
      ...base,
      id: CONSOLIDADO_ID,
      role: "center",
      centerId: CONSOLIDADO_ID,
      costCenterName: undefined,
      accounts: merged.accounts,
      resultFromFile: [],
      warnings: [],
    };
    views.push({
      id: CONSOLIDADO_ID,
      name: "Consolidado",
      color: CONSOLIDADO_COLOR,
      role: "consolidado",
      dataset: consolidated,
      editable: false,
    });
  }

  for (const center of centers) {
    views.push({
      id: center.centerId as string,
      name: center.costCenterName || (center.centerId as string),
      color: center.centerColor,
      role: "center",
      dataset: center,
      editable: center.baseFrequency !== "anual",
    });
  }

  if (sin) {
    views.push({
      id: "sin-centro",
      name: "Sin centro de costo",
      color: sin.centerColor,
      role: "sin-centro",
      dataset: sin,
      editable: false,
    });
  }
  return views;
}
