"use client";

import { Calendar } from "lucide-react";
import { useState } from "react";
import { Dropdown, DropdownPanel, DropdownTrigger } from "@/components/ui/dropdown";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";

type PeriodMode = "all" | "month" | "range";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const MODES: { value: PeriodMode; label: string }[] = [
  { value: "all", label: "Todo el año" },
  { value: "month", label: "Mes" },
  { value: "range", label: "Rango" },
];

const MONTH_OPTIONS = MONTHS.map((label, index) => ({ value: String(index), label }));

/** Período filter: choose the whole year, a single month, or a month range. Visual only. */
export function PeriodFilter() {
  const [mode, setMode] = useState<PeriodMode>("all");
  const [month, setMonth] = useState(0);
  const [from, setFrom] = useState("0");
  const [to, setTo] = useState("11");

  const label =
    mode === "month"
      ? `${MONTHS[month]} 2026`
      : mode === "range"
        ? `${MONTHS[Number(from)]}–${MONTHS[Number(to)]}`
        : "Todo el año";

  return (
    <Dropdown>
      <DropdownTrigger icon={<Calendar size={15} />}>{label}</DropdownTrigger>
      <DropdownPanel align="right" width={288}>
        <div className="mb-3 flex overflow-hidden rounded-lg border border-border">
          {MODES.map((option, index) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              className={cn(
                "flex-1 py-[7px] text-xs font-semibold transition-colors",
                index < MODES.length - 1 && "border-r border-border",
                mode === option.value
                  ? "bg-brand text-white"
                  : "bg-surface text-muted hover:bg-canvas",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {mode === "month" && (
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS.map((name, index) => (
              <button
                key={name}
                type="button"
                onClick={() => setMonth(index)}
                className={cn(
                  "rounded-lg border py-2 text-xs font-semibold transition-colors",
                  month === index
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-surface text-muted hover:bg-canvas",
                )}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {mode === "range" && (
          <div className="flex items-end gap-2.5">
            <div className="flex-1">
              <Select
                label="Desde"
                size="sm"
                options={MONTH_OPTIONS}
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div className="flex-1">
              <Select
                label="Hasta"
                size="sm"
                options={MONTH_OPTIONS}
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
          </div>
        )}
      </DropdownPanel>
    </Dropdown>
  );
}
