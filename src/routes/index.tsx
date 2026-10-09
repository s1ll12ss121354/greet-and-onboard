import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUpRight, BarChart3, Check, ChevronRight, Crosshair, Heart, Radio, ShieldCheck, Swords, Trophy, Users, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RECORN — Blox Strike Competitive" },
      { name: "description", content: "RECORN — соревновательная платформа Blox Strike с ELO, матчами и честной игрой." },
    ],
  }),
  component: HomePage,
});

const FEATURES = [
  { icon: Swords, number: "01", title: "MATCHMAKING", text: "Ищи игру по ELO, заходи в лобби и проходи ready-check перед матчем.", to: "/matchmaking" },
  { icon: BarChart3, number: "02", title: "RANKING", text: "Твой рейтинг живёт в общей таблице. 1000 ELO — старт и 4 уровень.", to: "/players" },
  { icon: ShieldCheck, number: "03", title: "FAIR PLAY", text: "Репорты, модерация и хосты объединены в одну систему контроля.", to: "/reports" },
];

function HomePage() {
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  useEffect(() => {
    // Supabase Presence counts visitors currently connected to the live site.
    const presenceKey = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel("recorn-site-online", {
      config: { presence: { key: presenceKey } },
    });

    const updateCount = () => {
      const presence = channel.presenceState();
      const count = Object.values(presence).reduce(
        (total, visitors) => total + visitors.length,
        0,
      );
      setOnlineCount(count);
    };

    channel
      .on("presence", { event: "sync" }, updateCount)
      .on("presence", { event: "join" }, updateCount)
      .on("presence", { event: "leave" }, updateCount)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ online_at: new Date().toISOString() });
          updateCount();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="mx-auto max-w-[1420px] space-y-4">
      <section className="relative overflow-hidden border border-border bg-card">
        <div className="absolute right-0 top-0 h-full w-[46%] bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,.035)_48%,transparent_100%)]" />
        <div className="absolute right-[-80px] top-[-100px] size-[440px] rounded-full border border-border/60" />
        <div className="absolute right-[-10px] top-[-30px] size-[300px] rounded-full border border-border/50" />
        <div className="relative grid min-h-[610px] lg:grid-cols-[1.15fr_.85fr]">
          <div className="flex flex-col justify-between p-7 sm:p-10 lg:p-14">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 border border-border bg-background px-3 py-2 text-[9px] font-extrabold uppercase tracking-[.22em]">
                <span className="size-1.5 animate-pulse rounded-full bg-success" /> САЙТ ОНЛАЙН <span className="ml-1 border-l border-border pl-2 tabular-nums">{onlineCount === null ? "…" : onlineCount}</span> <span className="text-muted-foreground">сейчас</span>
              </div>
              <span className="hidden text-[9px] font-extrabold uppercase tracking-[.25em] text-muted-foreground sm:block">RC-01 / 2026</span>
            </div>

            <div className="py-14">
              <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.3em] text-muted-foreground">
                <Crosshair className="size-3.5 text-foreground" /> Blox Strike competitive
              </div>
              <h1 className="mt-6 max-w-4xl font-display text-[54px] font-extrabold leading-[.91] tracking-[-.065em] sm:text-[76px] lg:text-[96px]">
                ИГРАЙ.<br />
                <span className="text-muted-foreground">ПОБЕЖДАЙ.</span><br />
                РАСТИ.
              </h1>
              <p className="mt-7 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                RECORN — отдельная соревновательная среда для Blox Strike. Здесь матч начинается с рейтинга, а заканчивается результатом.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                <Link to="/matchmaking" className="group inline-flex items-center gap-3 bg-foreground px-5 py-3.5 text-xs font-extrabold uppercase tracking-[.08em] text-background">
                  Найти матч <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"/>
                </Link>
                <Link to="/players" className="inline-flex items-center gap-3 border border-border px-5 py-3.5 text-xs font-extrabold uppercase tracking-[.08em] hover:bg-secondary">
                  Рейтинг <ChevronRight className="size-4"/>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-3 border-t border-border">
              <div className="pt-5">
                <div className="font-display text-3xl font-extrabold tracking-tight">1000</div>
                <div className="mt-1 text-[8px] font-extrabold uppercase tracking-[.2em] text-muted-foreground">Start ELO</div>
              </div>
              <div className="border-l border-border pl-4 pt-5 sm:pl-6">
                <div className="font-display text-3xl font-extrabold tracking-tight">04</div>
                <div className="mt-1 text-[8px] font-extrabold uppercase tracking-[.2em] text-muted-foreground">Level</div>
              </div>
              <div className="border-l border-border pl-4 pt-5 sm:pl-6">
                <div className="font-display text-3xl font-extrabold tracking-tight">24/7</div>
                <div className="mt-1 text-[8px] font-extrabold uppercase tracking-[.2em] text-muted-foreground">Network</div>
              </div>
            </div>
          </div>

          <div className="relative hidden border-l border-border lg:block">
            <div className="absolute inset-0 grid place-items-center">
              <div className="relative flex size-[390px] items-center justify-center rounded-full border border-border/80">
                <div className="absolute inset-8 rounded-full border border-border/70" />
                <div className="absolute inset-20 rounded-full border border-border/60" />
                <div className="absolute inset-0 animate-[spin_28s_linear_infinite] rounded-full border border-dashed border-border" />
                <div className="relative grid size-36 place-items-center bg-foreground text-background shadow-[0_0_100px_rgba(255,255,255,.08)]">
                  <div className="text-center">
                    <Crosshair className="mx-auto size-8"/>
                    <div className="mt-3 font-display text-lg font-extrabold tracking-tight">RECORN</div>
                    <div className="mt-1 text-[7px] font-extrabold uppercase tracking-[.25em] opacity-60">MATCH CORE</div>
                  </div>
                </div>
                <div className="absolute right-2 top-20 border border-border bg-background px-3 py-2">
                  <div className="text-[8px] font-extrabold uppercase tracking-widest text-muted-foreground">ELO</div>
                  <div className="font-display text-xl font-extrabold">1000</div>
                </div>
                <div className="absolute bottom-16 left-0 border border-border bg-background px-3 py-2">
                  <div className="flex items-center gap-2 text-[9px] font-extrabold"><Radio className="size-3 text-success"/> LIVE</div>
                </div>
              </div>
            </div>
            <div className="absolute bottom-7 left-7 right-7 border-t border-border pt-5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-extrabold uppercase tracking-[.2em] text-muted-foreground">System</span>
                <span className="text-[9px] font-extrabold uppercase tracking-[.2em]">Stable / 99.9%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_.5fr]">
        <div className="border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div className="text-[9px] font-extrabold uppercase tracking-[.25em] text-muted-foreground">How RECORN works</div>
            <Zap className="size-4"/>
          </div>
          <div className="mt-7 grid gap-px border border-border bg-border md:grid-cols-3">
            {FEATURES.map(({icon: Icon, number, title, text, to}) => (
              <Link key={title} to={to} className="group bg-card p-5 transition hover:bg-secondary sm:p-6">
                <div className="flex items-center justify-between">
                  <Icon className="size-5"/>
                  <span className="font-display text-xs font-extrabold text-muted-foreground">{number}</span>
                </div>
                <div className="mt-12 font-display text-sm font-extrabold tracking-wide">{title}</div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">{text}</p>
                <div className="mt-6 flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground group-hover:text-foreground">Open <ChevronRight className="size-3"/></div>
              </Link>
            ))}
          </div>
        </div>

        <div className="border border-border bg-foreground p-6 text-background sm:p-8">
          <Heart className="size-5"/>
          <div className="mt-20 font-display text-2xl font-extrabold leading-tight">Поддержи<br/>RECORN.</div>
          <p className="mt-4 text-xs leading-5 opacity-60">От 50 ₽ — кастомная роль и приоритет в репортах и заявках.</p>
          <Link to="/support" className="mt-7 inline-flex w-full items-center justify-between border border-background/20 px-4 py-3 text-[10px] font-extrabold uppercase tracking-widest hover:bg-background/10">
            Поддержать <ArrowUpRight className="size-4"/>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[.25em] text-muted-foreground"><Trophy className="size-4"/> Your progression</div>
          <div className="mt-6 flex items-end justify-between gap-6">
            <div><div className="font-display text-5xl font-extrabold">1000</div><div className="mt-1 text-xs text-muted-foreground">ELO / Level 04</div></div>
            <div className="text-right text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground"><Check className="ml-auto mb-2 size-4"/> стартовая точка</div>
          </div>
          <div className="mt-7 h-1 bg-secondary"><div className="h-1 w-[52%] bg-foreground"/></div>
          <div className="mt-3 flex justify-between text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground"><span>500</span><span>1050</span><span>2000+</span></div>
        </div>
        <div className="border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[.25em] text-muted-foreground"><Users className="size-4"/> Community</div>
          <h2 className="mt-6 font-display text-2xl font-extrabold tracking-tight">Твоя статистика.<br/>Твоя репутация.</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">Открывай игроков, следи за рейтингом, участвуй в матчах и используй систему репортов, если что-то пошло не так.</p>
          <Link to="/players" className="mt-6 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest">Открыть игроков <ArrowUpRight className="size-4"/></Link>
        </div>
      </section>

      <footer className="flex flex-col justify-between gap-2 border-t border-border pt-5 text-[9px] font-extrabold uppercase tracking-[.18em] text-muted-foreground sm:flex-row">
        <span>RECORN / Blox Strike competitive network</span><span>Fair play · ELO · Matchmaking</span>
      </footer>
    </div>
  );
}
