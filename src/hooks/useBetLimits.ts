import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BetLimits {
  min_stake: number;
  max_stake: number;
  max_win: number;
}

const DEFAULT_LIMITS: BetLimits = {
  min_stake: 10,
  max_stake: 50000,
  max_win: 500000,
};

let cached: BetLimits | null = null;

export function useBetLimits() {
  const [limits, setLimits] = useState<BetLimits>(cached ?? DEFAULT_LIMITS);

  useEffect(() => {
    if (cached) return;
    supabase
      .from("bet_limits" as any)
      .select("min_stake, max_stake, max_win")
      .eq("market_name", "default")
      .single()
      .then(({ data }) => {
        if (data) {
          const d = data as any;
          cached = {
            min_stake: Number(d.min_stake),
            max_stake: Number(d.max_stake),
            max_win: Number(d.max_win),
          };
          setLimits(cached);
        }
      });
  }, []);

  return limits;
}
