import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Flag, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Жалобы — ReCorN" },
      { name: "description", content: "Отправьте жалобу на игрока Block Strike на ReCorN." },
      { property: "og:title", content: "Жалобы — ReCorN" },
      { property: "og:description", content: "Отправьте жалобу на игрока Block Strike на ReCorN." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold">Жалобы</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Заметили читера или нарушителя? Сообщите нам.
      </p>

      {sent ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-10 text-center">
          <CheckCircle2 className="size-10 text-success" />
          <h2 className="text-lg font-bold">Жалоба отправлена!</h2>
          <p className="text-sm text-muted-foreground">
            Администрация рассмотрит её в ближайшее время.
          </p>
        </div>
      ) : (
        <form
          className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-6"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Ник нарушителя</span>
            <input
              required
              placeholder="Ник игрока в Block Strike"
              className="rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Причина</span>
            <select
              required
              className="rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary"
            >
              <option value="">Выберите причину</option>
              <option>Читы</option>
              <option>Оскорбления</option>
              <option>Тимкилл / слив матча</option>
              <option>Другое</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Описание</span>
            <textarea
              required
              rows={4}
              placeholder="Опишите ситуацию, приложите ссылки на доказательства..."
              className="resize-none rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </label>
          <button
            type="submit"
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-6 py-3 text-sm font-bold text-destructive-foreground transition-colors hover:bg-destructive/90"
          >
            <Flag className="size-4" />
            Отправить жалобу
          </button>
        </form>
      )}
    </div>
  );
}
