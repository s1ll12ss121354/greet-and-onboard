import { Link, useRouterState } from "@tanstack/react-router";
import { Home, History, User, Search, Flag, Shield, Crosshair, Crown, LogIn, Heart, Menu, X, Send, Swords, BarChart3 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";

const NAV_ITEMS = [
  { to: "/", label: "Главная", en: "Home", icon: Home },
  { to: "/matchmaking", label: "Матчмейкинг", en: "Matchmaking", icon: Swords },
  { to: "/players", label: "Рейтинг", en: "Leaderboard", icon: BarChart3 },
  { to: "/history", label: "Матчи", en: "Matches", icon: History },
  { to: "/profile", label: "Профиль", en: "Profile", icon: User },
  { to: "/host", label: "Стать хостом", en: "Become host", icon: Crown },
  { to: "/reports", label: "Репорты", en: "Reports", icon: Flag },
  { to: "/support", label: "Поддержать", en: "Support", icon: Heart },
  { to: "/support-telegram", label: "Поддержка", en: "Support chat", icon: Send },
  { to: "/admin", label: "Админ-консоль", en: "Admin console", icon: Shield },
  { to: "/auth", label: "Войти", en: "Sign in", icon: LogIn },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, roles, profile } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  const items = NAV_ITEMS.filter((i) =>
    i.to === "/auth"
      ? !user
      : i.to === "/admin"
        ? (roles.includes("admin") || roles.includes("moderator"))
        : true
  );

  const Nav = () => (
    <nav className="flex flex-col gap-1 px-3 py-4">
      <div className="px-3 pb-2 text-[10px] font-extrabold uppercase tracking-[.22em] text-muted-foreground">
        Navigation
      </div>
      {items.map(({ to, label, en, icon: Icon }) => {
        const active = pathname === to || (to !== "/" && pathname.startsWith(to));
        return (
          <Link
            key={to}
            to={to}
            onClick={() => setOpen(false)}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[13px] font-bold transition-all",
              active
                ? "bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(170,255,80,.14)]"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Icon className={cn("size-4 transition-transform group-hover:translate-x-0.5", active && "text-primary-foreground")} />
            <span className="truncate">{language === "en" ? en : label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <header className="mobile-top fixed inset-x-0 top-0 z-50 hidden h-16 items-center justify-between border-b px-4 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Crosshair className="size-4" />
          </span>
          <span className="font-display text-sm font-extrabold tracking-tight">
            Greet<span className="text-primary">And</span>Win
          </span>
        </Link>
        <button aria-label="Меню" onClick={() => setOpen(!open)} className="rounded-md p-2 hover:bg-secondary">
          {open ? <X /> : <Menu />}
        </button>
      </header>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r transition-transform duration-200 lg:w-64",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <Link to="/" className="border-b border-border/70 px-5 py-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[0_0_32px_rgba(170,255,80,.18)]">
              <Crosshair className="size-5" />
            </span>
            <div>
              <div className="font-display text-base font-extrabold tracking-tight">
                Greet<span className="text-primary">And</span>Win
              </div>
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[.2em] text-muted-foreground">
                Block Strike competitive
              </div>
            </div>
          </div>
        </Link>

        <Nav />

        {user && profile && (
          <Link to="/profile" className="mx-3 mb-3 mt-auto rounded-lg border border-border bg-card/60 p-3 transition hover:border-primary/30 hover:bg-secondary">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-extrabold text-primary">
                {profile.nickname.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-extrabold">{profile.nickname}</div>
                <div className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                  {profile.elo} ELO · уровень {levelForElo(profile.elo)}
                </div>
              </div>
              <User className="size-3.5 text-muted-foreground" />
            </div>
          </Link>
        )}

        <div className="border-t border-border/70 px-5 py-4">
          <div className="mb-2 text-[9px] font-extrabold uppercase tracking-[.2em] text-muted-foreground">Interface</div>
          <div className="flex rounded-md border border-border bg-card/50 p-1">
            <button onClick={() => setLanguage("ru")} className={cn("flex-1 rounded px-2 py-1.5 text-[10px] font-extrabold", language === "ru" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>RU</button>
            <button onClick={() => setLanguage("en")} className={cn("flex-1 rounded px-2 py-1.5 text-[10px] font-extrabold", language === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>EN</button>
          </div>
          <div className="mt-3 text-[9px] font-bold uppercase tracking-[.16em] text-muted-foreground">GW / 01 · Competitive network</div>
        </div>
      </aside>

      {open && (
        <button aria-label="Закрыть меню" className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />
      )}
    </>
  );
}

function levelForElo(elo: number) {
  const caps = [500, 750, 900, 1050, 1200, 1350, 1530, 1750, 2000];
  const i = caps.findIndex((c) => elo <= c);
  return i === -1 ? 10 : i + 1;
}
