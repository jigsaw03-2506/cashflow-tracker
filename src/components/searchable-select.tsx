"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

export type SelectOption = { value: string; label: string };

export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder,
  searchLabel,
  disabled = false,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder: string;
  searchLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((option) => option.value === value);
  const visibleOptions = useMemo(
    () =>
      options.filter((option) =>
        option.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
      ),
    [options, search],
  );

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-10 w-full items-center justify-between rounded-control border border-line bg-surface px-3 py-2 text-left text-sm text-ink outline-none transition-colors hover:bg-surface-subtle focus:border-accent disabled:opacity-50"
      >
        <span className={selected ? "" : "text-muted"}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className="size-4 text-muted" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-full overflow-hidden rounded-card border border-line bg-surface shadow-floating">
          <div className="border-b border-line p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                autoFocus
                aria-label={searchLabel}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchLabel}
                className="pl-9"
                onKeyDown={(event) => {
                  if (event.key === "Escape") setOpen(false);
                }}
              />
            </div>
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto p-1">
            {visibleOptions.length ? (
              visibleOptions.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === option.value}
                    className="flex w-full items-center justify-between rounded-control px-3 py-2 text-left text-sm text-ink hover:bg-surface-subtle"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    {option.label}
                    {value === option.value && (
                      <Check className="size-4 text-accent" />
                    )}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-3 text-sm text-muted">{placeholder}</li>
            )}
          </ul>
        </div>
      )}
      {open && (
        <button
          type="button"
          aria-label="Close account selector"
          className="fixed inset-0 z-20 cursor-default"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
