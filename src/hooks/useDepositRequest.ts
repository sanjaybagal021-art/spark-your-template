import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type DepositMethod = "upi" | "phonepe" | "netbanking" | "card" | "crypto_btc" | "crypto_usdt";
export type DepositStatus = "pending" | "approved" | "rejected" | "expired";

export interface DepositRequest {
  id: string;
  amount: number;
  method: DepositMethod;
  status: DepositStatus;
  utr: string | null;
  screenshot_url: string | null;
  upi_intent_url: string | null;
  crypto_address: string | null;
  crypto_tx_hash: string | null;
  reject_reason: string | null;
  created_at: string;
  expires_at: string | null;
}

const depTable = () => (supabase as any).from("deposit_requests");
const configTable = () => (supabase as any).from("platform_config");

export function useDepositRequest() {
  const { user } = useAuth();
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformUpi, setPlatformUpi] = useState({ id: "merchant@upi", name: "LiveBet" });
  const [cryptoAddresses, setCryptoAddresses] = useState({ btc: "", usdt: "" });

  const fetchDeposits = useCallback(async () => {
    if (!user) return;
    const { data } = await depTable()
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setDeposits((data as DepositRequest[]) ?? []);
    setLoading(false);
  }, [user]);

  const fetchConfig = useCallback(async () => {
    const { data } = await configTable().select("key, value");
    if (data) {
      for (const row of data as any[]) {
        if (row.key === "upi_pay_id") setPlatformUpi(prev => ({ ...prev, id: row.value }));
        if (row.key === "upi_pay_name") setPlatformUpi(prev => ({ ...prev, name: row.value }));
        if (row.key === "crypto_btc_address") setCryptoAddresses(prev => ({ ...prev, btc: row.value }));
        if (row.key === "crypto_usdt_address") setCryptoAddresses(prev => ({ ...prev, usdt: row.value }));
      }
    }
  }, []);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchDeposits();
    fetchConfig();

    // Realtime for deposit status updates
    const channel = supabase
      .channel(`deposits:${user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "deposit_requests",
        filter: `user_id=eq.${user.id}`,
      }, () => fetchDeposits())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchDeposits, fetchConfig]);

  // Create a new deposit request
  const createDeposit = useCallback(async (
    amount: number,
    method: DepositMethod,
  ): Promise<{ success: boolean; deposit?: DepositRequest; upiUrl?: string; error?: string }> => {
    if (!user) return { success: false, error: "Not authenticated" };

    const idempotencyKey = crypto.randomUUID();
    let upiIntentUrl: string | undefined;

    // Generate UPI intent URL for UPI/PhonePe
    if (method === "upi" || method === "phonepe") {
      const pa = platformUpi.id;
      const pn = encodeURIComponent(platformUpi.name);
      upiIntentUrl = `upi://pay?pa=${pa}&pn=${pn}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Deposit ${idempotencyKey.slice(0, 8)}`)}`;
    }

    const insertData: any = {
      user_id: user.id,
      amount,
      method,
      idempotency_key: idempotencyKey,
      upi_intent_url: upiIntentUrl ?? null,
    };

    // For crypto, attach the platform address
    if (method === "crypto_btc") insertData.crypto_address = cryptoAddresses.btc;
    if (method === "crypto_usdt") insertData.crypto_address = cryptoAddresses.usdt;

    const { data, error } = await depTable().insert(insertData).select().single();
    if (error) {
      return { success: false, error: error.message };
    }

    await fetchDeposits();
    return { success: true, deposit: data as DepositRequest, upiUrl: upiIntentUrl };
  }, [user, platformUpi, cryptoAddresses, fetchDeposits]);

  // Submit UTR + optional screenshot for a pending deposit
  const submitProof = useCallback(async (
    depositId: string,
    utr: string,
    screenshotFile?: File,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "Not authenticated" };

    let screenshotUrl: string | null = null;

    // Upload screenshot if provided
    if (screenshotFile) {
      const ext = screenshotFile.name.split(".").pop();
      const path = `${user.id}/${depositId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("payment-screenshots")
        .upload(path, screenshotFile, { upsert: true });
      if (uploadError) return { success: false, error: `Upload failed: ${uploadError.message}` };
      screenshotUrl = path;
    }

    const updateData: any = { utr };
    if (screenshotUrl) updateData.screenshot_url = screenshotUrl;

    const { error } = await depTable()
      .update(updateData)
      .eq("id", depositId)
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (error) {
      if (error.message?.includes("idx_deposit_utr_unique")) {
        return { success: false, error: "This UTR has already been used. Please check and try again." };
      }
      return { success: false, error: error.message };
    }

    await fetchDeposits();
    return { success: true };
  }, [user, fetchDeposits]);

  // Submit crypto tx hash
  const submitCryptoProof = useCallback(async (
    depositId: string,
    txHash: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await depTable()
      .update({ crypto_tx_hash: txHash })
      .eq("id", depositId)
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (error) return { success: false, error: error.message };
    await fetchDeposits();
    return { success: true };
  }, [user, fetchDeposits]);

  const pendingDeposits = deposits.filter(d => d.status === "pending");

  return {
    deposits,
    pendingDeposits,
    loading,
    platformUpi,
    cryptoAddresses,
    createDeposit,
    submitProof,
    submitCryptoProof,
    refresh: fetchDeposits,
  };
}
