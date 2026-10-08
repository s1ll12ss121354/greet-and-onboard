import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Copy, Crown, UserPlus, Volume2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/match-found")({
  head: () => ({
    meta: [
      { title: "Матч найден — RECORN" },
      { name: "description", content: "Матч RECORN начался. Добавьте хоста в друзья Block Strike." },
    ],
  }),
  component: MatchFoundPage,
});

function MatchFoundPage() {
  const { user, profile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [host, setHost] = useState("");
  const [hostUserId, setHostUserId] = useState<string | null>(null);
  const [loadingHost, setLoadingHost] = useState(true);

  const { queryHost, queryHostId, lobbyId } = useMemo(() => {
    if (typeof window === "undefined") return { queryHost: "", queryHostId: "", lobbyId: "" };
    const params = new URLSearchParams(window.location.search);
    return {
      queryHost: params.get("host")?.trim() ?? "",
      queryHostId: params.get("host_id")?.trim() ?? "",
      lobbyId:
        params.get("lobby")?.trim() ??
        window.sessionStorage.getItem("recorn-lobby")?.trim() ??
        "",
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function resolveHost() {
      const sessionHost =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem("recorn-match-host")?.trim() ?? ""
          : "";
      const sessionHostId =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem("recorn-match-host-id")?.trim() ?? ""
          : "";

      if (queryHost) {
        setHost(queryHost);
        if (queryHostId) setHostUserId(queryHostId);
        else if (queryHost === profile?.nickname?.trim()) setHostUserId(user?.id ?? null);
        setLoadingHost(false);
        return;
      }

      if (!lobbyId) {
        if (sessionHost) {
          setHost(sessionHost);
          if (sessionHostId) setHostUserId(sessionHostId);
          else if (sessionHost === profile?.nickname?.trim()) setHostUserId(user?.id ?? null);
        }
        setLoadingHost(false);
        return;
      }

      const { data: lobby } = await supabase
        .from("match_lobbies")
        .select("host_user_id,status")
        .eq("id", lobbyId)
        .maybeSingle();

      if (cancelled) return;

      if (lobby?.host_user_id) {
        setHostUserId(lobby.host_user_id);
        const { data: hostProfile } = await supabase
          .from("profiles")
          .select("nickname")
          .eq("id", lobby.host_user_id)
          .maybeSingle();

        if (!cancelled && hostProfile?.nickname) {
          setHost(hostProfile.nickname);
          setLoadingHost(false);
          return;
        }
      }

      // Last-resort owner fallback for the match creator.
      // The server-side force-start RPC uses the same rule.
      if (
        profile?.nickname?.trim().toLowerCase() === "isy_hesy09" &&
        user?.id
      ) {
        const { data: member } = await supabase
          .from("match_lobby_members")
          .select("id")
          .eq("lobby_id", lobbyId)
          .eq("user_id", user.id)
          .eq("member_kind", "player")
          .maybeSingle();

        if (!cancelled && member) {
          setHost(profile.nickname.trim());
          setHostUserId(user.id);
          setLoadingHost(false);
          return;
        }
      }

      if (!cancelled) setLoadingHost(false);
    }

    void resolveHost();

    return () => {
      cancelled = true;
    };
  }, [lobbyId, profile?.nickname, queryHost, queryHostId, user?.id]);

  async function copyHost() {
    if (!host || !navigator.clipboard) return;
    await navigator.clipboard.writeText(host);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center">
      <section className="w-full overflow-hidden rounded-3xl border border-primary/30 bg-card shadow-2xl">
        <div className="grid-bg p-8 sm:p-12">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
            <Crown className="size-10 text-primary" />
          </div>

          <div className="mt-6 text-center">
            <div className="text-xs font-extrabold uppercase tracking-[.25em] text-primary">
              MATCH STARTED
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
              Матч начался
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
              Игра запущена. Добавьте хоста в друзья в Block Strike, чтобы он смог
              провести матч.
            </p>
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-background/60 p-5 text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
              <UserPlus className="size-4" />
              Заявка в друзья
            </div>

            {loadingHost ? (
              <div className="mt-5 text-sm font-semibold text-muted-foreground">
                Определяем хоста…
              </div>
            ) : host ? (
              <>
                <div className="mt-3 break-all font-display text-2xl font-bold">
                  {host}
                </div>
                {(hostUserId === user?.id ||
                  host.trim().toLowerCase() === profile?.nickname?.trim().toLowerCase()) && (
                  <button
                    onClick={() => {
                      if (lobbyId) {
                        window.location.assign("/matchmaking?results=1&lobby=" + encodeURIComponent(lobbyId));
                      } else {
                        window.location.assign("/matchmaking?results=1");
                      }
                    }}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground hover:opacity-90"
                  >
                    Внести результат матча
                  </button>
                }
                <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
                  <button
                    onClick={copyHost}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
                  >
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copied ? "Ник скопирован" : "Скопировать ник"}
                  </button>
                  <div className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-muted-foreground">
                    <Volume2 className="size-4" />
                    Сигнал матча отправлен
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-3">
                <p className="text-sm font-semibold text-destructive">
                  Не удалось определить хоста этого лобби.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Обновите страницу один раз. Если хост так и не появится — обратитесь в поддержку RECORN.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Не вводите пароль Roblox и не передавайте его хосту.
          </p>
          <Link
            to="/matchmaking"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:bg-secondary"
          >
            <ArrowLeft className="size-4" />
            Вернуться в матч
          </Link>
        </div>
      </section>
    </div>
  );
}
