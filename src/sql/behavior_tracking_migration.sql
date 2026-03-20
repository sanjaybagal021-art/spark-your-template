-- ═══════════════════════════════════════════════════════
-- BEHAVIOR TRACKING MIGRATION
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════

-- 1. USER RISK PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.user_risk_profiles (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  risk_score             integer     NOT NULL DEFAULT 0,
  risk_level             text        NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','critical')),
  account_status         text        NOT NULL DEFAULT 'active' CHECK (account_status IN ('active','restricted','suspended','under_review','blocked')),
  max_bet_override       numeric,
  blocked_markets        text[]      NOT NULL DEFAULT '{}',
  bonuses_disabled       boolean     NOT NULL DEFAULT false,
  withdrawal_delay_hours integer     NOT NULL DEFAULT 0,
  flags                  text[]      NOT NULL DEFAULT '{}',
  betting_behavior_score numeric(5,2) DEFAULT 0,
  fraud_flags            text[]       NOT NULL DEFAULT '{}',
  ip_history             text[]       NOT NULL DEFAULT '{}',
  last_calculated_at     timestamp with time zone,
  created_at             timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_risk_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own risk profile" ON public.user_risk_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all risk profiles" ON public.user_risk_profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update risk profiles" ON public.user_risk_profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role manages risk profiles" ON public.user_risk_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. USER DEVICE SESSIONS
CREATE TABLE IF NOT EXISTS public.user_device_sessions (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint text        NOT NULL,
  ip_address         text,
  user_agent         text,
  screen_resolution  text,
  timezone           text,
  last_seen_at       timestamp with time zone NOT NULL DEFAULT now(),
  created_at         timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_sessions_user ON public.user_device_sessions(user_id);
CREATE INDEX idx_device_sessions_fingerprint ON public.user_device_sessions(device_fingerprint);
CREATE INDEX idx_device_sessions_ip ON public.user_device_sessions(ip_address);

ALTER TABLE public.user_device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own device sessions" ON public.user_device_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own device sessions" ON public.user_device_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can select own device sessions" ON public.user_device_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all device sessions" ON public.user_device_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role manages device sessions" ON public.user_device_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. LINKED ACCOUNTS
DO $$ BEGIN CREATE TYPE public.link_type AS ENUM ('same_ip', 'same_device', 'same_payment', 'same_kyc'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.link_action AS ENUM ('none', 'flagged', 'frozen', 'banned'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.linked_accounts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_a        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_b        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  link_type        link_type   NOT NULL,
  confidence_score numeric(3,2) NOT NULL DEFAULT 0.5,
  detected_at      timestamp with time zone NOT NULL DEFAULT now(),
  action_taken     link_action NOT NULL DEFAULT 'none',
  action_by        uuid,
  action_at        timestamp with time zone,
  notes            text,
  UNIQUE(account_a, account_b, link_type)
);

ALTER TABLE public.linked_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view linked accounts" ON public.linked_accounts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update linked accounts" ON public.linked_accounts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role manages linked accounts" ON public.linked_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. DETECT MULTI-ACCOUNTS FUNCTION
CREATE OR REPLACE FUNCTION public.detect_multi_accounts()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0;
BEGIN
  INSERT INTO public.linked_accounts (account_a, account_b, link_type, confidence_score)
  SELECT DISTINCT LEAST(a.user_id, b.user_id), GREATEST(a.user_id, b.user_id), 'same_device'::link_type, 0.9
  FROM public.user_device_sessions a JOIN public.user_device_sessions b
    ON a.device_fingerprint = b.device_fingerprint AND a.user_id <> b.user_id AND a.device_fingerprint IS NOT NULL AND a.device_fingerprint <> ''
  ON CONFLICT (account_a, account_b, link_type) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.linked_accounts (account_a, account_b, link_type, confidence_score)
  SELECT DISTINCT LEAST(a.user_id, b.user_id), GREATEST(a.user_id, b.user_id), 'same_ip'::link_type, 0.6
  FROM public.user_device_sessions a JOIN public.user_device_sessions b
    ON a.ip_address = b.ip_address AND a.user_id <> b.user_id AND a.ip_address IS NOT NULL
  ON CONFLICT (account_a, account_b, link_type) DO NOTHING;
  GET DIAGNOSTICS v_count = v_count + ROW_COUNT;

  INSERT INTO public.linked_accounts (account_a, account_b, link_type, confidence_score)
  SELECT DISTINCT LEAST(a.user_id, b.user_id), GREATEST(a.user_id, b.user_id), 'same_payment'::link_type, 0.85
  FROM public.payment_methods a JOIN public.payment_methods b
    ON a.details = b.details AND a.type = b.type AND a.user_id <> b.user_id
  ON CONFLICT (account_a, account_b, link_type) DO NOTHING;
  GET DIAGNOSTICS v_count = v_count + ROW_COUNT;

  INSERT INTO public.linked_accounts (account_a, account_b, link_type, confidence_score)
  SELECT DISTINCT LEAST(a.user_id, b.user_id), GREATEST(a.user_id, b.user_id), 'same_kyc'::link_type, 0.95
  FROM public.profiles a JOIN public.profiles b
    ON a.user_id <> b.user_id AND ((a.pan_number IS NOT NULL AND a.pan_number = b.pan_number) OR (a.aadhaar_number IS NOT NULL AND a.aadhaar_number = b.aadhaar_number))
  ON CONFLICT (account_a, account_b, link_type) DO NOTHING;
  GET DIAGNOSTICS v_count = v_count + ROW_COUNT;

  UPDATE public.user_risk_profiles SET fraud_flags = array_append(fraud_flags, 'multi_account_detected')
  WHERE user_id IN (SELECT account_a FROM public.linked_accounts WHERE action_taken = 'none' UNION SELECT account_b FROM public.linked_accounts WHERE action_taken = 'none')
  AND NOT ('multi_account_detected' = ANY(fraud_flags));

  RETURN jsonb_build_object('new_links', v_count);
END; $$;

-- 5. NOTIFICATION PREFERENCES
DO $$ BEGIN CREATE TYPE public.notif_channel AS ENUM ('email', 'sms', 'in_app'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.notif_category AS ENUM ('bet_results', 'promotions', 'odds_alerts', 'transactions', 'security'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id         uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel    notif_channel  NOT NULL,
  category   notif_category NOT NULL,
  enabled    boolean        NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel, category)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification prefs" ON public.notification_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notification prefs" ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notification prefs" ON public.notification_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role manages notification prefs" ON public.notification_preferences FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. ACCOUNT RECOVERY REQUESTS
DO $$ BEGIN CREATE TYPE public.recovery_type AS ENUM ('password_reset', 'manual_support'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.recovery_status AS ENUM ('pending', 'verified', 'completed', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.account_recovery_requests (
  id          uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email  text            NOT NULL,
  user_id     uuid            REFERENCES auth.users(id) ON DELETE SET NULL,
  type        recovery_type   NOT NULL,
  status      recovery_status NOT NULL DEFAULT 'pending',
  ip_address  text,
  notes       text,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  created_at  timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.account_recovery_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view recovery requests" ON public.account_recovery_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update recovery requests" ON public.account_recovery_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can insert recovery requests" ON public.account_recovery_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anon can insert recovery requests" ON public.account_recovery_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Service role manages recovery requests" ON public.account_recovery_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. UPDATE handle_new_user() to create risk profile + default notification prefs
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.wallet_balances (user_id, balance)
    VALUES (NEW.id, 1000.00);
  INSERT INTO public.user_risk_profiles (user_id)
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
