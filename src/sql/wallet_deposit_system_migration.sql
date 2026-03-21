-- ═══════════════════════════════════════════════════════
-- WALLET & DEPOSIT SYSTEM MIGRATION
-- 1. Deposit requests table (pending verification)
-- 2. Bonus balance tracking
-- 3. Wagering requirements
-- 4. UTR uniqueness enforcement
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- ─── 1. DEPOSIT REQUESTS ───
-- Every deposit starts as 'pending' and must be admin-verified

CREATE TABLE IF NOT EXISTS public.deposit_requests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  method          text        NOT NULL CHECK (method IN ('upi', 'phonepe', 'netbanking', 'card', 'crypto_btc', 'crypto_usdt')),
  status          text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  
  -- UPI/PhonePe specific
  utr             text,
  screenshot_url  text,
  upi_intent_url  text,
  
  -- Crypto specific
  crypto_address  text,
  crypto_tx_hash  text,
  crypto_confirmations integer DEFAULT 0,
  
  -- Payment gateway reference
  gateway_ref     text,
  
  -- Admin verification
  reviewed_by     uuid        REFERENCES auth.users(id),
  reviewed_at     timestamp with time zone,
  reject_reason   text,
  
  -- Idempotency
  idempotency_key text        UNIQUE,
  
  -- Metadata
  ip_address      text,
  device_fingerprint text,
  metadata        jsonb       DEFAULT '{}',
  
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  expires_at      timestamp with time zone DEFAULT (now() + interval '30 minutes')
);

-- UTR must be unique to prevent fraud (same UTR submitted by multiple accounts)
CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_utr_unique 
  ON public.deposit_requests(utr) WHERE utr IS NOT NULL AND status != 'rejected';

CREATE INDEX idx_deposit_requests_user ON public.deposit_requests(user_id);
CREATE INDEX idx_deposit_requests_status ON public.deposit_requests(status);
CREATE INDEX idx_deposit_requests_created ON public.deposit_requests(created_at DESC);

ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own deposits and create new ones
CREATE POLICY "Users can view own deposits" ON public.deposit_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create deposits" ON public.deposit_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pending deposits" ON public.deposit_requests
  FOR UPDATE TO authenticated USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Admins can view and manage all deposits
CREATE POLICY "Admins can view all deposits" ON public.deposit_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update deposits" ON public.deposit_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Service role full access
CREATE POLICY "Service role manages deposits" ON public.deposit_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ─── 2. BONUS BALANCE & WAGERING ───

CREATE TABLE IF NOT EXISTS public.bonus_balances (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount          numeric(12,2) NOT NULL DEFAULT 0,
  source          text        NOT NULL CHECK (source IN ('signup', 'referral', 'promo', 'deposit_match', 'loyalty')),
  wagering_requirement numeric(12,2) NOT NULL DEFAULT 0,
  wagered_amount  numeric(12,2) NOT NULL DEFAULT 0,
  status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'forfeited')),
  expires_at      timestamp with time zone,
  created_at      timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_bonus_balances_user ON public.bonus_balances(user_id);

ALTER TABLE public.bonus_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bonuses" ON public.bonus_balances
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage bonuses" ON public.bonus_balances
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role manages bonuses" ON public.bonus_balances
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ─── 3. CRYPTO WALLET ADDRESSES (platform receive addresses) ───

CREATE TABLE IF NOT EXISTS public.crypto_addresses (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  currency    text        NOT NULL CHECK (currency IN ('BTC', 'USDT')),
  address     text        NOT NULL,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.crypto_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active crypto addresses" ON public.crypto_addresses
  FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins can manage crypto addresses" ON public.crypto_addresses
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role manages crypto addresses" ON public.crypto_addresses
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ─── 4. PLATFORM UPI CONFIG ───

CREATE TABLE IF NOT EXISTS public.platform_config (
  key         text        PRIMARY KEY,
  value       jsonb       NOT NULL,
  updated_at  timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read platform config" ON public.platform_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage platform config" ON public.platform_config
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role manages platform config" ON public.platform_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Insert default UPI config
INSERT INTO public.platform_config (key, value) VALUES
  ('upi_pay_id', '"merchant@upi"'::jsonb),
  ('upi_pay_name', '"LiveBet"'::jsonb),
  ('crypto_btc_address', '"bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"'::jsonb),
  ('crypto_usdt_address', '"TXqHbR5VpnJEzDKRQZJvkjfBJx9dWKqzDN"'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- ─── 5. STORAGE BUCKET FOR PAYMENT SCREENSHOTS ───

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('payment-screenshots', 'payment-screenshots', false, 5242880)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload screenshots
CREATE POLICY "Users can upload payment screenshots"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to view their own screenshots
CREATE POLICY "Users can view own screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Admins can view all screenshots
CREATE POLICY "Admins can view all payment screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-screenshots' AND public.has_role(auth.uid(), 'admin'));
