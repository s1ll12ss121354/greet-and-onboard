import { createFileRoute } from "@tanstack/react-router";
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
      { title: "Профиль — ReCorN" },
      { name: "description", content: "Профиль игрока ReCorN: статистика, ELO и история матчей Block Strike." },
      { property: "og:title", content: "Профиль — ReCorN" },
      { property: "og:description", content: "Статистика, ELO и история матчей игрока Block Strike." },
    ],
  }),
  component: ProfilePage,
});

const PLAYER = {
  nickname: "isy_hesy09",
  level: 0,
  elo: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  matches: 0,
};

const STATS = [
  { label: "Победы", value: PLAYER.wins, icon: Trophy, valueClass: "text-success" },
  { label: "Поражения", value: PLAYER.losses, icon: Skull, valueClass: "text-destructive" },
  { label: "Win Rate", value: `${PLAYER.winRate}%`, icon: Percent, valueClass: "text-foreground" },
  { label: "Матчи", value: PLAYER.matches, icon: Gamepad2, valueClass: "text-foreground" },
];

function ProfilePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <section className="banner-gradient overflow-hidden rounded-2xl border border-border">
        <div className="grid-bg h-28" />
        <div className="flex flex-col gap-6 px-6 pb-6 lg:flex-row lg:items-end lg:px-8">
          <div className="-mt-14 flex items-end gap-5">
            <div className="flex size-28 shrink-0 items-center justify-center rounded-2xl border-2 border-primary bg-secondary font-display text-3xl font-bold text-primary">
              {PLAYER.nickname.slice(0, 2).toUpperCase()}
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-3">
                <h1 className="font-display text-2xl font-bold lg:text-3xl">{PLAYER.nickname}</h1>
                <span className="rounded-md border border-primary/50 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
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
              <div className="font-display text-4xl font-bold text-primary text-glow-primary">{PLAYER.elo}</div>
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
