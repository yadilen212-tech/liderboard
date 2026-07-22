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

export interface AccountOption {
  code: string;
  name: string;
}

/**
 * "Cuenta contable" filter. The account list is parsed from the uploaded P&L
 * Excel; until one is loaded `accounts` is empty and the panel shows an empty
 * state. Wire the parsed accounts to `accounts` to activate search + selection.
 */
export function AccountFilter({ accounts = [] }: { accounts?: AccountOption[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visible = useMemo(
    () =>
      accounts.filter(
        (account) =>
          account.name.toLowerCase().includes(query.trim().toLowerCase()) ||
          account.code.includes(query.trim()),
      ),
    [accounts, query],
  );

  const toggle = (code: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

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
                  onToggle={() => toggle(account.code)}
                >
                  {account.name}
                </DropdownOption>
              ))}
            </div>
            <DropdownFooter>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
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
