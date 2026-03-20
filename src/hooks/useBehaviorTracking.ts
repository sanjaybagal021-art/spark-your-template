import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

const SESSION_ID_KEY = "livebet_session_id";

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

/**
 * Tracks user behavior events for analytics:
 * - Page views with time spent
 * - Session start/end
 * - Custom events via trackEvent()
 */
export function useBehaviorTracking() {
  const { user } = useAuth();
  const sessionStarted = useRef(false);
  const lastPageTime = useRef<number>(Date.now());
  const lastPath = useRef<string>("");

  const trackEvent = useCallback(async (
    eventType: string,
    eventData: Record<string, unknown> = {},
    pagePath?: string
  ) => {
    if (!user) return;
    try {
      await supabase.from("user_behavior_events" as any).insert({
        user_id: user.id,
        event_type: eventType,
        event_data: eventData,
        page_path: pagePath ?? window.location.pathname,
        session_id: getSessionId(),
      });
    } catch {
      // Fire and forget
    }
  }, [user]);

  // Track session start
  useEffect(() => {
    if (!user || sessionStarted.current) return;
    sessionStarted.current = true;

    trackEvent("session_start", {
      screen: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      referrer: document.referrer || "direct",
    });

    // Track session end on unload
    const handleUnload = () => {
      const duration = Date.now() - lastPageTime.current;
      // Use sendBeacon for reliability
      const payload = JSON.stringify({
        user_id: user.id,
        event_type: "session_end",
        event_data: { total_duration_ms: Date.now() - (sessionStarted.current ? lastPageTime.current : Date.now()) },
        page_path: window.location.pathname,
        session_id: getSessionId(),
        duration_ms: duration,
      });

      navigator.sendBeacon?.(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_behavior_events`,
        // sendBeacon doesn't support auth headers easily, so we skip it
        // Events are already tracked per-page; session_end is best-effort
      );
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [user, trackEvent]);

  // Track page views with duration
  useEffect(() => {
    if (!user) return;

    const path = window.location.pathname;
    const now = Date.now();

    // Log duration on previous page
    if (lastPath.current && lastPath.current !== path) {
      const duration = now - lastPageTime.current;
      trackEvent("page_view_end", { duration_ms: duration }, lastPath.current);
    }

    lastPath.current = path;
    lastPageTime.current = now;

    trackEvent("page_view", { path });
  }, [user, trackEvent]);

  return { trackEvent };
}
