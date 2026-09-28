import { LogOut } from "lucide-react";
import { buttonStyles } from "../../components/styles";
import { Avatar, Card, PageHeader, Pill } from "../../components/ui";
import { formatDateTime, formatPhone, getInitials } from "../../lib/format";
import { roleLabels } from "../../lib/roles";
import { useAuth, useCurrentUser } from "../auth/auth-context";
import { ChangePasswordForm } from "../auth/change-password-form";

export function ProfilePage() {
  const user = useCurrentUser();
  const { logout } = useAuth();

  const details = [
    { label: "Nomor HP", value: formatPhone(user.phone) },
    { label: "Peran", value: roleLabels[user.role] },
    { label: "Login terakhir", value: user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "-" },
    { label: "Terdaftar sejak", value: formatDateTime(user.createdAt) },
  ];

  return (
    <>
      <PageHeader title="Profil" description="Data akun dan kata sandi Anda." />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card>
          <div className="flex items-center gap-4">
            <Avatar initials={getInitials(user.name)} className="size-14 text-base" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-ink">{user.name}</p>
              <Pill tone={user.status === "ACTIVE" ? "green" : "gray"} className="mt-1.5">
                {user.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
              </Pill>
            </div>
          </div>

          <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
            {details.map((detail) => (
              <div key={detail.label} className="flex justify-between gap-3">
                <dt className="text-muted">{detail.label}</dt>
                <dd className="text-right font-medium text-ink tabular-nums">{detail.value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-5 rounded-xl bg-canvas px-3.5 py-2.5 text-xs leading-relaxed text-muted">
            Perubahan nama, nomor HP, atau peran dilakukan oleh Super Admin.
          </p>

          <button type="button" onClick={() => void logout()} className={`${buttonStyles.danger} mt-5 w-full`}>
            <LogOut />
            Keluar
          </button>
        </Card>

        <Card title="Ganti kata sandi">
          <ChangePasswordForm />
        </Card>
      </div>
    </>
  );
}
