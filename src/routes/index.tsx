import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Crosshair, Trophy, Users, Swords, Crown, Zap, Heart } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "ReCorN — Block Strike Competitive" },
    { name: "description", content: "Соревновательная платформа Block Strike: ELO, игроки, матчи и честная игра." },
  ]}),
  component: HomePage,
});

const FEATURES = [
  { icon: Trophy, title: "ELO и уровень", text: "Стартуй с 1000 ELO. Твой уровень растёт вместе с результатами матчей." },
  { icon: Users, title: "Игроки", text: "Находи соперников, открывай профили и сравнивай статистику." },
  { icon: Swords, title: "Матчи", text: "Соревнуйся, следи за историей и строй свой рейтинг." },
];

function HomePage() {
  return <div className="mx-auto max-w-6xl space-y-6">
    <section className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-7 shadow-2xl shadow-black/20 sm:p-10 lg:p-14">
      <div className="absolute -right-32 -top-32 size-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-32 w-72 bg-primary/10 blur-3xl" />
      <div className="grid-bg absolute inset-0 opacity-40" />
      <div className="relative max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-primary"><Crosshair className="size-3.5"/> Block Strike • Competitive</span>
        <h1 className="font-display mt-7 text-4xl font-bold leading-tight sm:text-5xl lg:text-7xl">Играй.<br/><span className="text-primary text-glow-primary">Побеждай.</span><br/>Расти в ELO.</h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">ReCorN — место, где матчи превращаются в рейтинг. Начни с <b className="text-foreground">1000 ELO</b> и докажи свой уровень.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/players" className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/20">Найти игроков <ArrowRight className="size-4"/></Link>
          <Link to="/host" className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/60 px-6 py-3.5 text-sm font-bold transition hover:bg-secondary"><Crown className="size-4"/> Стать хостом</Link>
          <Link to="/support" className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-6 py-3.5 text-sm font-bold text-primary transition hover:bg-primary/10"><Heart className="size-4"/> Поддержать проект</Link>
        </div>
      </div>
      <div className="relative mt-10 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
        {[["1000","ELO старт"],["4","Уровень"],["ELO","Система"],["∞","Матчи"]].map(([v,l])=><div key={l} className="rounded-2xl border border-border bg-background/60 p-4 backdrop-blur"><div className="font-display text-xl font-bold text-primary">{v}</div><div className="mt-1 text-xs text-muted-foreground">{l}</div></div>)}
      </div>
    </section>
    <section className="grid gap-4 md:grid-cols-3">
      {FEATURES.map(({icon:Icon,title,text})=><div key={title} className="group rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"><span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5"/></span><h3 className="mt-5 font-display text-sm font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>)}
    </section>
    <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-bold text-primary"><Zap className="size-4"/> FAIR PLAY</div><h2 className="mt-2 font-display text-xl font-bold">Честная игра — основа ReCorN.</h2><p className="mt-2 text-sm text-muted-foreground">Репорты, хосты и админ-контроль помогают держать соревнования чистыми.</p></div><Link to="/reports" className="shrink-0 rounded-xl border border-border bg-card px-5 py-3 text-sm font-bold">Отправить жалобу</Link></div></section>
  </div>;
}
