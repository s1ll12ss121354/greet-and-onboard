import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Send, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/support-telegram")({
  head: () => ({
    meta: [
      { title: "Техподдержка — RECORN" },
      { name: "description", content: "Техническая поддержка RECORN в Telegram." },
    ],
  }),
  component: SupportTelegramPage,
});

function SupportTelegramPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="overflow-hidden rounded-3xl border border-primary/20 bg-card shadow-2xl">
        <div className="banner-gradient p-7 sm:p-10">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Send className="size-6" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold sm:text-4xl">Техническая поддержка</h1>
          <p className="mt-3 text-muted-foreground">
            Если нашли баг, проблема с заявкой, репортом, матчем или аккаунтом — напишите в Telegram.
          </p>
        </div>
        <div className="space-y-4 p-6 sm:p-8">
          <div className="rounded-2xl border border-border bg-background/50 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <h2 className="font-bold">Telegram поддержки</h2>
                <p className="mt-1 text-sm text-muted-foreground">Нажмите кнопку и напишите: @s1l3nt123</p>
              </div>
            </div>
          </div>
          <a
            href="https://t.me/s1l3nt123"
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/20"
          >
            <Send className="size-4" />
            Написать в Telegram
          </a>
          <Link to="/" className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-5 py-3 text-sm font-bold">
            <ArrowLeft className="size-4" /> На главную
          </Link>
        </div>
      </section>
    </div>
  );
}
