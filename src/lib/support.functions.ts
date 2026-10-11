import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const supportSchema = z.object({
  category: z.enum(["bug", "account", "match", "report", "other"]),
  description: z.string().min(10).max(2000),
  pageUrl: z.string().max(500).optional().or(z.literal("")),
  nickname: z.string().max(64).optional().or(z.literal("")),
});

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Баг",
  account: "Аккаунт",
  match: "Матч",
  report: "Репорт",
  other: "Другое",
};

export const submitSupportTicket = createServerFn({ method: "POST" })
  .inputValidator((data) => supportSchema.parse(data))
  .handler(async ({ data }) => {
    const token = process.env["TELEGRAM_BOT_TOKEN"];
    if (!token) return { ok: false as const, error: "NOT_CONFIGURED" };
    const envChat = process.env["TELEGRAM_CHAT_ID"];
    const botId = token.split(":")[0];
    let chatId: string | number | undefined = envChat && envChat !== botId ? envChat : undefined;
    if (!chatId) {
      // Auto-discover: use the latest chat that pressed Start / wrote to the bot.
      const upd = (await fetch(`https://api.telegram.org/bot${token}/getUpdates`).then((r) => r.json()).catch(() => null)) as
        | { result?: Array<Record<string, { chat?: { id: number } } | undefined>> }
        | null;
      const list = upd?.result ?? [];
      for (let i = list.length - 1; i >= 0 && !chatId; i--) {
        const u = list[i];
        chatId = (u.message ?? u.my_chat_member ?? u.channel_post)?.chat?.id;
      }
    }
    if (!chatId) return { ok: false as const, error: "NOT_CONFIGURED" };

    const lines = [
      "<b>Новое обращение RECORN</b>",
      `Категория: ${CATEGORY_LABELS[data.category] ?? data.category}`,
      data.nickname ? `Ник: ${data.nickname}` : null,
      data.pageUrl ? `Страница: ${data.pageUrl}` : null,
      "",
      data.description,
    ].filter((l) => l !== null);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const payload = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (!res.ok || !payload?.ok) {
      console.error(`Telegram sendMessage failed [${res.status}]: ${JSON.stringify(payload)}`);
      return { ok: false as const, error: "TELEGRAM_FAILED" };
    }

    return { ok: true as const };
  });
