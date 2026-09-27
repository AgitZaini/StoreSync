import { forwardRef, useState } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";
import { inputClass } from "./styles";

const invalidClass = "border-red-300 focus:border-red-400 focus:ring-red-100";

export const TextInput = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input"> & { invalid?: boolean }>(
  function TextInput({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(inputClass, invalid && invalidClass, className)}
        {...props}
      />
    );
  },
);

export const SelectInput = forwardRef<HTMLSelectElement, ComponentPropsWithoutRef<"select"> & { invalid?: boolean }>(
  function SelectInput({ className, invalid, children, ...props }, ref) {
    return (
      <span className="relative block">
        <select
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(inputClass, "appearance-none pr-10", invalid && invalidClass, className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
      </span>
    );
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, ComponentPropsWithoutRef<"textarea"> & { invalid?: boolean }>(
  function TextArea({ className, invalid, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(inputClass, "h-auto min-h-24 py-2.5", invalid && invalidClass, className)}
        {...props}
      />
    );
  },
);

const rupiahFormatter = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** Input rupiah bilangan bulat, tampil dengan pemisah ribuan (15.000.000). */
export function RupiahInput({
  value,
  onChange,
  invalid,
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<"input">, "value" | "onChange" | "type"> & {
  value: number | null;
  onChange: (value: number | null) => void;
  invalid?: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <span className="relative block">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-subtle">Rp</span>
      <input
        {...props}
        type="text"
        inputMode="numeric"
        aria-invalid={invalid || undefined}
        value={value === null ? "" : focused ? String(value) : rupiahFormatter.format(value)}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "");
          onChange(digits === "" ? null : Number(digits));
        }}
        className={cn(inputClass, "pl-10 text-right tabular-nums", invalid && invalidClass, className)}
      />
    </span>
  );
}
