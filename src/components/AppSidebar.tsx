import { Link, useRouterState } from "@tanstack/react-router";
import { Home, History, User, Search, Flag, Shield, Crosshair, Crown, LogIn, Heart, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";

const NAV_ITEMS = [
  { to: "/", label: "Главная", en: "Home", icon: Home },
  { to: "/matchmaking", label: "Поиск игры", en: "Find game", icon: Crosshair },
  { to: "/history", label: "История", en: "History", icon: History },
  { to: "/profile", label: "Профиль", en: "Profile", icon: User },
  { to: "/players", label: "Игроки", en: "Players", icon: Search },
  { to: "/host", label: "Стать хостом", en: "Become host", icon: Crown },
  { to: "/reports", label: "Жалобы", en: "Reports", icon: Flag },
  { to: "/support", label: "Поддержать проект", en: "Support project", icon: Heart },
  { to: "/admin", label: "Админ-панель", en: "Admin", icon: Shield },
  { to: "/auth", label: "Вход", en: "Login", icon: LogIn },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, roles } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const items = NAV_ITEMS.filter((i) =>
    i.to === "/auth" ? !user : i.to === "/admin" ? (roles.includes("admin") || roles.includes("moderator")) : true
  );

  const Nav = () => (
    <nav className="flex flex-col gap-1 p-3">
      {items.map(({ to, label, en, icon: Icon }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            onClick={() => setOpen(false)}
            className={cn(
              "relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all",
              active
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
            )}
            <Icon className={cn("size-4.5", active && "text-primary")} />
            {language === "en" ? en : label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <header className="mobile-top fixed inset-x-0 top-0 z-50 hidden h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary">
            <Crosshair className="size-4 text-primary-foreground" />
          </span>
          <span className="font-display text-sm font-bold">Re<span className="text-primary">Cor</span>N</span>
        </Link>
        <button aria-label="Меню" onClick={() => setOpen(!open)} className="rounded-lg p-2 hover:bg-secondary">
          {open ? <X /> : <Menu />}
        </button>
      </header>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-background/95 backdrop-blur-xl transition-transform duration-200 lg:w-64",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <Link to="/" className="flex items-center gap-3 px-6 pb-8 pt-7">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
            <Crosshair className="size-5 text-primary-foreground" />
          </span>
          <span className="font-display text-xl font-bold">Re<span className="text-primary">Cor</span>N</span>
        </Link>
        <Nav />
        <div className="mt-auto px-6 pb-4">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Language</div>
          <div className="flex rounded-lg border border-border p-1">
            <button onClick={() => setLanguage("ru")} className={cn("flex-1 rounded px-2 py-1 text-xs font-bold", language === "ru" && "bg-primary text-primary-foreground")}>RU</button>
            <button onClick={() => setLanguage("en")} className={cn("flex-1 rounded px-2 py-1 text-xs font-bold", language === "en" && "bg-primary text-primary-foreground")}>EN</button>
          </div>
        </div>
        <div className="px-6 pb-6 text-xs text-muted-foreground">Block Strike • Competitive</div>
      </aside>

      {open && (
        <button aria-label="Закрыть меню" className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />
      )}
    </>
  );
}
