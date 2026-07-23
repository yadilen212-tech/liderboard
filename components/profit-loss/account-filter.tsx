"use client";

import { FileSpreadsheet, ListTree } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dropdown,
  DropdownFooter,
  DropdownOption,
  DropdownPanel,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import type { AccountOption } from "@/lib/profit-loss/filter";

export interface AccountFilterProps {
  /** Accounts parsed from the loaded Excel; empty shows the "carga un Excel" state. */
  accounts: AccountOption[];
  /** Focus selection (empty = no filter). */
  selected: ReadonlySet<string>;
  onToggle: (code: string) => void;
  onClear: () => void;
}

/**
 * "Cuenta contable" filter. The account list comes from the uploaded P&L Excel via
 * PygDataProvider; until one is loaded `accounts` is empty and the panel shows an empty
 * state. Selection is prop-driven so the Datos table can focus the chosen accounts.
 */
export function AccountFilter({ accounts, selected, onToggle, onClear }: AccountFilterProps) {
  const [query, setQuery] = useState("");

  const visible = useMemo(
    () =>
      accounts.filter(
        (account) =>
          account.name.toLowerCase().includes(query.trim().toLowerCase()) ||
          account.code.includes(query.trim()),
      ),
    [accounts, query],
  );

  return (
    <Dropdown>
      <DropdownTrigger active={selected.size > 0} icon={<ListTree size={15} />}>
        {selected.size > 0 ? `Cuenta · ${selected.size}` : "Cuenta contable"}
      </DropdownTrigger>
      <DropdownPanel width={344}>
        {accounts.length === 0 ? (
          <EmptyState icon={<FileSpreadsheet size={22} />}>
            Carga un Excel de Pérdidas y Ganancias para filtrar por cuenta contable.
          </EmptyState>
        ) : (
          <>
            <SearchInput
              size="sm"
              value={query}
              onChange={setQuery}
              placeholder="Buscar cuenta o código…"
              className="mb-2"
            />
            <div className="-mx-1 max-h-72 overflow-auto">
              {visible.map((account) => (
                <DropdownOption
                  key={account.code}
                  code={account.code}
                  selected={selected.has(account.code)}
                  onToggle={() => onToggle(account.code)}
                >
                  {account.name}
                </DropdownOption>
              ))}
            </div>
            <DropdownFooter>
              <Button variant="ghost" size="sm" onClick={onClear}>
                Quitar selección
              </Button>
              <Button variant="primary" size="sm">
                Listo
              </Button>
            </DropdownFooter>
          </>
        )}
      </DropdownPanel>
    </Dropdown>
  );
}
