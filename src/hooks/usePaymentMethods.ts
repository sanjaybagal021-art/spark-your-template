import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type PaymentMethodType = "upi" | "bank_account" | "card";

export interface PaymentMethod {
  id: string;
  user_id: string;
  type: PaymentMethodType;
  label: string;
  details: Record<string, string>;
  is_default: boolean;
  is_verified: boolean;
  created_at: string;
}

// Helper to access the untyped table (payment_methods not yet in generated types)
const pmTable = () => (supabase as any).from("payment_methods");

export function usePaymentMethods() {
  const { user } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await pmTable()
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });
    setMethods((data as PaymentMethod[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    refresh();
  }, [user, refresh]);

  const addMethod = useCallback(async (
    type: PaymentMethodType,
    label: string,
    details: Record<string, string>,
    setAsDefault = false
  ): Promise<boolean> => {
    if (!user) return false;

    if (setAsDefault) {
      await pmTable().update({ is_default: false }).eq("user_id", user.id);
    }

    const { error } = await pmTable().insert({
      user_id: user.id,
      type,
      label,
      details,
      is_default: setAsDefault || methods.length === 0,
    });

    if (error) return false;
    await refresh();
    return true;
  }, [user, methods.length, refresh]);

  const removeMethod = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await pmTable().delete().eq("id", id).eq("user_id", user.id);
    if (error) return false;
    await refresh();
    return true;
  }, [user, refresh]);

  const setDefault = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;
    await pmTable().update({ is_default: false }).eq("user_id", user.id);
    const { error } = await pmTable().update({ is_default: true }).eq("id", id).eq("user_id", user.id);
    if (error) return false;
    await refresh();
    return true;
  }, [user, refresh]);

  const defaultMethod = methods.find((m) => m.is_default) ?? methods[0] ?? null;

  return { methods, loading, refresh, addMethod, removeMethod, setDefault, defaultMethod };
}
