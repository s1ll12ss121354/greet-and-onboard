import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Crosshair, Trophy, Users, Swords, Crown, Zap, Heart, Activity, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GreetAndWin — Block Strike Competitive" },
      { name: "description", content: "GreetAndWin — соревновательная платформа Block Strike с ELO, матчами и честной игрой." },
    ],
  }),
  component: HomePage,
});

const FEATURES = [
  { icon: Swords, eyebrow: "01 / MATCH", title: "Играй по рейтингу", text: "Матчмейкинг подбирает соперников по ELO. Чем сильнее серия — тем выше поднимается твой рейтинг." },
  { icon: Trophy, eyebrow: "02 / RANK", title: "Поднимайся в таблице", text: "1000 ELO — стартовая точка и 4 уровень. Результаты матчей формируют твою позицию среди игроков." },
  { icon: ShieldCheck, eyebrow: "03 / FAIR PLAY", title: "Соревнуйся честно", text: "Репорты, хосты и модерация работают вместе, чтобы конкурентная среда оставалась чистой." },
];

function HomePage() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <section className="relative overflow-hidden border border-border bg-card">
        <div className="absolute inset-y-0 right-0 w-[48%] bg-[radial-gradient(circle_at_65%_40%,rgba(180,255,80,.14),transparent_42%)]" />
        <div className="absolute right-8 top-8 hidden text-right lg:block">
          <div className="text-[10px] font-extrabold uppercase tracking-[.3em] text-muted-foreground">NETWORK STATUS</div>
          <div className="mt-2 flex items-center justify-end gap-2 text-xs font-bold">
            <span className="size-2 rounded-full bg-primary shadow-[0_0_14px_rgba(180,255,80,.8)]" /> OPERATIONAL
          </div>
        </div>
        <div className="relative grid min-h-[520px] lg:grid-cols-[1.25fr_.75fr]">
          <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.28em] text-primary">
              <Crosshair className="size-3.5" /> Block Strike / Competitive
            </div>
            <h1 className="mt-7 max-w-4xl font-display text-5xl font-extrabold leading-[.98] tracking-[-.055em] sm:text-6xl lg:text-[82px]">
              Твой матч.<br />
              Твой <span className="text-primary">рейтинг.</span>
            </h1>
            <p className="mt-7 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              GreetAndWin — соревновательная сеть для Block Strike. Начни с <strong className="text-foreground">1000 ELO</strong>, находи игру и доказывай уровень матч за матчем.
            </p>
            <div className="mt-9 flex flex-wrap gap-2.5">
              <Link to="/matchmaking" className="group inline-flex items-center gap-3 bg-primary px-5 py-3.5 text-xs font-extrabold uppercase tracking-wide text-primary-foreground transition hover:brightness-105">
                Найти матч <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <Link to="/players" className="inline-flex items-center gap-3 border border-border bg-background px-5 py-3.5 text-xs font-extrabold uppercase tracking-wide transition hover:border-primary/40 hover:bg-secondary">
                Открыть рейтинг
              </Link>
            </div>
            <div className="mt-12 grid max-w-2xl grid-cols-3 border-y border-border/80">
              <div className="py-4 pr-4">
                <div className="font-display text-2xl font-extrabold">1000</div>
                <div className="mt-1 text-[9px] font-extrabold uppercase tracking-[.18em] text-muted-foreground">Start ELO</div>
              </div>
              <div className="border-l border-border/80 px-4 py-4">
                <div className="font-display text-2xl font-extrabold text-primary">04</div>
                <div className="mt-1 text-[9px] font-extrabold uppercase tracking-[.18em] text-muted-foreground">Start level</div>
              </div>
              <div className="border-l border-border/80 pl-4 py-4">
                <div className="font-display text-2xl font-extrabold">∞</div>
                <div className="mt-1 text-[9px] font-extrabold uppercase tracking-[.18em] text-muted-foreground">Matches</div>
              </div>
            </div>
          </div>

          <div className="relative hidden border-l border-border lg:flex lg:flex-col lg:justify-between p-8">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[.24em] text-muted-foreground">GREET / AND / WIN</div>
              <div className="mt-8 font-display text-[140px] font-extrabold leading-none tracking-[-.1em] text-primary/10">GW</div>
            </div>
            <div className="border-t border-border pt-6">
              <div className="flex items-center gap-3">
                <Activity className="size-4 text-primary" />
                <span className="text-xs font-bold">Competitive infrastructure</span>
              </div>
              <p className="mt-3 max-w-xs text-xs leading-5 text-muted-foreground">
                Рейтинг, лобби, хосты, репорты и модерация собраны в одном пространстве.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-px border border-border bg-border md:grid-cols-3">
        {FEATURES.map(({ icon: Icon, eyebrow, title, text }, index) => (
          <div key={title} className="group bg-card p-6 transition hover:bg-secondary/60 sm:p-8">
            <div className="flex items-center justify-between">
              <Icon className="size-5 text-primary" />
              <span className="text-[9px] font-extrabold uppercase tracking-[.22em] text-muted-foreground">{eyebrow}</span>
            </div>
            <h2 className="mt-14 font-display text-xl font-extrabold tracking-tight">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
            <div className="mt-8 h-px w-full bg-border">
              <div className="h-px w-1/4 bg-primary transition-all duration-500 group-hover:w-full" />
            </div>
            <div className="mt-4 text-[10px] font-extrabold text-muted-foreground">0{index + 1}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-px border border-border bg-border lg:grid-cols-[1.4fr_.6fr]">
        <div className="bg-card p-7 sm:p-9">
          <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.24em] text-primary"><Users className="size-4" /> Community</div>
          <h2 className="mt-4 max-w-2xl font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Не просто профиль.<br />Целая история матчей.</h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Открывай профили игроков, сравнивай ELO, следи за результатами и собирай собственную статистику.</p>
        </div>
        <div className="bg-primary p-7 text-primary-foreground sm:p-9">
          <Heart className="size-5" />
          <h3 className="mt-12 font-display text-xl font-extrabold">Поддержать проект</h3>
          <p className="mt-2 text-sm leading-6 opacity-75">Помоги развивать GreetAndWin и получи приоритет в репортах и заявках.</p>
          <Link to="/support" className="mt-6 inline-flex items-center gap-2 border border-primary-foreground/30 px-4 py-3 text-xs font-extrabold uppercase transition hover:bg-primary-foreground/10">
            Подробнее <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>

      <footer className="flex flex-col gap-2 border-t border-border pt-5 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>GreetAndWin / Block Strike competitive network</span>
        <span>GW-01 · Fair play · ELO</span>
      </footer>
    </div>
  );
}
