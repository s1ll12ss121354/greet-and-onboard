import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Trophy,
  Skull,
  Percent,
  Gamepad2,
  ImageIcon,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Профиль — GreetAndWin" },
      { name: "description", content: "Профиль игрока GreetAndWin: статистика, ELO и история матчей Block Strike." },
      { property: "og:title", content: "Профиль — GreetAndWin" },
      { property: "og:description", content: "Статистика, ELO и история матчей игрока Block Strike." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, roles, loading, user } = useAuth();
  if (loading) return <div className="text-muted-foreground">Загрузка...</div>;
  if (!user || !profile)
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
        <p>Войдите или зарегистрируйтесь по нику Roblox.</p>
        <Link to="/auth" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Войти</Link>
      </div>
    );
  const matches = profile.wins + profile.losses;
  const PLAYER = { nickname: profile.nickname, level: faceitLevel(profile.elo), elo: profile.elo, wins: profile.wins, losses: profile.losses, matches, winRate: matches ? Math.round((profile.wins / matches) * 100) : 0 };
  const STATS = [
    { label: "Победы", value: PLAYER.wins, icon: Trophy, valueClass: "text-success" },
    { label: "Поражения", value: PLAYER.losses, icon: Skull, valueClass: "text-destructive" },
    { label: "Win Rate", value: `${PLAYER.winRate}%`, icon: Percent, valueClass: "text-foreground" },
    { label: "Матчи", value: PLAYER.matches, icon: Gamepad2, valueClass: "text-foreground" },
  ];
  return (
    <div className="mx-auto max-w-5xl">
      <section className="overflow-hidden border border-border bg-card">
        <div className="h-24 border-b border-border bg-[radial-gradient(circle_at_80%_20%,rgba(180,255,80,.14),transparent_38%)]" />
        <div className="flex flex-col gap-6 px-6 pb-6 lg:flex-row lg:items-end lg:px-8">
          <div className="-mt-12 flex items-end gap-5">
            <div className="flex size-24 shrink-0 items-center justify-center rounded-md border border-primary/50 bg-primary/10 font-display text-2xl font-extrabold text-primary shadow-[0_0_35px_rgba(180,255,80,.12)]">
              {PLAYER.nickname.slice(0, 2).toUpperCase()}
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-3">
                <h1 className="font-display text-2xl font-bold lg:text-3xl">{PLAYER.nickname}</h1>
                <span className="border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-primary">
                  LVL {PLAYER.level}
                </span>
              </div>
              <a
                href="#"
                className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                Профиль Block Strike
                <ExternalLink className="size-3.5" />
              </a>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {roles.map((r) => <span key={r} className="rounded-sm bg-primary/10 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-primary">{r}</span>)}
                <button onClick={() => supabase.auth.signOut()} className="text-muted-foreground hover:text-destructive">Выйти</button>
              </div>
            </div>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-between gap-4">
            <div className="flex gap-2">
              <button className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent">
                <ImageIcon className="size-4" />
                Изменить баннер
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent">
                <RefreshCw className="size-4" />
                Обновить аватар
              </button>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">ELO</div>
              <div className="font-display text-5xl font-extrabold tracking-tight text-primary text-glow-primary">{PLAYER.elo}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map(({ label, value, icon: Icon, valueClass }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {label}
              </span>
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <div className={`font-display mt-3 text-3xl font-bold ${valueClass}`}>{value}</div>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide">История матчей</h2>
        <div className="grid-bg mt-4 flex h-40 items-center justify-center rounded-2xl border border-border bg-card">
          <p className="text-sm text-muted-foreground">У игрока пока нет матчей.</p>
        </div>
      </section>
    </div>
  );
}

function faceitLevel(elo: number) {
  const caps = [500, 750, 900, 1050, 1200, 1350, 1530, 1750, 2000];
  const i = caps.findIndex((c) => elo <= c);
  return i === -1 ? 10 : i + 1;
}
