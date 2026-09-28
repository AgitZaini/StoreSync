import { KeyRound, LogOut } from "lucide-react";
import { Logo } from "../../components/ui";
import { useAuth, useCurrentUser } from "./auth-context";
import { ChangePasswordForm } from "./change-password-form";

/** Wajib dilewati saat login pertama (AKN-01) sebelum bisa membuka menu lain. */
export function ChangePasswordPage() {
  const user = useCurrentUser();
  const { logout } = useAuth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[480px] rounded-3xl border border-line bg-white p-6 shadow-[0_24px_48px_-24px_rgb(16_24_40/0.18)] sm:p-10">
        <Logo className="mb-8" />
        <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <KeyRound className="size-5" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">Buat kata sandi baru</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Halo {user.name}. Demi keamanan, ganti kata sandi sementara dari Super Admin sebelum melanjutkan.
        </p>

        <div className="mt-8">
          <ChangePasswordForm submitLabel="Simpan dan lanjutkan" />
        </div>

        <button
          type="button"
          onClick={() => void logout()}
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"
        >
          <LogOut className="size-4" />
          Keluar
        </button>
      </div>
    </main>
  );
}
