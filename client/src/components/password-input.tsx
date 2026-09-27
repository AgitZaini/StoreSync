import { forwardRef, useState } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "../lib/utils";
import { inputClass } from "./styles";

type PasswordInputProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & { invalid?: boolean };

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { className, invalid, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative block">
      <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        aria-invalid={invalid || undefined}
        className={cn(inputClass, "pl-10 pr-11", invalid && "border-red-300 focus:border-red-400 focus:ring-red-100", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-subtle hover:bg-canvas hover:text-ink"
        aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </span>
  );
});
