import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface LoginEvent {
  id: string;
  event_type: string;
  user_agent: string | null;
  device_fingerprint: string | null;
  is_new_device: boolean;
  is_new_ip: boolean;
  risk_flags: string[];
  created_at: string;
}

export function useLoginHistory() {
  const { user } = useAuth();
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("login_events" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setEvents(data as any);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    refresh();
  }, [user, refresh]);

  return { events, loading, refresh };
}
