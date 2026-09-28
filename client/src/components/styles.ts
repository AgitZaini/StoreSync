import { cn } from "../lib/utils";

const buttonBase =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-4";

export const buttonStyles = {
  primary: cn(
    buttonBase,
    "bg-linear-to-b from-brand-500 to-brand-600 text-white shadow-button hover:from-brand-600 hover:to-brand-700",
  ),
  secondary: cn(buttonBase, "border border-line bg-white text-ink shadow-card hover:bg-canvas"),
  danger: cn(buttonBase, "border border-red-100 bg-red-50 text-red-600 hover:bg-red-100"),
  dangerSolid: cn(buttonBase, "bg-red-600 text-white shadow-card hover:bg-red-700"),
  ghost: cn(buttonBase, "text-muted hover:bg-canvas hover:text-ink"),
  small: "h-8 rounded-lg px-3 text-xs",
};

export const inputClass =
  "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition placeholder:text-subtle hover:border-gray-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100";

export const iconButtonClass =
  "relative grid size-10 shrink-0 place-items-center rounded-full border border-line bg-white text-gray-600 transition hover:bg-canvas hover:text-ink";
