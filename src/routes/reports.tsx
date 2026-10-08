import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Flag, Send } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Репорты — RECORN" },
      { name: "description", content: "Статус системы репортов RECORN." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-2xl sm:p-12">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10">
          <Flag className="size-8 text-destructive" />
        </div>

        <div className="mt-6 text-xs font-extrabold uppercase tracking-[.25em] text-destructive">
          RECORN REPORTS
        </div>
        <h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl">
          Репорты временно недоступны
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
          В данный момент система репортов не работает. Если вам нужно сообщить
          о проблеме или нарушителе, напишите в техническую поддержку RECORN.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <Link
            to="/support-telegram"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90"
          >
            <Send className="size-4" />
            Написать в техподдержку
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-bold transition hover:bg-secondary"
          >
            <ArrowLeft className="size-4" />
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
