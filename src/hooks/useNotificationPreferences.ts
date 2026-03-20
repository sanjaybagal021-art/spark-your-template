import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type NotifChannel = "email" | "sms" | "in_app";
export type NotifCategory = "bet_results" | "promotions" | "odds_alerts" | "transactions" | "security";

export interface NotifPref {
  id: string;
  channel: NotifChannel;
  category: NotifCategory;
  enabled: boolean;
}

export function useNotificationPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotifPref[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("notification_preferences" as any)
      .select("*")
      .eq("user_id", user.id);
    if (data) setPrefs(data as any);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const toggle = async (channel: NotifChannel, category: NotifCategory) => {
    if (!user) return;
    const existing = prefs.find(p => p.channel === channel && p.category === category);
    const newEnabled = existing ? !existing.enabled : true;

    if (existing) {
      await supabase
        .from("notification_preferences" as any)
        .update({ enabled: newEnabled })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("notification_preferences" as any)
        .insert({ user_id: user.id, channel, category, enabled: newEnabled });
    }

    setPrefs(prev => {
      if (existing) {
        return prev.map(p => p.id === existing.id ? { ...p, enabled: newEnabled } : p);
      }
      return [...prev, { id: crypto.randomUUID(), channel, category, enabled: newEnabled }];
    });
  };

  const isEnabled = (channel: NotifChannel, category: NotifCategory): boolean => {
    const pref = prefs.find(p => p.channel === channel && p.category === category);
    return pref?.enabled ?? false;
  };

  return { prefs, loading, toggle, isEnabled, refresh: fetch };
}
