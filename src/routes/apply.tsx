import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Swords, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/apply")({
  head: () => ({
    meta: [
      { title: "Заявка — ReCorN" },
      { name: "description", content: "Подайте заявку на участие в матчах ReCorN для Block Strike." },
      { property: "og:title", content: "Заявка — ReCorN" },
      { property: "og:description", content: "Подайте заявку на участие в матчах ReCorN для Block Strike." },
    ],
  }),
  component: ApplyPage,
});

function ApplyPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold">Заявка на участие</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Заполните форму, чтобы участвовать в матчах ReCorN.
      </p>

      {sent ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-10 text-center">
          <CheckCircle2 className="size-10 text-success" />
          <h2 className="text-lg font-bold">Заявка отправлена!</h2>
          <p className="text-sm text-muted-foreground">
            Мы рассмотрим вашу заявку и свяжемся с вами.
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
            <span className="text-sm font-semibold">Ник в Block Strike</span>
            <input
              required
              placeholder="Ваш игровой ник"
              className="rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Discord</span>
            <input
              required
              placeholder="username"
              className="rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">О себе</span>
            <textarea
              rows={4}
              placeholder="Опыт игры, любимые режимы, K/D..."
              className="resize-none rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </label>
          <button
            type="submit"
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Swords className="size-4" />
            Отправить заявку
          </button>
        </form>
      )}
    </div>
  );
}
