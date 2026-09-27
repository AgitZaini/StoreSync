import { Suspense, useState } from "react";
import { Server } from "lucide-react";
import { Link, Outlet } from "react-router-dom";
import { useCurrentUser, useAuth } from "../features/auth/auth-context";
import { useIdleLogout } from "../features/auth/use-idle-logout";
import { useMarkAllNotificationsRead, useNotifications } from "../features/notifications/notifications-api";
import { useOpenNotification } from "../features/notifications/use-open-notification";
import { formatPhone, getInitials } from "../lib/format";
import { useApiHealth } from "../lib/health";
import { roleLabels } from "../lib/roles";
import { cn } from "../lib/utils";
import { roleNavigation, toNavItem } from "../routes/navigation";
import { BottomNav, NotificationMenu, SearchBox, Sidebar, UserMenu } from "./layout";
import { LogoMark, Spinner } from "./ui";

export function AppShell() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const health = useApiHealth();
  const notifications = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();
  const openNotification = useOpenNotification();

  useIdleLogout();

  const entries = roleNavigation[user.role];
  const navItems = entries.map(toNavItem);
  const bottomNavItems = entries
    .filter((entry) => entry.mobilePrimary)
    .slice(0, 4)
    .map((entry) => ({ ...toNavItem(entry), label: entry.shortLabel ?? entry.label }));
  const roleLabel = roleLabels[user.role];
  const handleLogout = () => void logout();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Sidebar
        items={navItems}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        statusRows={[{ icon: Server, label: health.label, dot: health.dot }]}
        account={{ title: `Mode ${roleLabel}`, description: user.name }}
        onLogout={handleLogout}
      />

      <div className={cn("min-w-0 transition-[padding] duration-200", sidebarCollapsed ? "lg:pl-[84px]" : "lg:pl-[264px]")}>
        <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:h-[72px] lg:px-8">
            <Link to="/" className="flex items-center gap-2 lg:hidden" aria-label="Beranda">
              <LogoMark className="size-7" />
              <span className="text-[17px] font-bold tracking-tight text-ink">StoreSync</span>
            </Link>
            <div className="hidden w-full max-w-[340px] lg:block">
              <SearchBox menus={navItems} />
            </div>
            <div className="ml-auto flex items-center gap-2.5">
              <NotificationMenu
                notifications={notifications.data ?? []}
                onOpenNotification={openNotification}
                onMarkAllRead={() => markAllRead.mutate()}
              />
              <UserMenu
                name={user.name}
                subtitle={formatPhone(user.phone)}
                roleLabel={roleLabel}
                initials={getInitials(user.name)}
                onLogout={handleLogout}
              />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1480px] space-y-5 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:py-8">
          <Suspense
            fallback={
              <div className="grid place-items-center py-20">
                <Spinner />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>

      <BottomNav items={bottomNavItems} onOpenMenu={() => setMobileNavOpen(true)} />
    </div>
  );
}
