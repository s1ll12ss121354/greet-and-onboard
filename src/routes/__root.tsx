import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  useRouterState,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppSidebar } from "../components/AppSidebar";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Страница не найдена</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Такой страницы не существует или она была перемещена.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Страница не загрузилась
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Что-то пошло не так. Попробуйте обновить страницу или вернитесь на главную.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Попробовать снова
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            На главную
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // The runtime config is public (URL + publishable key only). Serialize it
  // through the root loader so the browser can use the backend's server env
  // when the platform failed to inject VITE_* values into the JS bundle.
  loader: () => {
    const env = typeof process !== "undefined" ? process.env : undefined;
    return {
      supabaseUrl: env?.SUPABASE_URL ?? env?.VITE_SUPABASE_URL ?? null,
      supabasePublishableKey: env?.SUPABASE_PUBLISHABLE_KEY ?? env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? null,
    };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "RECORN — Blox Strike" },
      { name: "description", content: "RECORN — платформа для игроков Blox Strike: профили, статистика, матчи и заявки." },
      { property: "og:title", content: "RECORN — Blox Strike" },
      { property: "og:description", content: "Профили, статистика и матчи игроков Blox Strike." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Unbounded:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const backendConfig = Route.useLoaderData();

  // Set this synchronously during the root render, before child effects try
  // to initialize Supabase. Only publishable client configuration is exposed.
  if (typeof window !== "undefined" && backendConfig.supabaseUrl && backendConfig.supabasePublishableKey) {
    window.__RECORN_SUPABASE_CONFIG__ = {
      url: backendConfig.supabaseUrl,
      publishableKey: backendConfig.supabasePublishableKey,
    };
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SiteShell />
    </QueryClientProvider>
  );
}

function SiteShell() {
  const { profile } = useAuth();
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    const refreshMaintenance = async () => {
      try {
        const { data, error } = await supabase.rpc("get_site_maintenance");
        if (active && !error) setMaintenanceEnabled(Boolean(data));
      } catch {
        // If the backend is unreachable, don't cache a false status forever.
      }
    };

    void refreshMaintenance();
    const timer = window.setInterval(() => void refreshMaintenance(), 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const isOwner = profile?.nickname.trim().toLowerCase() === "isy_hesy09";

  if (maintenanceEnabled && !isOwner) {
    return <MaintenanceScreen />;
  }

  return (
    <div className="min-h-screen bg-background">
      <ActivityTracker />
      <MatchStartNotifier />
      <AppSidebar />
      <main className="min-h-screen min-w-0 px-3 pb-8 pt-24 sm:px-5 lg:px-8 lg:pt-28">
        <Outlet />
      </main>
    </div>
  );
}

function MaintenanceScreen() {
  const snippets = [
    "const recorn = await start();",
    "if (status === 'offline') {",
    "  await repair(backend);",
    "return deploy('stable');",
    "SELECT * FROM matches;",
    "while (system.ready) {",
    "  sync(players);",
    "  await healthcheck();",
    "01001110 01000101",
    "const lobby = new Lobby();",
    "try { await migrate(); }",
    "catch (error) { retry(); }",
  ];

  return (
    <main className="maintenance-screen" role="status" aria-live="polite">
      <div className="maintenance-code-layer" aria-hidden="true">
        {Array.from({ length: 22 }, (_, index) => (
          <div
            key={index}
            className="maintenance-code-column"
            style={{
              left: `${(index * 4.8) % 104}%`,
              animationDelay: `-${(index * 1.71) % 27}s`,
              animationDuration: `${18 + (index % 7) * 3}s`,
            }}
          >
            {Array.from({ length: 11 }, (_, line) => (
              <span key={line}>{snippets[(index * 3 + line) % snippets.length]}</span>
            ))}
          </div>
        ))}
      </div>
      <div className="maintenance-vignette" aria-hidden="true" />
      <section className="maintenance-card">
        <div className="maintenance-brand"><span className="maintenance-brand-mark">R</span> RECORN <span className="maintenance-brand-line" /></div>
        <div className="maintenance-status"><span className="maintenance-status-dot" /> ОБСЛУЖИВАНИЕ СИСТЕМЫ</div>
        <div className="maintenance-title">Тех.<span>Работы</span></div>
        <p className="maintenance-copy">Мы обновляем систему, чтобы матчи работали стабильнее. Скоро вернёмся.</p>
        <div className="maintenance-progress"><span /></div>
        <div className="maintenance-support-label">НУЖНА ПОМОЩЬ?</div>
        <a className="maintenance-support" href="https://t.me/s1l3nt123" target="_blank" rel="noreferrer">
          Поддержка: <strong>@s1l3nt123</strong>
        </a>
        <div className="maintenance-footnote">RECORN COMPETITIVE NETWORK <span>•</span> PLEASE STAND BY</div>
      </section>
    </main>
  );
}

function MatchStartNotifier() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let stopped = false;
    const check = async () => {
      if (stopped) return;
      const lobbyId = window.sessionStorage.getItem("recorn-lobby");
      if (!lobbyId) return;

      const handledKey = "recorn-match-started:" + lobbyId;
      if (window.sessionStorage.getItem(handledKey) === "1") return;

      const { data: lobby, error } = await supabase
        .from("match_lobbies")
        .select("status,host_user_id")
        .eq("id", lobbyId)
        .maybeSingle();

      if (error || !lobby || lobby.status !== "in_game") return;

      let hostNickname = "";
      if (lobby.host_user_id) {
        const { data: host } = await supabase
          .from("profiles")
          .select("nickname")
          .eq("id", lobby.host_user_id)
          .maybeSingle();
        hostNickname = host?.nickname ?? "";
      }

      window.sessionStorage.setItem(handledKey, "1");
      window.sessionStorage.setItem("recorn-match-lobby", lobbyId);
      if (lobby.host_user_id) {
        window.sessionStorage.setItem("recorn-match-host-id", lobby.host_user_id);
      }
      if (hostNickname) {
        window.sessionStorage.setItem("recorn-match-host", hostNickname);
      }

      try {
        navigator.vibrate?.([350, 120, 350, 120, 500]);
      } catch {
        // Optional browser feature.
      }

      try {
        const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtor) {
          const audio = new AudioCtor();
          const now = audio.currentTime;
          [0, 0.16, 0.32].forEach((offset, index) => {
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.type = "sine";
            oscillator.frequency.value = index === 2 ? 880 : 660;
            gain.gain.setValueAtTime(0.0001, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.16, now + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.13);
            oscillator.connect(gain);
            gain.connect(audio.destination);
            oscillator.start(now + offset);
            oscillator.stop(now + offset + 0.14);
          });
          window.setTimeout(() => void audio.close(), 900);
        }
      } catch {
        // Browser audio policy may block autoplay.
      }

      window.setTimeout(() => {
        if (!stopped) {
          const query = new URLSearchParams();
          query.set("lobby", lobbyId);
          if (hostNickname) query.set("host", hostNickname);
          if (lobby.host_user_id) query.set("host_id", lobby.host_user_id);
          window.location.assign("/match-found?" + query.toString());
        }
      }, 700);
    };

    void check();
    const timer = window.setInterval(() => void check(), 1500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [user?.id]);

  return null;
}

function ActivityTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    void supabase.rpc("log_activity", {
      p_event_type: "page_view",
      p_path: pathname,
      p_details: {},
    });
  }, [user?.id, pathname]);

  return null;
}
