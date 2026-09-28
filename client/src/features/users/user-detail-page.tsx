import { ArrowLeft, KeyRound, Pencil, Plus, Power, Store, UsersRound } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { RolePill, UserStatusPill } from "../../components/badges";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { SelectInput } from "../../components/form-controls";
import { buttonStyles } from "../../components/styles";
import { useToast } from "../../components/toast-context";
import { Card, EmptyState, Notice, PageHeader, Pill, Spinner } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import { formatDateTime, formatPhone } from "../../lib/format";
import { roleLabels } from "../../lib/roles";
import { cn } from "../../lib/utils";
import type { PlacementHistoryItem, UserDetail } from "../../types/master-data";
import { AuditTimeline } from "../audit-log/audit-timeline";
import { useCurrentUser } from "../auth/auth-context";
import { usePharmacies } from "../pharmacies/pharmacies-api";
import { AddPlacementDialog, EditUserDialog, ResetPasswordDialog } from "./user-dialogs";
import { useEndPlacement, useTeams, useUpdateUserStatus, useUpdateUserTeam, useUser } from "./users-api";

const MAX_PLACEMENTS = 3;

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{children}</dd>
    </div>
  );
}

function TeamCard({ user }: { user: UserDetail }) {
  const teams = useTeams();
  const updateTeam = useUpdateUserTeam(user.id);
  const showToast = useToast();
  const [teamId, setTeamId] = useState(user.team?.id ?? "");
  const changed = teamId !== (user.team?.id ?? "");

  return (
    <Card title="Tim">
      <p className="mb-3 text-sm text-muted">
        {user.team ? (
          <>
            Diawasi <span className="font-medium text-ink">{user.team.leader.name}</span> ({user.team.name}).
          </>
        ) : (
          "SPG ini belum masuk tim mana pun."
        )}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <span className="flex-1">
          <SelectInput value={teamId} onChange={(event) => setTeamId(event.target.value)} aria-label="Tim">
            <option value="">Tanpa tim</option>
            {(teams.data ?? []).map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} · {team.leader.name}
              </option>
            ))}
          </SelectInput>
        </span>
        <button
          type="button"
          disabled={!changed || updateTeam.isPending}
          onClick={() =>
            updateTeam.mutate(teamId || null, {
              onSuccess: () => showToast(teamId ? "Tim SPG diperbarui" : "SPG dikeluarkan dari tim"),
            })
          }
          className={buttonStyles.primary}
        >
          {updateTeam.isPending ? "Menyimpan..." : "Simpan tim"}
        </button>
      </div>
      {updateTeam.error ? (
        <div className="mt-3">
          <Notice tone="red">{getErrorMessage(updateTeam.error)}</Notice>
        </div>
      ) : null}
    </Card>
  );
}

function PlacementsCard({ user }: { user: UserDetail }) {
  const pharmacies = usePharmacies({ status: "ACTIVE" });
  const endPlacement = useEndPlacement();
  const showToast = useToast();
  const [adding, setAdding] = useState(false);
  const [ending, setEnding] = useState<PlacementHistoryItem | null>(null);
  const active = user.placements.filter((placement) => !placement.endedAt);
  const history = user.placements.filter((placement) => placement.endedAt);
  const full = active.length >= MAX_PLACEMENTS;
  const canPlace = user.status === "ACTIVE" && !full;

  return (
    <Card
      title={
        <>
          Penempatan apotek{" "}
          <span className={cn("ml-1 tabular-nums", full ? "text-orange-600" : "text-muted")}>
            {active.length}/{MAX_PLACEMENTS}
          </span>
        </>
      }
      action={
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={!canPlace}
          title={full ? "Maksimal 3 apotek aktif" : undefined}
          className={cn(buttonStyles.secondary, buttonStyles.small)}
        >
          <Plus />
          Tambah
        </button>
      }
    >
      {active.length === 0 ? (
        <EmptyState icon={Store}>SPG ini belum ditempatkan di apotek mana pun.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {active.map((placement) => (
            <li key={placement.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line p-3.5">
              <Link to={`/apotek/${placement.pharmacy.id}`} className="min-w-0 hover:text-brand-600">
                <span className="block truncate text-sm font-medium">{placement.pharmacy.name}</span>
                <span className="block truncate text-xs text-muted">Sejak {formatDateTime(placement.startedAt)}</span>
              </Link>
              <button type="button" onClick={() => setEnding(placement)} className={cn(buttonStyles.danger, buttonStyles.small)}>
                Lepas
              </button>
            </li>
          ))}
        </ul>
      )}
      {full ? <p className="mt-3 text-xs text-muted">Batas 3 apotek aktif tercapai. Lepas salah satu untuk menempatkan di apotek lain.</p> : null}

      {history.length > 0 ? (
        <>
          <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.06em] text-subtle">Riwayat penempatan</p>
          <ul className="divide-y divide-line">
            {history.map((placement) => (
              <li key={placement.id} className="py-2.5 text-sm">
                <span className="font-medium text-ink">{placement.pharmacy.name}</span>
                <span className="block text-xs text-muted">
                  {formatDateTime(placement.startedAt)} – {formatDateTime(placement.endedAt!)} · {placement.endReason}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <AddPlacementDialog open={adding} onClose={() => setAdding(false)} spg={user} pharmacies={pharmacies.data ?? []} />
      <ConfirmDialog
        open={Boolean(ending)}
        onClose={() => setEnding(null)}
        title="Lepas penempatan"
        message={
          <>
            {user.name} tidak lagi bertugas di <strong className="text-ink">{ending?.pharmacy.name}</strong>. Riwayat penempatan
            tetap tersimpan.
          </>
        }
        reasonLabel="Alasan (pindah apotek, diganti, resign, ...)"
        confirmLabel="Lepas penempatan"
        tone="danger"
        onConfirm={async (reason) => {
          await endPlacement.mutateAsync({ placementId: ending!.id, reason });
          showToast("Penempatan dilepas");
        }}
      />
    </Card>
  );
}

function LedTeamCard({ user }: { user: UserDetail }) {
  if (!user.ledTeam) {
    return (
      <Card title="Tim yang dipimpin">
        <EmptyState icon={UsersRound}>
          Belum memimpin tim.{" "}
          <Link to="/pengguna?tab=tim" className="text-brand-600 hover:underline">
            Buat tim
          </Link>{" "}
          untuk Team Leader ini.
        </EmptyState>
      </Card>
    );
  }

  return (
    <Card title={`Memimpin ${user.ledTeam.name}`}>
      {user.ledTeam.members.length === 0 ? (
        <p className="text-sm text-muted">Belum ada SPG di tim ini.</p>
      ) : (
        <ul className="divide-y divide-line">
          {user.ledTeam.members.map((member) => (
            <li key={member.id}>
              <Link to={`/pengguna/${member.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-brand-600">
                <span className="text-sm font-medium">{member.name}</span>
                <span className="text-xs text-muted tabular-nums">{formatPhone(member.phone)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function UserDetailPage() {
  const { id = "" } = useParams();
  const currentUser = useCurrentUser();
  const user = useUser(id);
  const updateStatus = useUpdateUserStatus(id);
  const showToast = useToast();
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  if (user.isPending) {
    return (
      <div className="grid place-items-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!user.data) {
    return (
      <Card>
        <EmptyState icon={UsersRound}>
          {getErrorMessage(user.error, "Pengguna tidak ditemukan.")}{" "}
          <Link to="/pengguna" className="text-brand-600 hover:underline">
            Kembali ke daftar pengguna
          </Link>
        </EmptyState>
      </Card>
    );
  }

  const detail = user.data;
  const isSelf = detail.id === currentUser.id;
  const isKasir = detail.role === "KASIR";
  const deactivating = detail.status === "ACTIVE";

  return (
    <>
      <Link to="/pengguna" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" />
        Pengguna
      </Link>
      <PageHeader
        title={detail.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <RolePill role={detail.role} />
            <UserStatusPill status={detail.status} />
            {detail.mustChangePassword ? <Pill tone="orange">Belum ganti sandi</Pill> : null}
          </span>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card title="Data akun">
            <dl className="space-y-3 text-sm">
              <DetailRow label="Nomor HP">{formatPhone(detail.phone)}</DetailRow>
              <DetailRow label="Peran">{roleLabels[detail.role]}</DetailRow>
              <DetailRow label="Login terakhir">{detail.lastLoginAt ? formatDateTime(detail.lastLoginAt) : "Belum pernah"}</DetailRow>
              <DetailRow label="Terdaftar">{formatDateTime(detail.createdAt)}</DetailRow>
              {detail.kasirPharmacy ? (
                <DetailRow label="Apotek">
                  <Link to={`/apotek/${detail.kasirPharmacy.id}`} className="text-brand-600 hover:underline">
                    {detail.kasirPharmacy.name}
                  </Link>
                </DetailRow>
              ) : null}
            </dl>

            {isSelf ? (
              <p className="mt-5 rounded-xl bg-canvas px-3.5 py-2.5 text-xs text-muted">
                Ini akun Anda. Ubah kata sandi lewat halaman Profil.
              </p>
            ) : (
              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {!isKasir ? (
                  <button type="button" onClick={() => setEditing(true)} className={buttonStyles.secondary}>
                    <Pencil />
                    Ubah akun
                  </button>
                ) : null}
                <button type="button" onClick={() => setResetting(true)} className={buttonStyles.secondary}>
                  <KeyRound />
                  Reset sandi
                </button>
                {!isKasir ? (
                  <button
                    type="button"
                    onClick={() => setTogglingStatus(true)}
                    className={cn(deactivating ? buttonStyles.danger : buttonStyles.secondary, "sm:col-span-2 lg:col-span-1 xl:col-span-2")}
                  >
                    <Power />
                    {deactivating ? "Nonaktifkan akun" : "Aktifkan akun"}
                  </button>
                ) : null}
              </div>
            )}
            {isKasir ? (
              <p className="mt-3 text-xs text-muted">Nama, nomor HP, dan status akun kasir mengikuti data apoteknya.</p>
            ) : null}
          </Card>

          {detail.role === "SPG" && detail.status === "ACTIVE" ? <TeamCard key={detail.team?.id ?? "none"} user={detail} /> : null}
        </div>

        <div className="min-w-0 space-y-5">
          {detail.role === "SPG" ? <PlacementsCard user={detail} /> : null}
          {detail.role === "TEAM_LEADER" ? <LedTeamCard user={detail} /> : null}
          <Card title="Riwayat perubahan">
            <AuditTimeline filters={{ entity: "User", entityId: detail.id }} showEntity={false} />
          </Card>
        </div>
      </div>

      {editing && !isKasir ? <EditUserDialog open onClose={() => setEditing(false)} user={detail} /> : null}
      <ResetPasswordDialog
        open={resetting}
        onClose={() => setResetting(false)}
        userId={detail.id}
        userName={detail.name}
        phone={detail.phone}
      />
      <ConfirmDialog
        open={togglingStatus}
        onClose={() => setTogglingStatus(false)}
        title={deactivating ? "Nonaktifkan akun" : "Aktifkan akun"}
        message={
          deactivating
            ? `${detail.name} tidak bisa login lagi dan keluar dari semua perangkat. Data dan riwayatnya tetap tersimpan.`
            : `${detail.name} bisa login lagi dengan kata sandinya.`
        }
        confirmLabel={deactivating ? "Nonaktifkan" : "Aktifkan"}
        tone={deactivating ? "danger" : "primary"}
        onConfirm={async () => {
          await updateStatus.mutateAsync(deactivating ? "INACTIVE" : "ACTIVE");
          showToast(deactivating ? "Akun dinonaktifkan" : "Akun diaktifkan");
        }}
      />
    </>
  );
}
