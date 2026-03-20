import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useAccountRecovery() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitRecoveryRequest = async (email: string, notes?: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from("account_recovery_requests" as any)
        .insert({
          user_email: email,
          type: "manual_support",
          notes: notes || "User requested manual account recovery",
        });
      if (err) throw err;
      setSubmitted(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit recovery request");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setSubmitted(false);
    setError(null);
  };

  return { submitRecoveryRequest, submitting, submitted, error, reset };
}
