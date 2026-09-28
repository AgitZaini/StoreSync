import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { PasswordInput } from "../../components/password-input";
import { buttonStyles } from "../../components/styles";
import { Field, Notice } from "../../components/ui";
import { api, getErrorMessage } from "../../lib/api";
import { cn } from "../../lib/utils";
import { newPasswordField, passwordRules } from "../../lib/validation";
import type { AuthResponse } from "../../types/auth";
import { useAuth } from "./auth-context";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Kata sandi saat ini wajib diisi"),
    newPassword: newPasswordField,
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi kata sandi tidak sama",
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    path: ["newPassword"],
    message: "Kata sandi baru harus berbeda dari kata sandi saat ini",
  });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export function ChangePasswordForm({ submitLabel = "Simpan kata sandi" }: { submitLabel?: string }) {
  const { applySession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const newPassword = useWatch({ control, name: "newPassword" });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setError(null);
    setSaved(false);

    try {
      const { data } = await api.post<AuthResponse>("/auth/change-password", { currentPassword, newPassword });
      applySession(data);
      reset();
      setSaved(true);
    } catch (changeError) {
      setError(getErrorMessage(changeError, "Gagal mengganti kata sandi."));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field label="Kata sandi saat ini" error={errors.currentPassword?.message}>
        <PasswordInput {...register("currentPassword")} autoComplete="current-password" invalid={Boolean(errors.currentPassword)} />
      </Field>

      <Field label="Kata sandi baru" error={errors.newPassword?.message}>
        <PasswordInput {...register("newPassword")} autoComplete="new-password" invalid={Boolean(errors.newPassword)} />
      </Field>

      <ul className="grid gap-1.5 text-xs sm:grid-cols-3">
        {passwordRules.map((rule) => {
          const passed = rule.test(newPassword);

          return (
            <li key={rule.label} className={cn("flex items-center gap-1.5", passed ? "text-green-600" : "text-muted")}>
              <span
                className={cn(
                  "grid size-4 place-items-center rounded-full",
                  passed ? "bg-green-100" : "border border-line bg-white",
                )}
              >
                {passed ? <Check className="size-3" strokeWidth={3} /> : null}
              </span>
              {rule.label}
            </li>
          );
        })}
      </ul>

      <Field label="Ulangi kata sandi baru" error={errors.confirmPassword?.message}>
        <PasswordInput {...register("confirmPassword")} autoComplete="new-password" invalid={Boolean(errors.confirmPassword)} />
      </Field>

      {error ? <Notice tone="red">{error}</Notice> : null}
      {saved ? <Notice tone="green">Kata sandi berhasil diganti. Sesi di perangkat lain sudah dikeluarkan.</Notice> : null}

      <button type="submit" disabled={isSubmitting} className={cn(buttonStyles.primary, "h-11 w-full sm:w-auto")}>
        {isSubmitting ? "Menyimpan..." : submitLabel}
      </button>
    </form>
  );
}
