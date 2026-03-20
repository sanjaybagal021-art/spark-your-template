import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface WithdrawalLimits {
  canWithdraw: boolean;
  dailyLimit: number | null; // null = unlimited
  withdrawnToday: number;
  remaining: number | null; // null = unlimited
  kycLevel: number;
  reason: string;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useWithdrawalLimits(): WithdrawalLimits {
  const { user } = useAuth();
  const [kycLevel, setKycLevel] = useState(0);
  const [withdrawnToday, setWithdrawnToday] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Get KYC level
    const { data: profile } = await supabase
      .from("profiles")
      .select("kyc_level")
      .eq("user_id", user.id)
      .single();

    const level = (profile as any)?.kyc_level ?? 0;
    setKycLevel(level);

    // Get today's withdrawals
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: txs } = await supabase
      .from("transactions")
      .select("amount")
      .eq("user_id", user.id)
      .eq("type", "withdrawal")
      .gte("created_at", today.toISOString());

    const totalToday = (txs ?? []).reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
    setWithdrawnToday(totalToday);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const LIMITS: Record<number, { canWithdraw: boolean; dailyLimit: number | null; reason: string }> = {
    0: { canWithdraw: false, dailyLimit: 0, reason: "Complete KYC verification to enable withdrawals" },
    1: { canWithdraw: true, dailyLimit: 10000, reason: "Level 1 KYC: ₹10,000/day limit. Upgrade to Level 2 for unlimited." },
    2: { canWithdraw: true, dailyLimit: null, reason: "Level 2 KYC: Unlimited withdrawals" },
  };

  const config = LIMITS[kycLevel] ?? LIMITS[0];
  const remaining = config.dailyLimit !== null ? Math.max(0, config.dailyLimit - withdrawnToday) : null;

  return {
    canWithdraw: config.canWithdraw,
    dailyLimit: config.dailyLimit,
    withdrawnToday,
    remaining,
    kycLevel,
    reason: config.reason,
    loading,
    refresh,
  };
}
