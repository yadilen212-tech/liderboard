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
  replaceDataset,
  replaceWorkspace,
  saveActiveCenter,
  saveCellEdit,
} from "@/lib/profit-loss/db";
import { allowedFrequencies, FREQUENCY_ORDER, mergeCenters } from "@/lib/profit-loss/derive";
import { PygParseError } from "@/lib/profit-loss/errors";
import {
  accountOptions,
  collapsedForLevel,
  deepestLevel,
  type AccountOption,
} from "@/lib/profit-loss/filter";
import type { CellEdit, Frequency, PygDataset } from "@/lib/profit-loss/types";
import type { BuiltWorkspace } from "@/lib/profit-loss/workspace";

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
  uploadFile: (file: File) => Promise<void>;
  isUploading: boolean;
  uploadError: string | null;
  clearUploadError: () => void;
  saveEdit: (
    code: string,
    monthIndex: number,
    value: number | null | undefined,
    comment: string,
  ) => Promise<void>;
  /** Depth of the deepest movement account; 0 with no dataset. Bounds Nivel/Expandir. */
  deepestLevel: number;
  /** Accounts of the active view as "Cuenta contable" options; [] with no dataset. */
  accountOptions: AccountOption[];
  /** "Cuenta contable" focus selection (empty = no filter). */
  selectedAccounts: Set<string>;
  toggleAccount: (code: string) => void;
  clearAccounts: () => void;
  /** "Mostrar hasta nivel" depth cap; null = all levels. */
  maxLevel: number | null;
  setMaxLevel: (level: number | null) => void;
  /** Datos tree collapse state; shared so Expandir and per-row toggles agree. */
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
  const datasets = useLiveQuery(() => db.datasets.orderBy("order").toArray(), []) ?? EMPTY_DATASETS;
  const metaRow = useLiveQuery(() => getWorkspaceMeta(), []);

  const views = useMemo<CenterView[]>(() => buildViews(datasets), [datasets]);
  const mode: "single" | "multi" =
    views.length <= 1 && views[0]?.role === "single" ? "single" : "multi";

  const [frequency, setFrequencyState] = useState<Frequency>("mensual");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(() => new Set());
  const [maxLevel, setMaxLevelState] = useState<number | null>(null);
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

  const edits =
    useLiveQuery(
      () =>
        dataset && activeView?.editable
          ? db.edits.where("datasetId").equals(dataset.id).toArray()
          : Promise.resolve(EMPTY_EDITS),
      [dataset?.id, activeView?.editable],
    ) ?? EMPTY_EDITS;

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
    setMaxLevelState(null);
    setCollapsed(new Set());
  }, [workspaceKey]);

  // Switching to a coarser view (e.g. Sin-centro = anual) clamps the frequency into range.
  useEffect(() => {
    setFrequencyState((prev) => (allowed.includes(prev) ? prev : (base ?? prev)));
  }, [resolvedActiveId, allowed, base]);

  const deepest = useMemo(() => (accounts ? deepestLevel(accounts) : 0), [accounts]);
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

  const setMaxLevel = useCallback((level: number | null) => setMaxLevelState(level), []);

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

  const uploadFile = useCallback(async (file: File) => {
    setUploadError(null);
    setIsUploading(true);
    try {
      // Dynamic import keeps SheetJS out of the initial bundle.
      const { parsePygFile } = await import("@/lib/profit-loss/parse");
      const { dataset, comments } = await parsePygFile(file);
      const editCount = await db.edits.count();
      if (
        editCount > 0 &&
        !window.confirm(
          "Reemplazar los datos actuales descartará las ediciones y comentarios existentes. ¿Continuar?",
        )
      ) {
        return;
      }
      // Comments stashed by a previous export are restored; value edits fold into the base.
      await replaceDataset(dataset, comments);
    } catch (error) {
      setUploadError(
        error instanceof PygParseError
          ? error.message
          : "No se pudo leer el archivo. Verifica que sea un Excel (.xls o .xlsx) válido.",
      );
    } finally {
      setIsUploading(false);
    }
  }, []);

  const clearUploadError = useCallback(() => setUploadError(null), []);

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
      uploadFile,
      isUploading,
      uploadError,
      clearUploadError,
      saveEdit,
      deepestLevel: deepest,
      accountOptions: options,
      selectedAccounts,
      toggleAccount,
      clearAccounts,
      maxLevel,
      setMaxLevel,
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
      uploadFile,
      isUploading,
      uploadError,
      clearUploadError,
      saveEdit,
      deepest,
      options,
      selectedAccounts,
      toggleAccount,
      clearAccounts,
      maxLevel,
      setMaxLevel,
      collapsed,
      toggleCollapsed,
      setExpandLevel,
    ],
  );

  return <PygDataContext.Provider value={value}>{children}</PygDataContext.Provider>;
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
function buildViews(datasets: PygDataset[]): CenterView[] {
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
    const merged = mergeCenters(centers.map((c) => c.accounts));
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
