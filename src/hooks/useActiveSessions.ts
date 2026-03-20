import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface DeviceSession {
  id: string;
  device_fingerprint: string;
  user_agent: string | null;
  screen_resolution: string | null;
  timezone: string | null;
  last_seen_at: string;
  created_at: string;
}

export function useActiveSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("user_device_sessions" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("last_seen_at", { ascending: false });
    if (data) setSessions(data as any);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    refresh();
  }, [user, refresh]);

  const revokeSession = useCallback(async (sessionId: string) => {
    if (!user) return;
    await supabase
      .from("user_device_sessions" as any)
      .delete()
      .eq("id", sessionId)
      .eq("user_id", user.id);
    await refresh();
  }, [user, refresh]);

  return { sessions, loading, refresh, revokeSession };
}
