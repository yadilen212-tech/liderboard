"use client";

import { useMemo, useState } from "react";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Demo, DocSection } from "./section";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const MONTH_OPTIONS = MONTHS.map((label, index) => ({ value: String(index), label }));

const ACCOUNTS = [
  "Ingresos por ventas",
  "Costo de ventas",
  "Sueldos y salarios",
  "Arriendos",
  "Servicios básicos",
  "Depreciación",
];

export function InputsSection() {
  const [from, setFrom] = useState("0");
  const [to, setTo] = useState("2");
  const [query, setQuery] = useState("");

  const matches = useMemo(
    () => ACCOUNTS.filter((account) => account.toLowerCase().includes(query.trim().toLowerCase())),
    [query],
  );

  return (
    <DocSection
      id="inputs"
      title="Selects y búsqueda"
      description="Select nativo estilizado (con y sin etiqueta) y campo de búsqueda controlado en dos tamaños, más la variante estática del encabezado."
    >
      <Demo label="Select — rango de meses">
        <Select
          label="Desde"
          options={MONTH_OPTIONS}
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <Select
          label="Hasta"
          options={MONTH_OPTIONS}
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
        <Select
          size="sm"
          options={MONTH_OPTIONS}
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
      </Demo>

      <Demo label="Búsqueda del encabezado (estática)" className="block">
        <SearchInput
          readOnlyDisplay
          placeholder="Buscar cliente, cuenta o periodo…"
          className="max-w-[340px]"
        />
      </Demo>

      <Demo label="Búsqueda controlada" className="block space-y-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar cuenta…"
          className="max-w-[340px]"
        />
        <ul className="space-y-1 text-[13px] text-muted">
          {matches.length === 0 ? (
            <li className="text-faint">Sin coincidencias.</li>
          ) : (
            matches.map((account) => <li key={account}>{account}</li>)
          )}
        </ul>
      </Demo>
    </DocSection>
  );
}
