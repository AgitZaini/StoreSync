import { zodResolver } from "@hookform/resolvers/zod";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Package, ReceiptText, ScanFace, Smartphone } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { PasswordInput } from "../../components/password-input";
import { buttonStyles, inputClass } from "../../components/styles";
import { Field, Logo, Notice } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import { useApiHealth } from "../../lib/health";
import { roleLabels } from "../../lib/roles";
import { cn } from "../../lib/utils";
import { phoneField } from "../../lib/validation";
import type { UserRole } from "../../types/auth";
import { useAuth } from "./auth-context";

const loginSchema = z.object({
  phone: phoneField,
  password: z.string().min(1, "Kata sandi wajib diisi"),
});

type LoginForm = z.infer<typeof loginSchema>;

const highlights: Array<{ icon: LucideIcon; title: string; description: string }> = [
  { icon: ScanFace, title: "Absen foto langsung + lokasi", description: "Hanya bisa dalam radius 20 m dari apotek tugas." },
  { icon: ReceiptText, title: "Penjualan disetujui kasir", description: "Omzet dihitung setelah apotek menyetujui laporan." },
  { icon: Package, title: "Stok terpantau setiap hari", description: "Selisih stok terlihat sebelum stock opname." },
];

// Akun dari `npm run db:seed`; hanya tampil di development atau bila diaktifkan lewat env.
const showDemoAccounts = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === "true";
const demoAccounts: Array<{ role: UserRole; phone: string }> = [
  { role: "SUPER_ADMIN", phone: "081200000001" },
  { role: "ADMIN", phone: "081200000002" },
  { role: "TEAM_LEADER", phone: "081200000003" },
  { role: "SPG", phone: "081200000004" },
  { role: "KASIR", phone: "081200000005" },
];

export function LoginPage() {
  const { login, sessionMessage } = useAuth();
  const health = useApiHealth();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { phone: "", password: "" } });
  const phone = useWatch({ control, name: "phone" });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);

    try {
      await login(values.phone, values.password);
    } catch (loginError) {
      setError(getErrorMessage(loginError, "Gagal masuk. Coba lagi."));
    }
  });

  const fillDemoAccount = (account: (typeof demoAccounts)[number]) => {
    setValue("phone", account.phone, { shouldValidate: true });
    setValue("password", "Password123!", { shouldValidate: true });
    setError(null);
  };

  return (
    <main className="min-h-screen bg-canvas text-ink lg:grid lg:grid-cols-[minmax(0,44fr)_minmax(0,56fr)]">
      <section className="relative hidden overflow-hidden bg-navy-950 px-12 py-12 text-white lg:flex xl:px-16">
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -bottom-56 -left-32 size-[600px] rounded-full bg-brand-600/45 blur-[120px]" />
        <div className="pointer-events-none absolute -right-40 top-16 size-80 rounded-full bg-brand-400/15 blur-[100px]" />

        <div className="relative flex w-full max-w-[460px] flex-col">
          <Logo inverted />

          <div className="mt-auto pt-16">
            <h1 className="text-[40px] font-semibold leading-[1.1] tracking-tight xl:text-[44px]">
              Absen, stok, dan penjualan SPG dalam satu aplikasi.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/60">
              Pengganti laporan WhatsApp dan Excel untuk Super Admin, Admin, Team Leader, SPG, dan Kasir Apotek.
            </p>
          </div>

          <div className="mt-10 space-y-3">
            {highlights.map((item) => (
              <div key={item.title} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-white/85">
                  <item.icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold">{item.title}</span>
                  <span className="mt-0.5 block text-sm text-white/60">{item.description}</span>
                </span>
              </div>
            ))}
          </div>

          <p className="mt-10 text-xs text-white/40">© {new Date().getFullYear()} StoreSync</p>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
        <form
          onSubmit={onSubmit}
          noValidate
          className="w-full max-w-[440px] rounded-3xl border border-line bg-white p-6 shadow-[0_24px_48px_-24px_rgb(16_24_40/0.18)] sm:p-10"
        >
          <Logo className="mb-8 lg:hidden" />
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Masuk ke StoreSync</h2>
          <p className="mt-1.5 text-sm text-muted">Gunakan nomor HP dan kata sandi dari Super Admin.</p>

          <div className="mt-8 space-y-5">
            {sessionMessage ? <Notice>{sessionMessage}</Notice> : null}

            <Field label="Nomor HP" error={errors.phone?.message}>
              <span className="relative block">
                <Smartphone className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                <input
                  {...register("phone")}
                  type="tel"
                  inputMode="tel"
                  autoComplete="username"
                  placeholder="0812-3456-7890"
                  aria-invalid={Boolean(errors.phone) || undefined}
                  className={cn(inputClass, "pl-10", errors.phone && "border-red-300 focus:border-red-400 focus:ring-red-100")}
                />
              </span>
            </Field>

            <Field label="Kata sandi" error={errors.password?.message}>
              <PasswordInput
                {...register("password")}
                autoComplete="current-password"
                placeholder="••••••••"
                invalid={Boolean(errors.password)}
              />
            </Field>

            {error ? <Notice tone="red">{error}</Notice> : null}

            <button type="submit" disabled={isSubmitting} className={cn(buttonStyles.primary, "h-11 w-full")}>
              {isSubmitting ? "Memproses..." : "Masuk"}
              {isSubmitting ? null : <ArrowRight />}
            </button>
          </div>

          {showDemoAccounts ? (
            <div className="mt-6 rounded-2xl border border-dashed border-line p-3">
              <p className="px-1 text-xs font-medium text-muted">Akun demo · sandi Password123!</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {demoAccounts.map((account) => (
                  <button
                    key={account.role}
                    type="button"
                    onClick={() => fillDemoAccount(account)}
                    className={cn(
                      "h-8 rounded-lg px-2.5 text-xs font-medium transition",
                      phone === account.phone ? "bg-brand-600 text-white" : "bg-canvas text-gray-600 hover:text-ink",
                    )}
                  >
                    {roleLabels[account.role]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <p className="mt-6 text-center text-sm text-muted">Lupa kata sandi? Hubungi Super Admin.</p>
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-subtle">
            <span className={cn("size-2 rounded-full", health.dot)} />
            {health.label}
          </p>
        </form>
      </section>
    </main>
  );
}
