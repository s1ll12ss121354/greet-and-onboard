import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Crown, ShieldCheck, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/host")({
  head: () => ({ meta: [
    { title: "Хост — ReCorN" },
    { name: "description", content: "Подайте заявку на роль хоста ReCorN." },
  ]}),
  component: HostPage,
});

const input = "w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60";

function HostPage() {
  const { user, profile, loading } = useAuth();
  const [vip, setVip] = useState("");
  const [reason, setReason] = useState("");
  const [discord, setDiscord] = useState("");
  const [telegram, setTelegram] = useState("");
  const [rules, setRules] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "none">("none");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("host_applications").select("status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data, error }) => { if (!error && data?.status) setStatus(data.status as typeof status); });
  }, [user?.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile || sending) return;
    setErr("");
    if (!discord.trim() && !telegram.trim()) {
      setErr("Укажите Discord или Telegram для связи с администрацией.");
      return;
    }
    setSending(true);

    const { data: existing, error: existingError } = await supabase
      .from("host_applications").select("id,status").eq("user_id", user.id)
      .in("status", ["pending", "approved"]).order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (existingError) {
      setErr("Не удалось проверить предыдущую заявку. Попробуйте ещё раз.");
      setSending(false);
      return;
    }
    if (existing) {
      setStatus(existing.status as typeof status);
      setSending(false);
      return;
    }

    const { error } = await supabase.from("host_applications").insert({
      user_id: user.id,
      roblox_nick: profile.nickname.trim(),
      has_vip: vip === "yes",
      reason: reason.trim(),
      discord_contact: discord.trim() || null,
      telegram_contact: telegram.trim() || null,
      accepted_rules: true,
      status: "pending",
    });

    if (error) {
      setErr(error.code === "23505"
        ? "У вас уже есть активная заявка."
        : "Заявка не отправлена. Проверьте соединение и попробуйте снова.");
    } else {
      setStatus("pending");
      setVip("");
      setReason("");
      setRules(false);
    }
    setSending(false);
  }

  if (loading) return <div className="mx-auto max-w-3xl animate-pulse rounded-3xl border border-border bg-card p-8">Загрузка профиля…</div>;
  if (!user) return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-10 text-center shadow-2xl">
      <Crown className="mx-auto size-12 text-primary" />
      <h1 className="mt-5 font-display text-2xl font-bold">Хостинг матчей</h1>
      <p className="mt-3 text-muted-foreground">Войдите в аккаунт, чтобы подать заявку.</p>
      <Link to="/auth" className="mt-6 inline-flex rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">Войти</Link>
    </div>
  );

  if (status === "pending" || status === "approved") return (
    <div className="mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="banner-gradient p-8 sm:p-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
            <Crown className="size-3.5" /> Host program
          </span>
          <h1 className="mt-6 font-display text-3xl font-bold">{status === "approved" ? "Вы уже хост" : "Заявка на проверке"}</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            {status === "approved" ? "Администратор одобрил вашу заявку. Вы можете помогать проводить честные матчи." : "Заявка сохранена. Администратор рассмотрит её в ближайшее время."}
          </p>
        </div>
        <div className="grid gap-3 p-6 sm:grid-cols-3">
          {["Проверка честной игры", "Контроль матча", "Нейтральность"].map((x, i) => (
            <div key={x} className="rounded-2xl border border-border bg-background/50 p-4">
              <div className="text-xs font-bold text-primary">0{i + 1}</div><div className="mt-2 text-sm font-semibold">{x}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary"><Sparkles className="size-4" /> ReCorN Host</span>
        <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Стань хостом.</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">Помогай проводить честные матчи Block Strike и поддерживай соревновательную сцену.</p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[["01", "Профиль", "Ваш ник"], ["02", "Заявка", "Опыт и VIP"], ["03", "Проверка", "Решение админа"]].map(([n,t,d]) => (
          <div key={n} className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="text-xs font-bold text-primary">{n}</div><div className="mt-1 font-bold">{t}</div><div className="text-xs text-muted-foreground">{d}</div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-5 rounded-3xl border border-border bg-card p-5 shadow-2xl sm:p-8">
        <label className="block"><span className="mb-2 block text-sm font-bold">Ник в Roblox</span><input disabled value={profile?.nickname ?? ""} className={input} /></label>
        <label className="block"><span className="mb-2 block text-sm font-bold">Есть VIP?</span><select required value={vip} onChange={(e) => setVip(e.target.value)} className={input}><option value="">Выберите вариант</option><option value="yes">Да</option><option value="no">Нет</option></select></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-sm font-bold">Discord</span><input value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="@username" className={input} /></label><label className="block"><span className="mb-2 block text-sm font-bold">Telegram</span><input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username" className={input} /></label></div>
        <p className="text-xs text-muted-foreground">Укажите хотя бы один контакт. Он доступен только администраторам при рассмотрении заявки.</p>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-sm font-bold">Discord</span><input value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="@username" className={input} /></label><label className="block"><span className="mb-2 block text-sm font-bold">Telegram</span><input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username" className={input} /></label></div>
        <p className="text-xs text-muted-foreground">Укажите хотя бы один контакт. Он доступен только администраторам при рассмотрении заявки.</p>
        <label className="block"><span className="mb-2 block text-sm font-bold">Почему именно вы?</span><textarea required minLength={20} rows={6} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Расскажите об опыте, возрасте, часах игры и почему вам можно доверить матч." className={input} /></label>
        <div className="rounded-2xl border border-border bg-background/60 p-5">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="font-bold">Правила хоста</p><ul className="mt-2 space-y-1 text-sm text-muted-foreground"><li>• не подсказывать игрокам;</li><li>• следить за честной игрой;</li><li>• оставаться нейтральным.</li></ul></div></div>
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm"><input type="checkbox" required checked={rules} onChange={(e) => setRules(e.target.checked)} className="mt-1 size-4 accent-[var(--primary)]" /><span>Я прочитал правила и согласен соблюдать обязанности хоста.</span></label>
        </div>
        {err && <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" />{err}</div>}
        <button disabled={sending || !profile} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-50">
          {sending ? <><Loader2 className="size-4 animate-spin" /> Отправляем…</> : <><CheckCircle2 className="size-4" /> Отправить заявку</>}
        </button>
      </form>
    </div>
  );
}
