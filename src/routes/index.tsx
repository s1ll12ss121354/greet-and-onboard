import { createFileRoute, Link } from "@tanstack/react-router";
import { Crosshair, Trophy, Users, Swords, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ReCorN — платформа для игроков Block Strike" },
      { name: "description", content: "ReCorN — профили, статистика, матчи и заявки для игроков Block Strike." },
      { property: "og:title", content: "ReCorN — платформа для игроков Block Strike" },
      { property: "og:description", content: "Профили, статистика, матчи и заявки для игроков Block Strike." },
    ],
  }),
  component: HomePage,
});

const FEATURES = [
  {
    icon: Trophy,
    title: "Рейтинг и ELO",
    text: "Отслеживай свой рейтинг, победы и винрейт в каждом матче.",
  },
  {
    icon: Users,
    title: "Профили игроков",
    text: "Находи игроков по нику и смотри их статистику Block Strike.",
  },
  {
    icon: Swords,
    title: "Заявки на матчи",
    text: "Подавай заявку, участвуй в матчах и поднимайся в рейтинге.",
  },
];

function HomePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <section className="grid-bg banner-gradient relative overflow-hidden rounded-2xl border border-border px-8 py-16 lg:px-14 lg:py-20">
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            <Crosshair className="size-3.5" />
            Block Strike
          </div>
          <h1 className="font-display mt-6 text-4xl font-bold leading-tight lg:text-6xl">
            Re<span className="text-primary text-glow-primary">Cor</span>N
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground lg:text-lg">
            Платформа для игроков Block Strike: профили, статистика, история
            матчей и рейтинг ELO. Докажи, что ты лучший.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/apply"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Подать заявку
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/players"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              Найти игрока
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15">
              <Icon className="size-5 text-primary" />
            </span>
            <h3 className="mt-4 text-base font-bold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
