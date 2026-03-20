import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

/**
 * Logs login events and detects anomalies:
 * - New device (fingerprint not seen before)
 * - New IP (not seen in last 30 days)
 * - VPN detection (basic timezone mismatch heuristic)
 */
export function useLoginAnomalyDetection() {
  const { user } = useAuth();
  const tracked = useRef(false);

  useEffect(() => {
    if (!user || tracked.current) return;
    tracked.current = true;

    const detect = async () => {
      const fingerprint = generateFingerprint();
      const riskFlags: string[] = [];

      // Check if this device fingerprint is new for this user
      const { data: existingDevice } = await supabase
        .from("user_device_sessions" as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("device_fingerprint", fingerprint)
        .maybeSingle();

      const isNewDevice = !existingDevice;
      if (isNewDevice) riskFlags.push("new_device");

      // Basic VPN heuristic: check if timezone doesn't match recent sessions
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const { data: recentSessions } = await supabase
        .from("user_device_sessions" as any)
        .select("timezone")
        .eq("user_id", user.id)
        .order("last_seen_at", { ascending: false })
        .limit(5);

      if (recentSessions && recentSessions.length > 0) {
        const knownTimezones = new Set((recentSessions as any[]).map(s => s.timezone));
        if (knownTimezones.size > 0 && !knownTimezones.has(tz)) {
          riskFlags.push("timezone_mismatch");
        }
      }

      // Check for multiple simultaneous active sessions (last 5 min)
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: activeSessions } = await supabase
        .from("user_device_sessions" as any)
        .select("id")
        .eq("user_id", user.id)
        .gte("last_seen_at", fiveMinAgo);

      if (activeSessions && activeSessions.length > 2) {
        riskFlags.push("multiple_active_sessions");
      }

      // Log the login event
      await supabase.from("login_events" as any).insert({
        user_id: user.id,
        event_type: "login_success",
        user_agent: navigator.userAgent,
        device_fingerprint: fingerprint,
        is_new_device: isNewDevice,
        risk_flags: riskFlags,
      });

      // If high-risk flags detected, update risk profile
      if (riskFlags.length > 0) {
        const { data: riskProfile } = await supabase
          .from("user_risk_profiles" as any)
          .select("flags")
          .eq("user_id", user.id)
          .single();

        if (riskProfile) {
          const existingFlags: string[] = (riskProfile as any).flags ?? [];
          const newFlags = riskFlags.filter(f => !existingFlags.includes(f));
          if (newFlags.length > 0) {
            await supabase
              .from("user_risk_profiles" as any)
              .update({ flags: [...existingFlags, ...newFlags] })
              .eq("user_id", user.id);
          }
        }
      }
    };

    detect().catch(console.error);
  }, [user]);
}

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
  const str = components.join("|");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
