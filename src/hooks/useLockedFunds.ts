import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface LockedFund {
  id: string;
  amount: number;
  reason: string;
  status: string;
  locked_at: string;
  released_at: string | null;
  notes: string | null;
}

export function useLockedFunds() {
  const { user } = useAuth();
  const [lockedBalance, setLockedBalance] = useState(0);
  const [locks, setLocks] = useState<LockedFund[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [balRes, locksRes] = await Promise.all([
      supabase
        .from("wallet_balances")
        .select("locked_balance")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("locked_funds" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "locked")
        .order("locked_at", { ascending: false }),
    ]);

    if (balRes.data) {
      setLockedBalance(Number((balRes.data as any).locked_balance ?? 0));
    }
    if (locksRes.data) {
      setLocks((locksRes.data as any[]).map(l => ({
        id: l.id,
        amount: Number(l.amount),
        reason: l.reason,
        status: l.status,
        locked_at: l.locked_at,
        released_at: l.released_at,
        notes: l.notes,
      })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    refresh();
  }, [user, refresh]);

  return { lockedBalance, locks, loading, refresh };
}
