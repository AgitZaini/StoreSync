import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, CheckCheck, LogOut, Package, PanelLeftClose, PanelLeftOpen, Search, ShieldCheck, X } from "lucide-react";
import { useDismiss } from "../hooks/use-dismiss";
import { formatDateTime } from "../lib/format";
import { cn } from "../lib/utils";
import type { NotificationItem } from "../types/notification";
import type { Product } from "../types/product";
import { iconButtonClass } from "./styles";
import { Avatar, Logo, LogoMark, StockBadge } from "./ui";

export type NavItem<Key extends string = string> = {
  key: Key;
  label: string;
  icon: LucideIcon;
  group: "main" | "manage";
  badge?: number;
  badgeTone?: "green" | "orange";
};

export type StatusRow = { icon: LucideIcon; label: string; dot: string };

export function Sidebar<Key extends string>({
  items,
  activeKey,
  onSelect,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  statusRows,
  account,
  onLogout,
}: {
  items: NavItem<Key>[];
  activeKey: Key;
  onSelect: (key: Key) => void;
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
                const isActive = item.key === activeKey;
                const Icon = item.icon;

                return (
                  <button
                    key={item.key}
                    type="button"
                    title={collapsed ? item.label : undefined}
                    onClick={() => onSelect(item.key)}
                    className={cn(
                      "relative flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
                      isActive ? "bg-brand-50 text-brand-600" : "text-gray-600 hover:bg-canvas hover:text-ink",
                      collapsed && "lg:justify-center lg:px-0",
                    )}
                  >
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
                  </button>
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

export function SearchBox<Key extends string>({
  menus,
  products,
  productMenuKey,
  onNavigate,
}: {
  menus: NavItem<Key>[];
  products: Product[];
  productMenuKey: Key | null;
  onNavigate: (key: Key) => void;
}) {
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
  const menuResults = needle ? menus.filter((menu) => menu.label.toLowerCase().includes(needle)) : [];
  const productResults = needle
    ? products
        .filter((product) => product.name.toLowerCase().includes(needle) || product.sku.toLowerCase().includes(needle))
        .slice(0, 5)
    : [];
  const firstTarget = menuResults[0]?.key ?? (productResults.length > 0 ? productMenuKey : null);

  const choose = (key: Key) => {
    onNavigate(key);
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
          if (event.key === "Enter" && firstTarget) {
            choose(firstTarget);
          }
        }}
        placeholder="Cari menu atau produk..."
        className="h-10 w-full rounded-full border border-line bg-white pl-10 pr-14 text-sm text-ink outline-none transition placeholder:text-subtle focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line bg-canvas px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted sm:block">
        {isMac ? "⌘K" : "Ctrl K"}
      </kbd>

      {open && needle ? (
        <div className="absolute inset-x-0 top-12 z-40 overflow-hidden rounded-2xl border border-line bg-white p-2 shadow-pop">
          {menuResults.length === 0 && productResults.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">Tidak ada hasil untuk “{query.trim()}”.</p>
          ) : null}
          {menuResults.length > 0 ? (
            <div>
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">Menu</p>
              {menuResults.map((menu) => (
                <button
                  key={menu.key}
                  type="button"
                  onClick={() => choose(menu.key)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink hover:bg-canvas"
                >
                  <menu.icon className="size-4 text-muted" />
                  {menu.label}
                </button>
              ))}
            </div>
          ) : null}
          {productResults.length > 0 ? (
            <div>
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">Produk</p>
              {productResults.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  disabled={!productMenuKey}
                  onClick={() => productMenuKey && choose(productMenuKey)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-canvas disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-canvas text-muted">
                    <Package className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{product.name}</span>
                    <span className="block text-xs text-muted">
                      {product.sku} · stok {product.stockQuantity} {product.unit}
                    </span>
                  </span>
                  <StockBadge status={product.stockStatus} />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function NotificationMenu({
  notifications,
  onMarkAllRead,
}: {
  notifications: NotificationItem[];
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
        aria-label="Notifikasi"
      >
        <Bell className="size-[18px]" strokeWidth={1.8} />
        {unreadCount > 0 ? (
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-red-500 ring-2 ring-white" />
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-40 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-white shadow-pop">
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
              notifications.map((notification) => (
                <div key={notification.id} className={cn("flex gap-3 px-4 py-3", !notification.readAt && "bg-brand-50/40")}>
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      notification.readAt ? "bg-gray-200" : "bg-brand-500",
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{notification.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{notification.message}</p>
                    <p className="mt-1 text-[11px] text-subtle">{formatDateTime(notification.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function UserMenu({
  name,
  email,
  roleLabel,
  initials,
  onLogout,
}: {
  name: string;
  email: string;
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
              <p className="truncate text-xs text-muted">{email}</p>
            </div>
          </div>
          <div className="mx-2.5 mb-2 flex items-center gap-2 rounded-xl bg-canvas px-3 py-2 text-xs text-muted">
            <LogoMark className="size-4" />
            Masuk sebagai <span className="font-semibold text-ink">{roleLabel}</span>
          </div>
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
