-- ═══════════════════════════════════════════════════════
-- MISSING SYSTEMS MIGRATION
-- 1. Affiliate/Referral Tagging
-- 2. Locked Funds Wallet
-- 3. Login Anomaly Detection
-- 4. Behavioral Analytics
-- 5. Active Sessions Management
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- ─── 1. AFFILIATE / REFERRAL TAGGING ───

CREATE TABLE IF NOT EXISTS public.affiliates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  commission_rate numeric(5,4) NOT NULL DEFAULT 0.05,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage affiliates" ON public.affiliates
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role manages affiliates" ON public.affiliates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.user_referrals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_id    uuid        REFERENCES public.affiliates(id) ON DELETE SET NULL,
  referral_code   text,
  referred_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  source          text,       -- e.g. 'google_ads', 'organic', 'direct', 'social'
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  landing_url     text,
  created_at      timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_referrals_affiliate ON public.user_referrals(affiliate_id);
CREATE INDEX idx_user_referrals_referred_by ON public.user_referrals(referred_by);

ALTER TABLE public.user_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referral" ON public.user_referrals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own referral" ON public.user_referrals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all referrals" ON public.user_referrals
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role manages referrals" ON public.user_referrals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Referral bonus tracking
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type   text        NOT NULL CHECK (reward_type IN ('signup_bonus', 'first_deposit_bonus', 'commission')),
  amount        numeric(12,2) NOT NULL,
  status        text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'credited', 'expired', 'cancelled')),
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  credited_at   timestamp with time zone
);

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referral rewards" ON public.referral_rewards
  FOR SELECT TO authenticated USING (auth.uid() = referrer_id);
CREATE POLICY "Admins can manage referral rewards" ON public.referral_rewards
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role manages referral rewards" ON public.referral_rewards
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ─── 2. LOCKED FUNDS WALLET ───

ALTER TABLE public.wallet_balances
  ADD COLUMN IF NOT EXISTS locked_balance numeric(12,2) NOT NULL DEFAULT 0;

-- Lock reasons tracking
CREATE TABLE IF NOT EXISTS public.locked_funds (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      numeric(12,2) NOT NULL,
  reason      text        NOT NULL CHECK (reason IN ('wagering_requirement', 'suspicious_activity', 'withdrawal_pending', 'bonus_lock', 'admin_hold')),
  status      text        NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'released', 'forfeited')),
  locked_at   timestamp with time zone NOT NULL DEFAULT now(),
  released_at timestamp with time zone,
  released_by uuid,
  notes       text
);

CREATE INDEX idx_locked_funds_user ON public.locked_funds(user_id);

ALTER TABLE public.locked_funds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own locked funds" ON public.locked_funds
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage locked funds" ON public.locked_funds
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role manages locked funds" ON public.locked_funds
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ─── 3. LOGIN ANOMALY DETECTION ───

CREATE TABLE IF NOT EXISTS public.login_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type      text        NOT NULL CHECK (event_type IN ('login_success', 'login_failed', 'otp_sent', 'otp_verified', 'password_reset', 'oauth_login')),
  ip_address      text,
  user_agent      text,
  device_fingerprint text,
  geo_country     text,
  geo_city        text,
  is_vpn          boolean     DEFAULT false,
  is_new_device   boolean     DEFAULT false,
  is_new_ip       boolean     DEFAULT false,
  risk_flags      text[]      NOT NULL DEFAULT '{}',
  created_at      timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_events_user ON public.login_events(user_id);
CREATE INDEX idx_login_events_created ON public.login_events(created_at DESC);

ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own login events" ON public.login_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own login events" ON public.login_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all login events" ON public.login_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role manages login events" ON public.login_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ─── 4. BEHAVIORAL ANALYTICS ───

CREATE TABLE IF NOT EXISTS public.user_behavior_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  text        NOT NULL,  -- 'page_view', 'bet_view', 'deposit_attempt', 'session_start', 'session_end'
  event_data  jsonb       NOT NULL DEFAULT '{}',
  page_path   text,
  session_id  text,
  duration_ms integer,
  created_at  timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_behavior_events_user ON public.user_behavior_events(user_id);
CREATE INDEX idx_behavior_events_type ON public.user_behavior_events(event_type);
CREATE INDEX idx_behavior_events_created ON public.user_behavior_events(created_at DESC);

ALTER TABLE public.user_behavior_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own behavior events" ON public.user_behavior_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all behavior events" ON public.user_behavior_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role manages behavior events" ON public.user_behavior_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Aggregate stats table (updated periodically)
CREATE TABLE IF NOT EXISTS public.user_behavior_stats (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_sessions        integer     NOT NULL DEFAULT 0,
  avg_session_duration  integer     NOT NULL DEFAULT 0,  -- seconds
  total_page_views      integer     NOT NULL DEFAULT 0,
  deposit_frequency     numeric(5,2) DEFAULT 0,  -- deposits per week
  bet_frequency         numeric(5,2) DEFAULT 0,  -- bets per day
  last_active_at        timestamp with time zone,
  retention_score       numeric(5,2) DEFAULT 0,   -- 0-100
  updated_at            timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_behavior_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view behavior stats" ON public.user_behavior_stats
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role manages behavior stats" ON public.user_behavior_stats
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ─── 5. UPDATE handle_new_user() TO INCLUDE REFERRALS + BEHAVIOR STATS ───

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.wallet_balances (user_id, balance)
    VALUES (NEW.id, 1000.00);
  INSERT INTO public.user_risk_profiles (user_id)
    VALUES (NEW.id);
  INSERT INTO public.user_behavior_stats (user_id)
    VALUES (NEW.id);
  INSERT INTO public.notification_preferences (user_id, channel, category, enabled) VALUES
    (NEW.id, 'in_app', 'bet_results', true), (NEW.id, 'in_app', 'promotions', true),
    (NEW.id, 'in_app', 'odds_alerts', true), (NEW.id, 'in_app', 'transactions', true),
    (NEW.id, 'in_app', 'security', true), (NEW.id, 'email', 'security', true),
    (NEW.id, 'email', 'bet_results', false), (NEW.id, 'email', 'promotions', false),
    (NEW.id, 'email', 'odds_alerts', false), (NEW.id, 'email', 'transactions', false),
    (NEW.id, 'sms', 'security', true), (NEW.id, 'sms', 'bet_results', false),
    (NEW.id, 'sms', 'promotions', false), (NEW.id, 'sms', 'odds_alerts', false),
    (NEW.id, 'sms', 'transactions', false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
