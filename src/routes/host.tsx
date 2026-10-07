import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/host")({
  head: () => ({
    meta: [
      { title: "Заявка на хоста — ReCorN" },
      { name: "description", content: "Подайте заявку на роль хоста ReCorN в Block Strike." },
      { property: "og:title", content: "Заявка на хоста — ReCorN" },
      { property: "og:description", content: "Станьте хостом ReCorN: следите за честной игрой." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HostPage,
});

const input =
  "rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";

function HostPage() {
  const { user, profile, loading } = useAuth();
  const [vip, setVip] = useState("");
  const [reason, setReason] = useState("");
  const [rules, setRules] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  if (!loading && !user)
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
        <p>Войдите, чтобы подать заявку.</p>
        <Link to="/auth" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Войти</Link>
      </div>
    );

  if (sent)
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-border bg-card p-10 text-center">
        <CheckCircle2 className="size-10 text-success" />
        <h2 className="text-lg font-bold">Заявка отправлена!</h2>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold">Заявка на хоста</h1>
      <form
        className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!user || !profile) return;
          const { error } = await supabase.from("host_applications").insert({
            user_id: user.id,
            roblox_nick: profile.nickname,
            has_vip: vip === "yes",
            reason,
            accepted_rules: rules,
          });
          if (error) setErr("Не удалось отправить заявку");
          else setSent(true);
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">1. Ваш ник в Roblox</span>
          <input disabled value={profile?.nickname ?? ""} className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">2. Есть ли у вас VIP?</span>
          <select required value={vip} onChange={(e) => setVip(e.target.value)} className={input}>
            <option value="">Выберите</option>
            <option value="yes">Да</option>
            <option value="no">Нет</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">3. Почему мы должны взять вас?</span>
          <textarea required rows={4} value={reason} onChange={(e) => setReason(e.target.value)} className={input} />
        </label>
        <div className="rounded-lg border border-border bg-background p-4 text-sm">
          <p className="font-semibold">Обязанности хоста:</p>
          <ul className="mt-2 list-disc pl-5 text-muted-foreground">
            <li>Не подсказывать игрокам</li>
            <li>Следить за тем, чтобы игроки не читерили</li>
          </ul>
          <label className="mt-3 flex items-center gap-2">
            <input type="checkbox" required checked={rules} onChange={(e) => setRules(e.target.checked)} />
            Я согласен с обязанностями
          </label>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Отправить</button>
      </form>
    </div>
  );
}
