"use client";

import {
  ChevronDown,
  EyeOff,
  FilePlus2,
  FileSpreadsheet,
  Info,
  Loader2,
  Upload,
} from "lucide-react";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/cn";
import { usePygData } from "./pyg-data-provider";

type Group = "todos" | "ingresos" | "costos";
type Level = "1" | "2" | "3" | "4" | "todo";

const GROUPS: { value: Group; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "ingresos", label: "Ingresos" },
  { value: "costos", label: "Costos" },
];

const LEVELS = ["1", "2", "3", "4"] as const;

/**
 * Datos-tab action bar (visual only), rendered under the FILTROS row for
 * Pérdidas y Ganancias › Datos. Left: the "cuentas mayores" filters — account
 * group, hide-zeros, and expand-to-level. Right: the Excel actions — upload,
 * a download menu, and an accepted-files info tip. Filter state is UI-local;
 * the upload button drives the real pipeline via usePygData().
 */
export function DatosToolbar() {
  const [group, setGroup] = useState<Group>("todos");
  const [hideZeros, setHideZeros] = useState(false);
  const [level, setLevel] = useState<Level | null>(null);
  const { uploadFile, isUploading } = usePygData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-border bg-surface-sunken px-7 py-2.5">
      <SegmentedControl
        variant="bar"
        ariaLabel="Grupo de cuentas"
        options={GROUPS}
        value={group}
        onChange={setGroup}
      />

      <button
        type="button"
        aria-pressed={hideZeros}
        onClick={() => setHideZeros((value) => !value)}
        className={cn(
          "inline-flex h-[34px] items-center gap-2 rounded-[9px] border px-3 text-[12.5px] font-semibold transition-colors",
          hideZeros
            ? "border-brand bg-brand-soft text-brand"
            : "border-border bg-surface text-muted hover:bg-canvas",
        )}
      >
        <EyeOff size={14} />
        Ocultar ceros
      </button>

      <span className="h-[22px] w-px bg-border" />

      <span className="text-[10.5px] font-semibold uppercase tracking-[0.6px] text-faintest">
        Expandir
      </span>
      <div className="flex items-center gap-1.5">
        {LEVELS.map((value) => (
          <LevelButton
            key={value}
            active={level === value}
            onClick={() => setLevel(value)}
            className="w-[30px]"
          >
            {value}
          </LevelButton>
        ))}
        <LevelButton
          active={level === "todo"}
          onClick={() => setLevel("todo")}
          className="px-[11px]"
        >
          Todo
        </LevelButton>
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xls,.xlsx"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void uploadFile(file);
            }
            // Allow re-selecting the same file after an error or replacement.
            event.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-[34px] items-center gap-2 rounded-[8px] bg-brand px-[13px] text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-wait disabled:opacity-70"
        >
          {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {isUploading ? "Procesando…" : "Cargar Excel"}
        </button>

        <DownloadMenu />
        <InfoTip />
      </div>
    </div>
  );
}

/** A square expand-to-level button; `active` fills it with the brand color. */
function LevelButton({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-[30px] items-center justify-center rounded-[7px] border text-[12.5px] font-semibold transition-colors",
        active
          ? "border-brand bg-brand text-white"
          : "border-border bg-surface text-muted hover:border-faint",
        className,
      )}
    >
      {children}
    </button>
  );
}

type ExportKind = "data" | "template";

/**
 * "Descargar Excel": exports the edited Estado de Resultados or a blank template seeded
 * with the current accounts. Both build the workbook via a dynamic import of the exceljs
 * layer (kept out of the initial bundle), then trigger a browser download.
 */
function DownloadMenu() {
  const { dataset, edits } = usePygData();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [failed, setFailed] = useState(false);

  const runExport = useCallback(
    async (kind: ExportKind) => {
      if (busy || (kind === "data" && !dataset)) {
        return;
      }
      setBusy(kind);
      setFailed(false);
      try {
        const [exportMod, { downloadBlob }] = await Promise.all([
          import("@/lib/profit-loss/export"),
          import("@/lib/download"),
        ]);
        const workbook =
          kind === "data" && dataset
            ? exportMod.buildPygWorkbook(dataset, edits)
            : exportMod.buildBlankTemplate(dataset);
        const blob = await exportMod.workbookToBlob(workbook);
        downloadBlob(blob, exportMod.pygExportFilename(dataset, kind));
        setOpen(false);
      } catch {
        setFailed(true);
      } finally {
        setBusy(null);
      }
    },
    [busy, dataset, edits],
  );

  return (
    <div className="relative">
      {open && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-20 cursor-default"
        />
      )}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative z-30 inline-flex h-[34px] items-center gap-2 rounded-[8px] border border-faintest bg-surface px-[13px] text-[12.5px] font-semibold text-brand transition-colors hover:bg-canvas"
      >
        <FileSpreadsheet size={14} />
        Descargar Excel
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          role="menu"
          style={{ width: 308 }}
          className="absolute right-0 top-[calc(100%+8px)] z-30 rounded-xl border border-border bg-surface p-[7px] shadow-[0_14px_36px_rgba(15,23,42,0.16)]"
        >
          <DownloadItem
            icon={<FileSpreadsheet size={17} className="text-brand" />}
            title="Excel con tus datos"
            description="El estado con los valores y comentarios actuales"
            onClick={() => runExport("data")}
            disabled={!dataset}
            busy={busy === "data"}
          />
          <DownloadItem
            icon={<FilePlus2 size={17} className="text-muted" />}
            title="Plantilla vacía"
            description="Tus cuentas con los montos en blanco, para llenar y recargar"
            onClick={() => runExport("template")}
            busy={busy === "template"}
          />
          {failed && (
            <p className="px-[11px] pt-1.5 text-[11.5px] leading-snug text-negative">
              No se pudo generar el Excel. Intenta de nuevo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DownloadItem({
  icon,
  title,
  description,
  onClick,
  disabled = false,
  busy = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled || busy}
      onClick={onClick}
      className="flex w-full items-start gap-2.5 rounded-[9px] px-[11px] py-2.5 text-left transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
    >
      <span className="mt-px shrink-0">
        {busy ? <Loader2 size={17} className="animate-spin text-brand" /> : icon}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-ink">{title}</span>
        <span className="text-[11.5px] leading-snug text-faint">{description}</span>
      </span>
    </button>
  );
}

/** Accepted-files hint: a dark tooltip shown on hover or click of an info button. */
function InfoTip() {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="¿Qué archivos acepta?"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-[34px] w-[34px] items-center justify-center rounded-[8px] border border-border bg-surface text-faint transition-colors hover:text-muted"
      >
        <Info size={16} />
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute right-0 top-[calc(100%+8px)] z-30 w-[288px] rounded-[10px] bg-ink px-[13px] py-[11px] text-[12px] leading-normal text-white/85 shadow-[0_14px_36px_rgba(15,23,42,0.28)]"
        >
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-white">
            <Info size={13} />
            Archivos aceptados
          </div>
          Acepta el reporte mensual o anual del sistema contable (con o sin línea de centro de
          costo), o uno editado por la app. El consolidado por centros de costo estará disponible
          próximamente.
        </div>
      )}
    </div>
  );
}
