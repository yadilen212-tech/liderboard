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
import { db, replaceDataset, saveCellEdit } from "@/lib/profit-loss/db";
import { allowedFrequencies, FREQUENCY_ORDER } from "@/lib/profit-loss/derive";
import { PygParseError } from "@/lib/profit-loss/errors";
import {
  accountOptions,
  collapsedForLevel,
  deepestLevel,
  type AccountOption,
} from "@/lib/profit-loss/filter";
import type { CellEdit, Frequency, PygDataset } from "@/lib/profit-loss/types";

const EMPTY_EDITS: CellEdit[] = [];

interface PygDataValue {
  dataset: PygDataset | undefined;
  edits: CellEdit[];
  frequency: Frequency;
  allowed: Frequency[];
  setFrequency: (frequency: Frequency) => void;
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
  /** Accounts of the loaded file as "Cuenta contable" options; [] with no dataset. */
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
 * Shared PyG data state: the active Dexie dataset + edits (live queries), the selected
 * view frequency, and the upload pipeline. Mounted in the dashboard layout because the
 * header (ActiveClient) and the module content consume it from different branches.
 */
export function PygDataProvider({ children }: { children: ReactNode }) {
  const dataset = useLiveQuery(() => db.datasets.toCollection().first(), []);
  const edits =
    useLiveQuery(
      () =>
        dataset
          ? db.edits.where("datasetId").equals(dataset.id).toArray()
          : Promise.resolve(EMPTY_EDITS),
      [dataset?.id],
    ) ?? EMPTY_EDITS;

  const [frequency, setFrequencyState] = useState<Frequency>("mensual");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(() => new Set());
  const [maxLevel, setMaxLevelState] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const base = dataset?.baseFrequency;
  const datasetId = dataset?.id;
  const accounts = dataset?.accounts;
  // A new file resets the view to the file's own frequency.
  useEffect(() => {
    if (base) {
      setFrequencyState(base);
    }
  }, [datasetId, base]);

  // A new file also clears the account/level filters and the tree collapse state.
  useEffect(() => {
    setSelectedAccounts(new Set());
    setMaxLevelState(null);
    setCollapsed(new Set());
  }, [datasetId]);

  const allowed = useMemo(() => (base ? allowedFrequencies(base) : [...FREQUENCY_ORDER]), [base]);

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
      if (!datasetId) {
        return;
      }
      await saveCellEdit({
        datasetId,
        code,
        monthIndex,
        ...(value !== undefined ? { value } : {}),
        ...(comment ? { comment } : {}),
      });
    },
    [datasetId],
  );

  const value = useMemo<PygDataValue>(
    () => ({
      dataset,
      edits,
      frequency,
      allowed,
      setFrequency,
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
