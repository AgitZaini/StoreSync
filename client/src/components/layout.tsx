import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CheckCheck,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useDismiss } from "../hooks/use-dismiss";
import { formatDateTime } from "../lib/format";
import { cn } from "../lib/utils";
import type { NotificationItem } from "../types/notification";
import { iconButtonClass } from "./styles";
import { Avatar, Logo } from "./ui";

export type NavItem = {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  group: "main" | "manage";
  /** Menu yang modulnya belum dibangun: tampil redup dengan label "Segera". */
  disabled?: boolean;
  disabledHint?: string;
  badge?: number;
  badgeTone?: "green" | "orange";
};

export type StatusRow = { icon: LucideIcon; label: string; dot: string };

function SoonBadge({ className }: { className?: string }) {
  return (
    <span className={cn("rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-subtle", className)}>
      Segera
    </span>
  );
}

export function Sidebar({
  items,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  statusRows,
  account,
  onLogout,
}: {
  items: NavItem[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  statusRows: StatusRow[];
  account: { title: string; description: string };
  onLogout: () => void;
}) {
  const groups = [items.filter((item) => item.group === "main"), items.filter((item) => item.group === "manage")].filter(
    (group) => group.length > 0,
  );
  const hideWhenCollapsed = collapsed ? "lg:hidden" : "";
  const itemClass = "relative flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition";

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onCloseMobile}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-line bg-white transition-[translate,width] duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed && "lg:w-[84px]",
        )}
      >
        <div className={cn("flex h-[72px] shrink-0 items-center justify-between px-5", collapsed && "lg:justify-center lg:px-0")}>
          <Logo className={hideWhenCollapsed} />
          <button
            type="button"
            onClick={onCloseMobile}
            className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-canvas hover:text-ink lg:hidden"
            aria-label="Tutup menu"
          >
            <X className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="hidden size-8 place-items-center rounded-lg text-subtle hover:bg-canvas hover:text-ink lg:grid"
            aria-label={collapsed ? "Buka sidebar" : "Ciutkan sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
          {groups.map((group, groupIndex) => (
            <div key={groupIndex} className={cn("space-y-1", groupIndex > 0 && "mt-4 border-t border-line pt-4")}>
              {group.map((item) => {
                const Icon = item.icon;

                if (item.disabled) {
                  return (
                    <div
                      key={item.key}
                      title={item.disabledHint ?? item.label}
                      aria-disabled="true"
                      className={cn(itemClass, "cursor-default text-gray-400", collapsed && "lg:justify-center lg:px-0")}
                    >
                      <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
                      <span className={cn("flex-1 truncate text-left", hideWhenCollapsed)}>{item.label}</span>
                      <SoonBadge className={hideWhenCollapsed} />
                    </div>
                  );
                }

                return (
                  <NavLink
                    key={item.key}
                    to={item.path}
                    end={item.path === "/"}
                    title={collapsed ? item.label : undefined}
                    onClick={onCloseMobile}
                    className={({ isActive }) =>
                      cn(
                        itemClass,
                        isActive ? "bg-brand-50 text-brand-600" : "text-gray-600 hover:bg-canvas hover:text-ink",
                        collapsed && "lg:justify-center lg:px-0",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive ? (
                          <span className="absolute -left-4 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-600" />
                        ) : null}
                        <Icon className="size-[18px] shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
                        <span className={cn("flex-1 truncate text-left", hideWhenCollapsed)}>{item.label}</span>
                        {item.badge ? (
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums",
                              item.badgeTone === "orange" ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600",
                              collapsed && "lg:absolute lg:right-0.5 lg:top-0.5 lg:px-1 lg:text-[10px]",
                            )}
                          >
                            {item.badge}
                          </span>
                        ) : null}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="space-y-1 px-4 pb-4">
          {statusRows.map((row) => (
            <div
              key={row.label}
              title={collapsed ? row.label : undefined}
              className={cn("flex h-9 items-center gap-3 px-3 text-sm text-gray-600", collapsed && "lg:justify-center lg:px-0")}
            >
              <span className="relative">
                <row.icon className="size-[18px]" strokeWidth={1.8} />
                <span className={cn("absolute -right-0.5 -top-0.5 size-2 rounded-full ring-2 ring-white", row.dot)} />
              </span>
              <span className={cn("truncate", hideWhenCollapsed)}>{row.label}</span>
            </div>
          ))}

          <div
            className={cn(
              "relative mt-3 overflow-hidden rounded-2xl bg-linear-to-br from-navy-900 via-navy-950 to-navy-950 p-4 text-white",
              hideWhenCollapsed,
            )}
          >
            <div className="dot-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
            <div className="pointer-events-none absolute -bottom-16 -left-10 size-40 rounded-full bg-brand-600/50 blur-3xl" />
            <div className="relative">
              <span className="grid size-8 place-items-center rounded-lg bg-white/15 ring-1 ring-white/20">
                <ShieldCheck className="size-4" />
              </span>
              <p className="mt-3 text-sm font-semibold">{account.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/60">{account.description}</p>
              <button
                type="button"
                onClick={onLogout}
                className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-b from-brand-500 to-brand-600 text-xs font-semibold shadow-button transition hover:from-brand-600 hover:to-brand-700"
              >
                <LogOut className="size-3.5" />
                Keluar
              </button>
            </div>
          </div>
          {collapsed ? (
            <button
              type="button"
              onClick={onLogout}
              title="Keluar"
              className="mt-3 hidden h-10 w-full place-items-center rounded-xl bg-navy-950 text-white hover:bg-navy-900 lg:grid"
            >
              <LogOut className="size-4" />
            </button>
          ) : null}
        </div>
      </aside>
    </>
  );
}

/** Navigasi bawah untuk layar HP; tombol terakhir membuka menu lengkap. */
export function BottomNav({ items, onOpenMenu }: { items: NavItem[]; onOpenMenu: () => void }) {
  const itemClass =
    "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-medium leading-none transition";

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <div
        className="mx-auto grid h-16 max-w-md gap-1 px-2"
        style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const Icon = item.icon;

          if (item.disabled) {
            return (
              <div key={item.key} aria-disabled="true" title={item.disabledHint} className={cn(itemClass, "text-gray-300")}>
                <Icon className="size-5" strokeWidth={1.8} />
                <span className="w-full truncate text-center">{item.label}</span>
              </div>
            );
          }

          return (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) => cn(itemClass, isActive ? "text-brand-600" : "text-gray-500 hover:text-ink")}
            >
              {({ isActive }) => (
                <>
                  <Icon className="size-5" strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="w-full truncate text-center">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
        <button type="button" onClick={onOpenMenu} className={cn(itemClass, "text-gray-500 hover:text-ink")}>
          <Menu className="size-5" strokeWidth={1.8} />
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
}

export function SearchBox({ menus }: { menus: NavItem[] }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

  useDismiss(rootRef, open, () => setOpen(false));

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const needle = query.trim().toLowerCase();
  const results = needle ? menus.filter((menu) => menu.label.toLowerCase().includes(needle)) : [];
  const firstAvailable = results.find((menu) => !menu.disabled);

  const choose = (menu: NavItem) => {
    navigate(menu.path);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={rootRef} className="relative w-full max-w-[340px]">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && firstAvailable) {
            choose(firstAvailable);
          }
        }}
        placeholder="Cari menu..."
        className="h-10 w-full rounded-full border border-line bg-white pl-10 pr-14 text-sm text-ink outline-none transition placeholder:text-subtle focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line bg-canvas px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted sm:block">
        {isMac ? "⌘K" : "Ctrl K"}
      </kbd>

      {open && needle ? (
        <div className="absolute inset-x-0 top-12 z-40 overflow-hidden rounded-2xl border border-line bg-white p-2 shadow-pop">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">Tidak ada menu “{query.trim()}”.</p>
          ) : (
            results.map((menu) => (
              <button
                key={menu.key}
                type="button"
                disabled={menu.disabled}
                onClick={() => choose(menu)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink hover:bg-canvas disabled:cursor-default disabled:text-gray-400 disabled:hover:bg-transparent"
              >
                <menu.icon className="size-4 text-muted" />
                <span className="flex-1">{menu.label}</span>
                {menu.disabled ? <SoonBadge /> : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export function NotificationMenu({
  notifications,
  onOpenNotification,
  onMarkAllRead,
}: {
  notifications: NotificationItem[];
  onOpenNotification: (notification: NotificationItem) => void;
  onMarkAllRead: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  useDismiss(rootRef, open, () => setOpen(false));

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={iconButtonClass}
        aria-label={unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : "Notifikasi"}
      >
        <Bell className="size-[18px]" strokeWidth={1.8} />
        {unreadCount > 0 ? (
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-red-500 ring-2 ring-white" />
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-x-4 top-[76px] z-40 overflow-hidden rounded-2xl border border-line bg-white shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[360px]">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5">
            <p className="text-sm font-semibold text-ink">
              Notifikasi
              {unreadCount > 0 ? (
                <span className="ml-2 rounded-md bg-brand-50 px-1.5 py-0.5 text-xs text-brand-600">{unreadCount} baru</span>
              ) : null}
            </p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                <CheckCheck className="size-3.5" />
                Tandai dibaca
              </button>
            ) : null}
          </div>
          <div className="max-h-96 divide-y divide-line overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">Belum ada notifikasi.</p>
            ) : (
              notifications.slice(0, 8).map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onOpenNotification(notification);
                  }}
                  className={cn(
                    "flex w-full gap-3 px-4 py-3 text-left transition hover:bg-canvas",
                    !notification.readAt && "bg-brand-50/40",
                  )}
                >
                  <span
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", notification.readAt ? "bg-gray-200" : "bg-brand-500")}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{notification.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">{notification.message}</span>
                    <span className="mt-1 block text-[11px] text-subtle">{formatDateTime(notification.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
          <Link
            to="/notifikasi"
            onClick={() => setOpen(false)}
            className="block border-t border-line px-4 py-3 text-center text-xs font-semibold text-brand-600 hover:bg-canvas"
          >
            Lihat semua notifikasi
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function UserMenu({
  name,
  subtitle,
  roleLabel,
  initials,
  onLogout,
}: {
  name: string;
  subtitle: string;
  roleLabel: string;
  initials: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useDismiss(rootRef, open, () => setOpen(false));

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="rounded-full ring-2 ring-white outline-none transition hover:ring-brand-100 focus-visible:ring-brand-200"
        aria-label="Menu akun"
      >
        <Avatar initials={initials} className="size-10 text-sm" />
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-40 w-64 overflow-hidden rounded-2xl border border-line bg-white p-2 shadow-pop">
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <Avatar initials={initials} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{name}</p>
              <p className="truncate text-xs text-muted">{subtitle}</p>
            </div>
          </div>
          <div className="mx-2.5 mb-2 rounded-xl bg-canvas px-3 py-2 text-xs text-muted">
            Masuk sebagai <span className="font-semibold text-ink">{roleLabel}</span>
          </div>
          <Link
            to="/profil"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink hover:bg-canvas"
          >
            <UserRound className="size-4 text-muted" />
            Profil & kata sandi
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut className="size-4" />
            Keluar
          </button>
        </div>
      ) : null}
    </div>
  );
}
