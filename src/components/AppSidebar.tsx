import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, BarChart3, Crosshair, Flag, Heart, History, LogIn, Menu, Shield, Swords, User, X, Crown, Send } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";

const NAV_ITEMS = [
  { to: "/", label: "Обзор", en: "Overview", icon: Activity },
  { to: "/matchmaking", label: "Играть", en: "Play", icon: Swords },
  { to: "/players", label: "Рейтинг", en: "Ranking", icon: BarChart3 },
  { to: "/history", label: "Матчи", en: "Matches", icon: History },
  { to: "/profile", label: "Профиль", en: "Profile", icon: User },
];

const EXTRA_ITEMS = [
  { to: "/host", label: "Стать хостом", en: "Become host", icon: Crown },
  { to: "/reports", label: "Репорты", en: "Reports", icon: Flag },
  { to: "/support", label: "Поддержать", en: "Support", icon: Heart },
  { to: "/support-telegram", label: "Поддержка", en: "Support chat", icon: Send },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, roles, profile } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const isStaff = roles.includes("admin") || roles.includes("moderator");

  const nav = [...NAV_ITEMS, ...EXTRA_ITEMS, ...(isStaff ? [{ to: "/admin", label: "Админ", en: "Admin", icon: Shield }] : [])];

  const renderItem = ({ to, label, en, icon: Icon }: typeof nav[number]) => {
    const active = pathname === to || (to !== "/" && pathname.startsWith(to));
    return (
      <Link key={to} to={to} onClick={() => setOpen(false)} className={cn(
        "group inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-extrabold transition",
        active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}>
        <Icon className="size-3.5" />
        <span>{language === "en" ? en : label}</span>
      </Link>
    );
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/80 bg-background/92 backdrop-blur-2xl">
        <div className="mx-auto flex h-[68px] max-w-[1520px] items-center gap-5 px-4 lg:px-7">
          <Link to="/" className="flex shrink-0 items-center gap-3">
            <span className="flex size-9 items-center justify-center bg-foreground text-background">
              <Crosshair className="size-[18px]" />
            </span>
            <div className="hidden sm:block">
              <div className="font-display text-[15px] font-extrabold tracking-[-.03em]">RECORN</div>
              <div className="text-[8px] font-extrabold uppercase tracking-[.22em] text-muted-foreground">Competitive network</div>
            </div>
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center gap-1 xl:flex">
            {NAV_ITEMS.map(renderItem)}
          </nav>

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <button onClick={() => setLanguage(language === "ru" ? "en" : "ru")} className="rounded-lg border border-border px-2.5 py-2 text-[10px] font-extrabold text-muted-foreground hover:text-foreground">
              {language.toUpperCase()}
            </button>
            {user && profile ? (
              <Link to="/profile" className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 hover:bg-secondary">
                <span className="flex size-7 items-center justify-center bg-secondary text-[10px] font-extrabold">{profile.nickname.slice(0,2).toUpperCase()}</span>
                <span className="max-w-28 truncate text-[11px] font-extrabold">{profile.nickname}</span>
                <span className="text-[10px] font-bold text-muted-foreground">{profile.elo}</span>
              </Link>
            ) : (
              <Link to="/auth" className="inline-flex items-center gap-2 bg-foreground px-3.5 py-2 text-[11px] font-extrabold text-background"><LogIn className="size-3.5"/> Войти</Link>
            )}
          </div>

          <button aria-label="Меню" onClick={() => setOpen(!open)} className="rounded-lg border border-border p-2.5 lg:hidden">
            {open ? <X className="size-4"/> : <Menu className="size-4"/>}
          </button>
        </div>

        <div className="hidden border-t border-border/70 xl:block">
          <div className="mx-auto flex max-w-[1520px] items-center gap-1 px-7 py-1.5">
            <span className="mr-2 text-[8px] font-extrabold uppercase tracking-[.22em] text-muted-foreground">Community</span>
            {EXTRA_ITEMS.map(renderItem)}
            <a
              href="https://t.me/RecornCom"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-extrabold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <Send className="size-3.5" />
              <span>{language === "en" ? "Telegram" : "Telegram"}</span>
            </a>
            {isStaff && renderItem({ to: "/admin", label: "Админ", en: "Admin", icon: Shield })}
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-x-0 top-[68px] z-50 border-b border-border bg-background p-3 shadow-2xl lg:hidden">
          <nav className="grid grid-cols-2 gap-1">{nav.map(renderItem)}</nav>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
            <a
              href="https://t.me/RecornCom"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-[10px] font-extrabold text-muted-foreground hover:text-foreground"
            >
              <Send className="size-3.5" />
              Telegram
            </a>
            <button onClick={() => setLanguage(language === "ru" ? "en" : "ru")} className="border border-border px-3 py-2 text-[10px] font-extrabold">{language.toUpperCase()}</button>
          </div>
        </div>
      )}
    </>
  );
}