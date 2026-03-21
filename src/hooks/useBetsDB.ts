import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

interface Bet {
  id: string;
  user_id: string;
  match_id: string;
  match_title: string;
  market_name: string;
  selection_label: string;
  odds: number;
  stake: number;
  potential_win: number;
  status: string;
  profit_loss: number | null;
  placed_at: string;
  settled_at: string | null;
}

export function useBetsDB() {
  const { user } = useAuth();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBets = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("bets" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("placed_at", { ascending: false });
    setBets((data as any[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchBets();

    const channel = supabase
      .channel(`bets:${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "bets",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setBets((prev) => [payload.new as Bet, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchBets]);

  const placeBet = useCallback(async (bet: Omit<Bet, "id" | "user_id" | "status" | "profit_loss" | "placed_at" | "settled_at">): Promise<string | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("bets" as any)
      .insert({ ...bet, user_id: user.id } as any)
      .select("id")
      .single();
    if (error) return null;
    return (data as any).id;
  }, [user]);

  return { bets, loading, fetchBets, placeBet };
}
