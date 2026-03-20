import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

/**
 * Captures referral/affiliate data from URL params on signup.
 * Reads: ?ref=CODE, ?aff=CODE, utm_source, utm_medium, utm_campaign
 * Stores once per user into user_referrals table.
 */
export function useAffiliateTracking() {
  const { user } = useAuth();
  const tracked = useRef(false);

  useEffect(() => {
    if (!user || tracked.current) return;
    tracked.current = true;

    const track = async () => {
      // Check if already tracked
      const { data: existing } = await supabase
        .from("user_referrals" as any)
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) return; // Already recorded

      // Read from sessionStorage (captured at page load before auth)
      const refData = sessionStorage.getItem("livebet_ref");
      if (!refData) {
        // Still insert a record with source = 'direct'
        await supabase.from("user_referrals" as any).insert({
          user_id: user.id,
          source: "direct",
        });
        return;
      }

      const params = JSON.parse(refData);

      // If there's a referral code, look up the affiliate
      let affiliateId: string | null = null;
      const refCode = params.ref || params.aff;
      if (refCode) {
        const { data: aff } = await supabase
          .from("affiliates" as any)
          .select("id")
          .eq("code", refCode)
          .eq("is_active", true)
          .maybeSingle();
        affiliateId = (aff as any)?.id ?? null;
      }

      // Look up referrer user if ref code matches a user's referral code
      let referredBy: string | null = null;
      if (refCode && !affiliateId) {
        const { data: referrer } = await supabase
          .from("user_referrals" as any)
          .select("user_id")
          .eq("referral_code", refCode)
          .maybeSingle();
        referredBy = (referrer as any)?.user_id ?? null;
      }

      await supabase.from("user_referrals" as any).insert({
        user_id: user.id,
        affiliate_id: affiliateId,
        referral_code: generateReferralCode(user.id),
        referred_by: referredBy,
        source: params.utm_source || (refCode ? "referral" : "direct"),
        utm_source: params.utm_source || null,
        utm_medium: params.utm_medium || null,
        utm_campaign: params.utm_campaign || null,
        landing_url: params.landing_url || null,
      });

      sessionStorage.removeItem("livebet_ref");
    };

    track().catch(console.error);
  }, [user]);
}

/** Generate a short referral code from user ID */
function generateReferralCode(userId: string): string {
  return userId.slice(0, 8).toUpperCase();
}

/**
 * Call this on page load BEFORE auth to capture URL params.
 * Should be called once in main.tsx or index.html.
 */
export function captureReferralParams() {
  const url = new URL(window.location.href);
  const ref = url.searchParams.get("ref") || url.searchParams.get("aff");
  const utmSource = url.searchParams.get("utm_source");
  const utmMedium = url.searchParams.get("utm_medium");
  const utmCampaign = url.searchParams.get("utm_campaign");

  if (ref || utmSource) {
    sessionStorage.setItem("livebet_ref", JSON.stringify({
      ref,
      aff: url.searchParams.get("aff"),
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      landing_url: window.location.pathname,
    }));
  }
}
