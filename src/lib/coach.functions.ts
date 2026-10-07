import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  kills: z.number().int().min(0).max(100000),
  deaths: z.number().int().min(0).max(100000),
  headshotPct: z.number().min(0).max(100),
  matches: z.number().int().min(0).max(100000),
  wins: z.number().int().min(0).max(100000),
  role: z.string().max(50),
  weapon: z.string().max(50),
  goal: z.string().min(3).max(500),
});

export const getCoachAdvice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { generateCoachAdvice } = await import("./ai-gateway.server");
    const kd = data.deaths ? (data.kills / data.deaths).toFixed(2) : String(data.kills);
    const wr = data.matches ? Math.round((data.wins / data.matches) * 100) : 0;
    const prompt = `Статистика игрока Block Strike:
- Убийства: ${data.kills}, смерти: ${data.deaths}, K/D: ${kd}
- Хедшоты: ${data.headshotPct}%
- Матчи: ${data.matches}, победы: ${data.wins}, винрейт: ${wr}%
- Роль: ${data.role || "не указана"}, любимое оружие: ${data.weapon || "не указано"}
Цель тренировки: ${data.goal}`;
    const advice = await generateCoachAdvice(
      "Ты опытный тренер по Block Strike (Roblox-шутер в стиле CS). Отвечай на русском, в Markdown: 1) краткий разбор сильных и слабых сторон по цифрам, 2) 4-6 конкретных упражнений/советов под цель, 3) план тренировок на неделю. Не больше 350 слов. Никаких советов по читам.",
      prompt,
    );
    await context.supabase.from("coach_sessions").insert({
      user_id: context.userId,
      stats: { ...data, goal: undefined },
      goal: data.goal,
      advice,
    });
    return { advice };
  });
