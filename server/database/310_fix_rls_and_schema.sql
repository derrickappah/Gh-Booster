-- ========================================================
-- GhBooster Migration 310: Fix RLS Policies & Schema Gaps
-- Fixes: HIGH-04, HIGH-05, MED-09, LOW-04, LOW-08
-- ========================================================

-- =============================================
-- LOW-04: Add 'super_admin' to profiles role CHECK
-- =============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'profiles' AND constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  END IF;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('user', 'admin', 'super_admin', 'staff', 'reseller'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'profiles_role_check update skipped: %', SQLERRM;
END $$;

-- =============================================
-- LOW-08: Add updated_at to transactions if missing
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.transactions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- =============================================
-- HIGH-04: Restrict settings table to admin-only
-- =============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings') THEN
    -- Drop the overly permissive public policy
    DROP POLICY IF EXISTS settings_select_all ON public.settings;

    -- Create admin-only SELECT policy
    CREATE POLICY settings_select_admin ON public.settings FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
        )
      );

    -- Create admin-only UPDATE policy
    DROP POLICY IF EXISTS settings_update_admin ON public.settings;
    CREATE POLICY settings_update_admin ON public.settings FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
        )
      );

    -- Create admin-only INSERT policy
    DROP POLICY IF EXISTS settings_insert_admin ON public.settings;
    CREATE POLICY settings_insert_admin ON public.settings FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
        )
      );
  END IF;
END $$;

-- =============================================
-- HIGH-05: Restrict providers table to admin-only
-- =============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'providers') THEN
    ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS providers_select_admin ON public.providers;
    CREATE POLICY providers_select_admin ON public.providers FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
        )
      );

    DROP POLICY IF EXISTS providers_all_admin ON public.providers;
    CREATE POLICY providers_all_admin ON public.providers FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
        )
      );
  END IF;
END $$;

-- =============================================
-- MED-09: Add missing INSERT/UPDATE/DELETE policies
-- =============================================

-- Wallets: users can only SELECT their own, no direct modifications
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wallets') THEN
    DROP POLICY IF EXISTS wallets_deny_user_update ON public.wallets;
    CREATE POLICY wallets_deny_user_update ON public.wallets FOR UPDATE
      USING (false); -- Users cannot update wallets directly; only service role can

    DROP POLICY IF EXISTS wallets_deny_user_insert ON public.wallets;
    CREATE POLICY wallets_deny_user_insert ON public.wallets FOR INSERT
      WITH CHECK (false); -- Users cannot insert wallets directly

    DROP POLICY IF EXISTS wallets_deny_user_delete ON public.wallets;
    CREATE POLICY wallets_deny_user_delete ON public.wallets FOR DELETE
      USING (false); -- Users cannot delete wallets
  END IF;
END $$;

-- Transactions: users can only SELECT their own, no direct modifications
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    DROP POLICY IF EXISTS transactions_deny_user_update ON public.transactions;
    CREATE POLICY transactions_deny_user_update ON public.transactions FOR UPDATE
      USING (false);

    DROP POLICY IF EXISTS transactions_deny_user_insert ON public.transactions;
    CREATE POLICY transactions_deny_user_insert ON public.transactions FOR INSERT
      WITH CHECK (false);

    DROP POLICY IF EXISTS transactions_deny_user_delete ON public.transactions;
    CREATE POLICY transactions_deny_user_delete ON public.transactions FOR DELETE
      USING (false);
  END IF;
END $$;

-- Orders: users can only SELECT their own, no direct modifications
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    DROP POLICY IF EXISTS orders_deny_user_update ON public.orders;
    CREATE POLICY orders_deny_user_update ON public.orders FOR UPDATE
      USING (false);

    DROP POLICY IF EXISTS orders_deny_user_insert ON public.orders;
    CREATE POLICY orders_deny_user_insert ON public.orders FOR INSERT
      WITH CHECK (false);

    DROP POLICY IF EXISTS orders_deny_user_delete ON public.orders;
    CREATE POLICY orders_deny_user_delete ON public.orders FOR DELETE
      USING (false);
  END IF;
END $$;

-- Announcements: admin-only write
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'announcements') THEN
    DROP POLICY IF EXISTS announcements_insert_admin ON public.announcements;
    CREATE POLICY announcements_insert_admin ON public.announcements FOR INSERT
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
      );

    DROP POLICY IF EXISTS announcements_update_admin ON public.announcements;
    CREATE POLICY announcements_update_admin ON public.announcements FOR UPDATE
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
      );

    DROP POLICY IF EXISTS announcements_delete_admin ON public.announcements;
    CREATE POLICY announcements_delete_admin ON public.announcements FOR DELETE
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
      );
  END IF;
END $$;
