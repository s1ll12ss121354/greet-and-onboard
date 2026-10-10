import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Send, ShieldCheck, TriangleAlert } from "lucide-react";
import { submitSupportTicket } from "@/lib/support.functions";

export const Route = createFileRoute("/support-telegram")({
  head: () => ({
    meta: [
      { title: "Техподдержка — RECORN" },
      { name: "description", content: "Техническая поддержка RECORN: отправьте обращение прямо с сайта." },
    ],
  }),
  component: SupportTelegramPage,
});

const CATEGORIES = [
  { value: "bug", label: "Баг" },
  { value: "account", label: "Проблема с аккаунтом" },
  { value: "match", label: "Проблема с матчем" },
  { value: "report", label: "Репорт" },
  { value: "other", label: "Другое" },
] as const;

function SupportTelegramPage() {
  const sendTicket = useServerFn(submitSupportTicket);
  const [category, setCategory] = useState<string>("bug");
  const [description, setDescription] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "not_configured">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    try {
      const result = await sendTicket({
        data: {
          category: category as "bug" | "account" | "match" | "report" | "other",
          description: description.trim(),
          pageUrl: pageUrl.trim(),
          nickname: nickname.trim(),
        },
      });
      if (result.ok) {
        setStatus("sent");
        setDescription("");
        setPageUrl("");
      } else {
        setStatus(result.error === "NOT_CONFIGURED" ? "not_configured" : "error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="overflow-hidden rounded-3xl border border-primary/20 bg-card shadow-2xl">
        <div className="banner-gradient p-7 sm:p-10">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Send className="size-6" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold sm:text-4xl">Техническая поддержка</h1>
          <p className="mt-3 text-muted-foreground">
            Нашли баг или проблему с заявкой, репортом, матчем или аккаунтом? Заполните форму — обращение сразу придёт нам в Telegram.
          </p>
        </div>

        <div className="space-y-4 p-6 sm:p-8">
          {status === "sent" ? (
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-6 text-center">
              <CheckCircle2 className="mx-auto size-10 text-primary" />
              <h2 className="mt-3 font-display text-lg font-bold">Обращение отправлено</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Мы получили ваше сообщение в Telegram и скоро ответим.
              </p>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="mt-4 rounded-xl border border-border bg-secondary px-5 py-2.5 text-sm font-bold transition hover:opacity-90"
              >
                Отправить ещё одно
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="category" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Категория обращения
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="description" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Описание проблемы
                </label>
                <textarea
                  id="description"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Опишите, что случилось: что вы делали, что ожидали и что произошло."
                  className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary"
                />
              </div>

              <div>
                <label htmlFor="pageUrl" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Ссылка на страницу (необязательно)
                </label>
                <input
                  id="pageUrl"
                  type="text"
                  maxLength={500}
                  value={pageUrl}
                  onChange={(e) => setPageUrl(e.target.value)}
                  placeholder="https://recorn.lovable.app/..."
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary"
                />
              </div>

              <div>
                <label htmlFor="nickname" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Ваш ник (необязательно)
                </label>
                <input
                  id="nickname"
                  type="text"
                  maxLength={64}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ник в Roblox / RECORN"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary"
                />
              </div>

              {status === "error" && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  Не удалось отправить обращение. Попробуйте ещё раз или напишите нам в Telegram напрямую.
                </div>
              )}
              {status === "not_configured" && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  Форма временно недоступна. Напишите нам в Telegram напрямую: @s1l3nt123
                </div>
              )}

              <button
                type="submit"
                disabled={status === "sending"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {status === "sending" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {status === "sending" ? "Отправляем…" : "Отправить обращение"}
              </button>
            </form>
          )}

          <div className="rounded-2xl border border-border bg-background/50 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <h2 className="font-bold">Или напишите напрямую</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Telegram поддержки:{" "}
                  <a
                    href="https://t.me/s1l3nt123"
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="font-bold text-primary hover:underline"
                  >
                    @s1l3nt123
                  </a>
                </p>
              </div>
            </div>
          </div>

          <Link to="/" className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-5 py-3 text-sm font-bold">
            <ArrowLeft className="size-4" /> На главную
          </Link>
        </div>
      </section>
    </div>
  );
}
