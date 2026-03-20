import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type AccountStatus = "active" | "restricted" | "suspended" | "under_review" | "blocked";

export interface RiskProfile {
  risk_score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  account_status: AccountStatus;
  max_bet_override: number | null;
  blocked_markets: string[];
  bonuses_disabled: boolean;
  withdrawal_delay_hours: number;
  flags: string[];
  last_calculated_at: string | null;
}

const DEFAULT_RISK: RiskProfile = {
  risk_score: 0,
  risk_level: "low",
  account_status: "active",
  max_bet_override: null,
  blocked_markets: [],
  bonuses_disabled: false,
  withdrawal_delay_hours: 0,
  flags: [],
  last_calculated_at: null,
};

export function useAccountStatus() {
  const { user } = useAuth();
  const [riskProfile, setRiskProfile] = useState<RiskProfile>(DEFAULT_RISK);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from("user_risk_profiles" as any)
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (data) {
      const d = data as any;
      setRiskProfile({
        risk_score: d.risk_score ?? 0,
        risk_level: d.risk_level ?? "low",
        account_status: d.account_status ?? "active",
        max_bet_override: d.max_bet_override,
        blocked_markets: d.blocked_markets ?? [],
        bonuses_disabled: d.bonuses_disabled ?? false,
        withdrawal_delay_hours: d.withdrawal_delay_hours ?? 0,
        flags: d.flags ?? [],
        last_calculated_at: d.last_calculated_at,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const isRestricted = riskProfile.account_status !== "active";
  const canBet = ["active", "restricted"].includes(riskProfile.account_status);
  const canWithdraw = !["suspended", "blocked"].includes(riskProfile.account_status);

  return {
    riskProfile,
    loading,
    refresh,
    isRestricted,
    canBet,
    canWithdraw,
  };
}
