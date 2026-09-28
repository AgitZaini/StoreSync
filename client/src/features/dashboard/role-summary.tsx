import { AlertTriangle, ArrowRight, MapPin, MapPinned, Package, ScanFace, Store, Target, Users, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { buttonStyles } from "../../components/styles";
import { Card, EmptyState, Notice, Pill, Spinner, StatCard } from "../../components/ui";
import {
  currentMonth,
  formatCompactCurrency,
  formatCurrency,
  formatDuration,
  formatMonth,
  formatOpeningHours,
  formatScheduleValue,
  formatTime,
  todayDate,
} from "../../lib/format";
import { cn } from "../../lib/utils";
import type { AuthUser } from "../../types/auth";
import type { MonitorSummary } from "../../types/attendance";
import type { Overview, PharmacyBase } from "../../types/master-data";
import { useAttendanceMonitor, useTodayAttendance } from "../attendance/attendance-api";
import { AttendanceStatusPill } from "../attendance/attendance-status-pill";
import { usePharmacies } from "../pharmacies/pharmacies-api";
import { useTargets } from "../products/products-api";
import { useTeams } from "../users/users-api";
import { useVisitToday } from "../visits/visits-api";
import { useOverview } from "./dashboard-api";

function Loading() {
  return (
    <div className="grid place-items-center py-10">
      <Spinner />
    </div>
  );
}

function PeopleList({ people, linkable }: { people: Array<{ id: string; name: string }>; linkable: boolean }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {people.map((person) => (
        <li key={person.id}>
          {linkable ? (
            <Link to={`/pengguna/${person.id}`} className="inline-flex rounded-lg bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100">
              {person.name}
            </Link>
          ) : (
            <span className="inline-flex rounded-lg bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700">{person.name}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

const ATTENDANCE_CHIPS: Array<{ key: keyof MonitorSummary; label: string; className: string }> = [
  { key: "onTime", label: "Tepat waktu", className: "text-green-600" },
  { key: "late", label: "Telat", className: "text-orange-600" },
  { key: "notCheckedIn", label: "Belum absen", className: "text-red-600" },
  { key: "absent", label: "Tidak masuk", className: "text-red-600" },
];

/** DSB-01: absen hari ini vs jadwal (Admin, Super Admin, Team Leader). */
function AttendanceTodayCard({ summary, link }: { summary: MonitorSummary; link: string }) {
  const checkedIn = summary.onTime + summary.late;

  return (
    <Card
      title="Absen hari ini"
      action={
        <Link to={link} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
          Lihat detail <ArrowRight className="size-3.5" />
        </Link>
      }
    >
      <p className="text-sm text-muted">
        <span className="text-2xl font-semibold tabular-nums text-ink">{checkedIn}</span> dari {summary.scheduled} SPG terjadwal sudah absen masuk
      </p>
      <dl className="mt-4 grid grid-cols-4 gap-2">
        {ATTENDANCE_CHIPS.map((chip) => (
          <div key={chip.key} className="rounded-xl bg-canvas px-2 py-2 text-center">
            <dd className={cn("text-lg font-semibold tabular-nums", chip.className)}>{summary[chip.key]}</dd>
            <dt className="text-[11px] text-muted">{chip.label}</dt>
          </div>
        ))}
      </dl>
      {summary.pendingExceptions > 0 ? (
        <div className="mt-4">
          <Notice>{summary.pendingExceptions} pengecualian absen menunggu persetujuan Admin.</Notice>
        </div>
      ) : null}
    </Card>
  );
}

/** ABS-03 + KNJ-02 di beranda Super Admin/Admin: siapa yang sedang bekerja dan berkunjung. */
function LeadersTodayCard({ summary }: { summary: Overview["leadersToday"] }) {
  const chips = [
    { label: "Sedang bekerja", value: summary.active, className: "text-green-600" },
    { label: "Kunjungan", value: summary.visits, className: "text-brand-600" },
    { label: "Di apotek", value: summary.openVisits, className: "text-orange-600" },
  ];

  return (
    <Card
      title="Team Leader hari ini"
      action={
        <Link to="/peta-leader" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
          Buka peta <ArrowRight className="size-3.5" />
        </Link>
      }
    >
      <p className="text-sm text-muted">
        <span className="text-2xl font-semibold tabular-nums text-ink">{summary.started}</span> dari {summary.leaders} Team Leader sudah mulai
        kerja
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-2">
        {chips.map((chip) => (
          <div key={chip.label} className="rounded-xl bg-canvas px-2 py-2 text-center">
            <dd className={cn("text-lg font-semibold tabular-nums", chip.className)}>{chip.value}</dd>
            <dt className="text-[11px] text-muted">{chip.label}</dt>
          </div>
        ))}
      </dl>
      <Link to="/evaluasi-kunjungan" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700">
        <MapPinned className="size-3.5" /> Evaluasi rencana vs kunjungan
      </Link>
    </Card>
  );
}

function ManagerSummary({ canManage }: { canManage: boolean }) {
  const overview = useOverview(true);

  if (!overview.data) {
    return <Loading />;
  }

  const { activeUsers, pharmacies, targets, spgWithoutPlacement, spgWithoutTeam } = overview.data;
  const staff = activeUsers.SUPER_ADMIN + activeUsers.ADMIN + activeUsers.TEAM_LEADER + activeUsers.SPG;

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        <AttendanceTodayCard summary={overview.data.attendanceToday} link="/pemantauan-absen" />
        <LeadersTodayCard summary={overview.data.leadersToday} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard label="Karyawan aktif" value={String(staff)} icon={Users} caption={`${activeUsers.SPG} SPG · ${activeUsers.TEAM_LEADER} Team Leader`} />
        <StatCard label="Apotek aktif" value={String(pharmacies.ACTIVE)} icon={Store} caption={`${pharmacies.INACTIVE} nonaktif`} />
        <StatCard label="Produk aktif" value={String(overview.data.activeProducts)} icon={Package} caption="Bisa dipesan dan dilaporkan" />
        <StatCard
          label={`Target ${formatMonth(targets.month)}`}
          value={formatCompactCurrency(targets.totalAmount)}
          title={formatCurrency(targets.totalAmount)}
          icon={Target}
          caption={`${targets.spgWithTarget} dari ${targets.activeSpg} SPG punya target`}
        />
      </div>
      {spgWithoutPlacement.length > 0 || spgWithoutTeam.length > 0 ? (
        <Card title="Perlu dilengkapi" action={<AlertTriangle className="size-[18px] text-orange-500" />}>
          <div className="space-y-4 text-sm">
            {spgWithoutPlacement.length > 0 ? (
              <div>
                <p className="text-muted">{spgWithoutPlacement.length} SPG belum ditempatkan di apotek</p>
                <PeopleList people={spgWithoutPlacement} linkable={canManage} />
              </div>
            ) : null}
            {spgWithoutTeam.length > 0 ? (
              <div>
                <p className="text-muted">{spgWithoutTeam.length} SPG belum masuk tim</p>
                <PeopleList people={spgWithoutTeam} linkable={canManage} />
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}
    </>
  );
}

function PharmacyItem({ pharmacy, extra }: { pharmacy: PharmacyBase; extra?: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-2xl border border-line p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
        <Store className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{pharmacy.name}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{pharmacy.address}</span>
        <span className="mt-1 block text-xs text-muted">
          {formatOpeningHours(pharmacy)} · radius absen {pharmacy.radiusM} m
        </span>
        {extra}
      </span>
    </li>
  );
}

function SpgTodayCard() {
  const today = useTodayAttendance();
  const scheduled = (today.data?.pharmacies ?? []).filter((item) => item.schedule || item.checkIn);
  const needsAction = today.data?.pharmacies.some((item) => item.nextAction && item.schedule && !item.schedule.isOff);

  return (
    <Card title="Hari ini" action={<ScanFace className="size-[18px] text-brand-500" />}>
      {!today.data ? (
        <Loading />
      ) : scheduled.length === 0 ? (
        <p className="text-sm text-muted">Tidak ada jadwal hari ini.</p>
      ) : (
        <ul className="space-y-3">
          {scheduled.map((item) => (
            <li key={item.pharmacy.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{item.pharmacy.name}</span>
                <span className="block text-xs text-muted">
                  {item.schedule ? formatScheduleValue(item.schedule) : "Tanpa jadwal"}
                  {item.checkIn ? ` · masuk ${formatTime(item.checkIn.serverAt)}` : ""}
                  {item.checkOut ? ` · pulang ${formatTime(item.checkOut.serverAt)}` : ""}
                </span>
              </span>
              {item.status ? <AttendanceStatusPill status={item.status} lateMinutes={item.lateMinutes} /> : null}
            </li>
          ))}
        </ul>
      )}
      <Link to="/absen" className={cn(needsAction ? buttonStyles.primary : buttonStyles.secondary, "mt-5 flex h-11 w-full")}>
        <ScanFace />
        Buka absen
      </Link>
    </Card>
  );
}

function SpgSummary() {
  const pharmacies = usePharmacies();
  const month = currentMonth();
  const targets = useTargets(month);
  const target = targets.data?.targets[0]?.amount ?? null;

  return (
    <>
      <SpgTodayCard />
      <StatCard
        label={`Target omzet ${formatMonth(month)}`}
        value={target ? formatCurrency(target) : "Belum diatur"}
        icon={Target}
        caption="Omzet dihitung dari penjualan yang disetujui kasir"
      />
      <Card title="Apotek tugas">
        {!pharmacies.data ? (
          <Loading />
        ) : pharmacies.data.length === 0 ? (
          <EmptyState icon={Store}>Anda belum ditempatkan di apotek. Hubungi Super Admin.</EmptyState>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {pharmacies.data.map((pharmacy) => (
              <PharmacyItem key={pharmacy.id} pharmacy={pharmacy} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

/** ABS-02 + KNJ-01 di beranda Team Leader: rencana hari ini vs yang sudah dikunjungi. */
function VisitTodayCard() {
  const today = useVisitToday();
  const data = today.data;
  const visitedPlanned = data?.plan.filter((item) => item.visited).length ?? 0;

  return (
    <Card
      title="Kunjungan hari ini"
      action={
        data ? (
          data.workDay.status === "ACTIVE" ? (
            <Pill tone="green">Sesi kerja aktif</Pill>
          ) : data.workDay.status === "ENDED" ? (
            <Pill tone="gray">Selesai</Pill>
          ) : (
            <Pill tone="blue">Belum mulai</Pill>
          )
        ) : null
      }
    >
      {!data ? (
        <Loading />
      ) : (
        <>
          <p className="text-sm text-muted">
            <span className="text-2xl font-semibold tabular-nums text-ink">{visitedPlanned}</span> dari {data.plan.length} apotek rencana sudah
            dikunjungi · {data.visits.length} kunjungan, {formatDuration(data.totalMinutes)}
          </p>
          {data.openVisit ? (
            <p className="mt-2 text-sm text-ink">
              Sedang di <strong>{data.openVisit.pharmacy.name}</strong> sejak {formatTime(data.openVisit.checkInAt)} WIB
            </p>
          ) : null}
          {data.missingReasons.count > 0 ? (
            <div className="mt-3">
              <Notice>
                {data.missingReasons.count} apotek rencana tidak dikunjungi dan belum diberi alasan.{" "}
                <Link to={`/rencana-kunjungan?tab=evaluasi&minggu=${data.missingReasons.weekStart}`} className="font-semibold underline">
                  Isi alasan
                </Link>
              </Notice>
            </div>
          ) : null}
        </>
      )}
      <Link to="/absen-kunjungan" className={cn(data?.openVisit ? buttonStyles.primary : buttonStyles.secondary, "mt-5 flex h-11 w-full")}>
        <MapPin />
        Buka absen kunjungan
      </Link>
    </Card>
  );
}

function LeaderSummary() {
  const teams = useTeams();
  const monitor = useAttendanceMonitor(todayDate(), { live: true });
  const team = teams.data?.[0];

  if (!teams.data) {
    return <Loading />;
  }

  if (!team) {
    return (
      <>
        <VisitTodayCard />
        <Card title="Tim saya">
          <EmptyState icon={UsersRound}>Anda belum memimpin tim. Hubungi Super Admin.</EmptyState>
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        <VisitTodayCard />
        {monitor.data ? <AttendanceTodayCard summary={monitor.data.summary} link="/tim" /> : null}
      </div>
      <Card title={`${team.name} · ${team.members.length} SPG`}>
        {team.members.length === 0 ? (
          <EmptyState icon={UsersRound}>Belum ada SPG di tim Anda.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {team.members.map((member) => (
              <li key={member.id} className="py-3">
                <span className="block text-sm font-medium text-ink">{member.name}</span>
                <span className="block text-xs text-muted">
                  {member.placements.length > 0
                    ? member.placements.map((placement) => placement.pharmacy.name).join(" · ")
                    : "Belum ditempatkan di apotek"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function KasirSummary() {
  const pharmacies = usePharmacies();
  const pharmacy = pharmacies.data?.[0];

  return (
    <Card title="Apotek Anda">
      {!pharmacies.data ? (
        <Loading />
      ) : pharmacy ? (
        <ul>
          <PharmacyItem
            pharmacy={pharmacy}
            extra={<span className="mt-2 block text-xs text-muted">Laporan penjualan dan retur SPG yang perlu Anda setujui akan tampil di sini.</span>}
          />
        </ul>
      ) : (
        <EmptyState icon={Store}>Akun ini belum terhubung ke apotek.</EmptyState>
      )}
    </Card>
  );
}

/** Ringkasan Beranda sesuai peran (DSB-01); bertambah setiap tahap. */
export function RoleSummary({ user }: { user: AuthUser }) {
  switch (user.role) {
    case "SUPER_ADMIN":
      return <ManagerSummary canManage />;
    case "ADMIN":
      return <ManagerSummary canManage={false} />;
    case "TEAM_LEADER":
      return <LeaderSummary />;
    case "SPG":
      return <SpgSummary />;
    case "KASIR":
      return <KasirSummary />;
  }
}
