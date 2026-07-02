'use client';

import { useState } from 'react';

interface ReportDropdownProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}

export function ReportDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
}: ReportDropdownProps<T>) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <span className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {label}
      </span>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between rounded-lg border border-neutral-300 bg-white px-3 text-left text-sm text-neutral-900 transition hover:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
      >
        <span>{value}</span>
        <span className="text-neutral-400">v</span>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute z-20 mt-2 w-full rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        >
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === value}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-neutral-700 hover:bg-amber-50 hover:text-amber-700 dark:text-neutral-200 dark:hover:bg-amber-500/10 dark:hover:text-amber-300"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
