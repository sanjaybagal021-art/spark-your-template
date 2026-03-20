import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

function generateFingerprint(): string {
  const components = [
    navigator.userAgent,
    screen.width + "x" + screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    navigator.hardwareConcurrency || "unknown",
    navigator.platform,
  ];
  // Simple hash
  const str = components.join("|");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function useDeviceTracking() {
  const { user } = useAuth();
  const tracked = useRef(false);

  useEffect(() => {
    if (!user || tracked.current) return;
    tracked.current = true;

    const fingerprint = generateFingerprint();
    const screenRes = `${screen.width}x${screen.height}`;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const track = async () => {
      // Upsert: update last_seen if same fingerprint, else insert
      const { data: existing } = await supabase
        .from("user_device_sessions" as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("device_fingerprint", fingerprint)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("user_device_sessions" as any)
          .update({ last_seen_at: new Date().toISOString(), user_agent: navigator.userAgent })
          .eq("id", (existing as any).id);
      } else {
        await supabase
          .from("user_device_sessions" as any)
          .insert({
            user_id: user.id,
            device_fingerprint: fingerprint,
            user_agent: navigator.userAgent,
            screen_resolution: screenRes,
            timezone: tz,
          });
      }
    };

    track().catch(console.error);
  }, [user]);
}
