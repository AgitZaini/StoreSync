import { Pencil, Plus, Search, UsersRound } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { RolePill, UserStatusPill } from "../../components/badges";
import { SelectInput, TextInput } from "../../components/form-controls";
import { buttonStyles } from "../../components/styles";
import { Tabs } from "../../components/tabs";
import { Card, DataTable, EmptyState, PageHeader, Pill, Spinner } from "../../components/ui";
import { formatPhone } from "../../lib/format";
import { roleLabels } from "../../lib/roles";
import { cn } from "../../lib/utils";
import type { UserRole, UserStatus } from "../../types/auth";
import type { Team, UserSummary } from "../../types/master-data";
import { CreateUserDialog, TeamDialog } from "./user-dialogs";
import { useTeams, useUsers } from "./users-api";

const MAX_PLACEMENTS = 3;

function UserContext({ user }: { user: UserSummary }) {
  if (user.role === "SPG") {
    return user.team ? <span>{user.team.name}</span> : <span className="text-orange-600">Belum ada tim</span>;
  }

  if (user.role === "TEAM_LEADER") {
    return user.ledTeam ? <span>Memimpin {user.ledTeam.name}</span> : <span className="text-orange-600">Belum memimpin tim</span>;
  }

  if (user.role === "KASIR" && user.kasirPharmacy) {
    return (
      <Link to={`/apotek/${user.kasirPharmacy.id}`} className="text-brand-600 hover:underline">
        {user.kasirPharmacy.name}
      </Link>
    );
  }

  return <span className="text-subtle">-</span>;
}

function PlacementSummary({ user }: { user: UserSummary }) {
  if (user.role !== "SPG") {
    return <span className="text-subtle">-</span>;
  }

  if (user.placements.length === 0) {
    return <span className="text-orange-600">Belum ditempatkan</span>;
  }

  return (
    <span className="block max-w-[260px]">
      <span className="font-medium text-ink tabular-nums">
        {user.placements.length}/{MAX_PLACEMENTS}
      </span>{" "}
      <span className="truncate">{user.placements.map((placement) => placement.pharmacy.name).join(", ")}</span>
    </span>
  );
}

function UsersPanel({ onCreate }: { onCreate: () => void }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [status, setStatus] = useState<UserStatus | "">("ACTIVE");
  const deferredQuery = useDeferredValue(query.trim());
  const users = useUsers({ q: deferredQuery || undefined, role: role || undefined, status: status || undefined });

  return (
    <Card>
      <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_160px]">
        <span className="relative block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama atau nomor HP" className="pl-10" />
        </span>
        <SelectInput value={role} onChange={(event) => setRole(event.target.value as UserRole | "")} aria-label="Filter peran">
          <option value="">Semua peran</option>
          {Object.entries(roleLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectInput>
        <SelectInput value={status} onChange={(event) => setStatus(event.target.value as UserStatus | "")} aria-label="Filter status">
          <option value="ACTIVE">Aktif</option>
          <option value="INACTIVE">Nonaktif</option>
          <option value="">Semua status</option>
        </SelectInput>
      </div>

      {users.isPending ? (
        <div className="grid place-items-center py-12">
          <Spinner />
        </div>
      ) : users.data?.length === 0 && !deferredQuery && !role ? (
        <EmptyState icon={UsersRound}>
          Belum ada pengguna.
          <button type="button" onClick={onCreate} className={cn(buttonStyles.primary, "mt-4 flex")}>
            <Plus />
            Tambah pengguna
          </button>
        </EmptyState>
      ) : (
        <DataTable
          minWidth="min-w-[820px]"
          headers={["Pengguna", "Peran", "Tim / Apotek", "Penempatan", "Status"]}
          rows={(users.data ?? []).map((user) => [
            <Link key="name" to={`/pengguna/${user.id}`} className="group block">
              <span className="block font-medium text-ink group-hover:text-brand-600">{user.name}</span>
              <span className="block text-xs font-normal text-muted tabular-nums">{formatPhone(user.phone)}</span>
            </Link>,
            <RolePill key="role" role={user.role} />,
            <UserContext key="context" user={user} />,
            <PlacementSummary key="placements" user={user} />,
            <span key="status" className="flex flex-wrap items-center gap-1.5">
              <UserStatusPill status={user.status} />
              {user.status === "ACTIVE" && user.mustChangePassword ? <Pill tone="orange">Belum ganti sandi</Pill> : null}
            </span>,
          ])}
        />
      )}
    </Card>
  );
}

function TeamCard({ team, onEdit }: { team: Team; onEdit: () => void }) {
  return (
    <Card
      title={team.name}
      action={
        <button type="button" onClick={onEdit} className={cn(buttonStyles.ghost, buttonStyles.small)}>
          <Pencil />
          Ubah
        </button>
      }
    >
      <Link to={`/pengguna/${team.leader.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-violet-50/60 px-3 py-2.5 hover:bg-violet-50">
        <span className="min-w-0">
          <span className="block text-xs text-violet-600">Team Leader</span>
          <span className="block truncate text-sm font-medium text-ink">{team.leader.name}</span>
        </span>
        <span className="text-xs text-muted tabular-nums">{formatPhone(team.leader.phone)}</span>
      </Link>

      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-[0.06em] text-subtle">
        Anggota SPG · {team.members.length}
      </p>
      {team.members.length === 0 ? (
        <p className="text-sm text-muted">Belum ada SPG. Masukkan SPG ke tim dari halaman detail SPG.</p>
      ) : (
        <ul className="divide-y divide-line">
          {team.members.map((member) => (
            <li key={member.id}>
              <Link to={`/pengguna/${member.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-brand-600">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{member.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {member.placements.length > 0
                      ? member.placements.map((placement) => placement.pharmacy.name).join(", ")
                      : "Belum ditempatkan"}
                  </span>
                </span>
                {member.status === "INACTIVE" ? <UserStatusPill status={member.status} /> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function TeamsPanel({ onCreate }: { onCreate: () => void }) {
  const teams = useTeams();
  const [editing, setEditing] = useState<Team | null>(null);

  if (teams.isPending) {
    return (
      <div className="grid place-items-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!teams.data?.length) {
    return (
      <Card>
        <EmptyState icon={UsersRound}>
          Belum ada tim. Setiap tim dipimpin satu Team Leader dan berisi SPG yang diawasinya.
          <button type="button" onClick={onCreate} className={cn(buttonStyles.primary, "mt-4 flex")}>
            <Plus />
            Buat tim
          </button>
        </EmptyState>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {teams.data.map((team) => (
          <TeamCard key={team.id} team={team} onEdit={() => setEditing(team)} />
        ))}
      </div>
      {editing ? <TeamDialog key={editing.id} open onClose={() => setEditing(null)} team={editing} /> : null}
    </>
  );
}

export function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "tim" ? "teams" : "users";
  const [creatingUser, setCreatingUser] = useState(false);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const teams = useTeams();

  return (
    <>
      <PageHeader
        title="Pengguna & Penempatan"
        description="Akun, peran, tim leader, dan penempatan SPG di apotek."
        actions={
          tab === "users" ? (
            <button type="button" onClick={() => setCreatingUser(true)} className={buttonStyles.primary}>
              <Plus />
              Tambah pengguna
            </button>
          ) : (
            <button type="button" onClick={() => setCreatingTeam(true)} className={buttonStyles.primary}>
              <Plus />
              Buat tim
            </button>
          )
        }
      />

      <Tabs
        tabs={[
          { key: "users", label: "Pengguna" },
          { key: "teams", label: "Tim", count: teams.data?.length },
        ]}
        value={tab}
        onChange={(key) => setSearchParams(key === "teams" ? { tab: "tim" } : {}, { replace: true })}
      />

      {tab === "users" ? <UsersPanel onCreate={() => setCreatingUser(true)} /> : <TeamsPanel onCreate={() => setCreatingTeam(true)} />}

      <CreateUserDialog open={creatingUser} onClose={() => setCreatingUser(false)} teams={teams.data ?? []} />
      {creatingTeam ? <TeamDialog open onClose={() => setCreatingTeam(false)} /> : null}
    </>
  );
}
