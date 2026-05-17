import { useEffect, useRef, useState } from "react";
import { Shield } from "lucide-react";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        opts: {
          sitekey: string;
          action?: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "flexible" | "compact";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

let scriptLoaded = false;
let scriptLoading = false;
const loadCallbacks: Array<() => void> = [];

function loadTurnstileScript(): Promise<void> {
  return new Promise((resolve) => {
    if (scriptLoaded) {
      resolve();
      return;
    }
    loadCallbacks.push(resolve);
    if (scriptLoading) return;
    scriptLoading = true;

    window.onTurnstileLoad = () => {
      scriptLoaded = true;
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };

    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  });
}

interface Props {
  onToken: (token: string) => void;
  onError?: () => void;
}

export function TurnstileGate({ onToken, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "verified" | "error" | "unconfigured">("loading");

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) {
      setStatus("unconfigured");
      return;
    }

    let cancelled = false;

    loadTurnstileScript().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return;

      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action: "anon_chat",
          callback: (token) => {
            setStatus("verified");
            onToken(token);
          },
          "error-callback": () => {
            setStatus("error");
            onError?.();
          },
          "expired-callback": () => {
            setStatus("ready");
            if (widgetIdRef.current && window.turnstile) {
              window.turnstile.reset(widgetIdRef.current);
            }
          },
          theme: "light",
          size: "flexible",
        });
        setStatus("ready");
      } catch {
        setStatus("error");
        onError?.();
      }
    });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // widget may already be gone
        }
      }
    };
  }, []);

  if (status === "unconfigured") {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-foreground/80">
        <div className="flex items-center gap-2 font-medium mb-1">
          <Shield className="h-4 w-4 text-amber-500" />
          Anon protection not configured
        </div>
        <p>Set VITE_TURNSTILE_SITE_KEY in Vercel env vars. Sign in to skip this step.</p>
      </div>
    );
  }

  if (status === "verified") {
    return (
      <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5" />
        Verified — you can chat now
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5" />
        Quick check, then chat opens.
      </div>
      <div ref={containerRef} />
      {status === "error" && (
        <p className="text-xs text-destructive">Verification failed. Refresh to retry.</p>
      )}
    </div>
  );
}
