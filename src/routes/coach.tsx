import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { getCoachAdvice } from "@/lib/coach.functions";

export const Route = createFileRoute("/coach")({
  head: () => ({
    meta: [
      { title: "AI-тренер — ReCorN" },
      { name: "description", content: "Персональные AI-рекомендации по улучшению игры в Block Strike." },
      { property: "og:title", content: "AI-тренер — ReCorN" },
      { property: "og:description", content: "Введите статистику и цель — получите план тренировок Block Strike." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoachPage,
});

const input =
  "rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";

function CoachPage() {
  const { user, loading } = useAuth();
  const ask = useServerFn(getCoachAdvice);
  const [f, setF] = useState({ kills: "", deaths: "", headshotPct: "", matches: "", wins: "", role: "", weapon: "", goal: "" });
  const [advice, setAdvice] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && !user)
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
        <p>Войдите, чтобы пользоваться AI-тренером.</p>
        <Link to="/auth" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Войти</Link>
      </div>
    );

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setAdvice("");
    try {
      const r = await ask({
        data: {
          kills: +f.kills || 0, deaths: +f.deaths || 0, headshotPct: +f.headshotPct || 0,
          matches: +f.matches || 0, wins: +f.wins || 0, role: f.role, weapon: f.weapon, goal: f.goal,
        },
      });
      setAdvice(r.advice);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    }
    setBusy(false);
  }

  const nums: [keyof typeof f, string][] = [
    ["kills", "Убийства"], ["deaths", "Смерти"], ["headshotPct", "Хедшоты, %"], ["matches", "Матчи"], ["wins", "Победы"],
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <Sparkles className="size-6 text-primary" /> AI-тренер
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Введите свои результаты и цель — получите персональный план.</p>
      <form onSubmit={submit} className="mt-6 grid gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2">
        {nums.map(([k, l]) => (
          <label key={k} className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{l}</span>
            <input type="number" min={0} value={f[k]} onChange={set(k)} className={input} />
          </label>
        ))}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Роль (снайпер, рашер...)</span>
          <input value={f.role} onChange={set("role")} className={input} />
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-semibold">Любимое оружие</span>
          <input value={f.weapon} onChange={set("weapon")} className={input} />
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-semibold">Цель тренировки</span>
          <textarea required minLength={3} rows={3} value={f.goal} onChange={set("goal")} placeholder="Например: поднять K/D до 1.5 и чаще попадать в голову" className={input} />
        </label>
        <button disabled={busy} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60 sm:col-span-2">
          {busy ? "Тренер думает..." : "Получить рекомендации"}
        </button>
      </form>
      {err && <p className="mt-4 text-sm text-destructive">{err}</p>}
      {advice && (
        <div className="mt-6 whitespace-pre-wrap rounded-2xl border border-primary/40 bg-card p-6 text-sm leading-relaxed">
          {advice}
        </div>
      )}
    </div>
  );
}
