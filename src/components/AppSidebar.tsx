import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  History,
  User,
  Search,
  Flag,
  Shield,
  Crosshair,
  Crown,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const NAV_ITEMS = [
  { to: "/", label: "Главная", icon: Home },
  { to: "/history", label: "История", icon: History },
  { to: "/profile", label: "Профиль", icon: User },
  { to: "/players", label: "Найти игрока", icon: Search },
  { to: "/host", label: "Заявка на хоста", icon: Crown },
  { to: "/auth", label: "Вход", icon: LogIn },
  { to: "/reports", label: "Жалобы", icon: Flag },
  { to: "/admin", label: "Админ-панель", icon: Shield },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, roles } = useAuth();
  const items = NAV_ITEMS.filter((i) => (i.to === "/auth" ? !user : i.to === "/admin" ? roles.includes("admin") : true));

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-background">
      <Link to="/" className="flex items-center gap-3 px-6 pt-6 pb-8">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary">
          <Crosshair className="size-5 text-primary-foreground" strokeWidth={2.5} />
        </span>
        <span className="font-display text-xl font-bold tracking-tight">
          Re<span className="text-primary">Cor</span>N
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Icon className={cn("size-4.5", active && "text-primary")} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-6 pb-6 text-xs text-muted-foreground">
        ReCorN — Block Strike
      </div>
    </aside>
  );
}
