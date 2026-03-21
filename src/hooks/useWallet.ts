import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface WalletState {
  balance: number;
  bonusBalance: number;
  loading: boolean;
  refresh: () => Promise<void>;
  debit: (amount: number, description: string, referenceId?: string) => Promise<boolean>;
  credit: (amount: number, type: "deposit" | "bet_win" | "bet_refund" | "bonus", description: string) => Promise<boolean>;
  withdraw: (amount: number, description: string) => Promise<{ success: boolean; status?: string; message?: string }>;
}

export function useWallet(): WalletState {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    // Use atomic RPC to get balance from single source of truth
    const { data, error } = await supabase.rpc("wallet_get_balance" as any, { p_user_id: user.id });
    if (!error && data) {
      const d = data as any;
      setBalance(Number(d.balance ?? 0));
    } else {
      // Fallback to profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("user_id", user.id)
        .single();
      if (profile) setBalance(Number(profile.balance));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    refresh();

    // Real-time subscription on profile balance changes
    const channel = supabase
      .channel(`wallet:${user.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const newData = payload.new as any;
        if (newData.balance !== undefined) {
          setBalance(Number(newData.balance));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, refresh]);

  // Atomic debit via server-side function (no client-side balance math)
  const debit = useCallback(async (amount: number, description: string, referenceId?: string): Promise<boolean> => {
    if (!user) return false;
    const idempotencyKey = referenceId ?? crypto.randomUUID();
    const { data, error } = await supabase.rpc("wallet_debit" as any, {
      p_user_id: user.id,
      p_amount: amount,
      p_type: "bet_placed",
      p_description: description,
      p_idempotency_key: idempotencyKey,
    });
    if (error) return false;
    const result = data as any;
    if (result?.success) {
      setBalance(Number(result.balance));
      return true;
    }
    return false;
  }, [user]);

  // Atomic credit via server-side function
  const credit = useCallback(async (
    amount: number,
    type: "deposit" | "bet_win" | "bet_refund" | "bonus",
    description: string
  ): Promise<boolean> => {
    if (!user) return false;
    const { data, error } = await supabase.rpc("wallet_credit" as any, {
      p_user_id: user.id,
      p_amount: amount,
      p_type: type,
      p_description: description,
      p_idempotency_key: crypto.randomUUID(),
    });
    if (error) return false;
    const result = data as any;
    if (result?.success) {
      setBalance(Number(result.balance));
      return true;
    }
    return false;
  }, [user]);

  // Withdrawal with fraud checks via server-side function
  const withdraw = useCallback(async (
    amount: number,
    description: string
  ): Promise<{ success: boolean; status?: string; message?: string }> => {
    if (!user) return { success: false, message: "Not authenticated" };
    const { data, error } = await supabase.rpc("wallet_withdraw_with_checks" as any, {
      p_user_id: user.id,
      p_amount: amount,
      p_description: description,
      p_idempotency_key: crypto.randomUUID(),
    });
    if (error) return { success: false, message: error.message };
    const result = data as any;
    if (result?.success) {
      if (result.balance !== undefined) setBalance(Number(result.balance));
      return { success: true, status: result.status ?? "completed", message: result.message };
    }
    return { success: false, message: result?.error ?? "Withdrawal failed" };
  }, [user]);

  return { balance, bonusBalance, loading, refresh, debit, credit, withdraw };
}
