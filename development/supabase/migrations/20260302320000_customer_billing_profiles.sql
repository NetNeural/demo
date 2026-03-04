-- #380: Customer billing profile table
-- Stores billing contact info separate from org settings:
--   billing name, email, company, address, tax ID, VAT.
-- Populated at signup or when customer edits billing contact in the UI.
-- Stripe webhook handler should update stripe_customer_id here too.

CREATE TABLE IF NOT EXISTS public.customer_billing_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Billing contact info
  billing_name        TEXT,                            -- Full name on invoice
  billing_email       TEXT,                            -- Separate from account email
  company_name        TEXT,                            -- Legal entity name

  -- Billing address
  address_line1       TEXT,
  address_line2       TEXT,
  city                TEXT,
  state               TEXT,
  postal_code         TEXT,
  country             TEXT DEFAULT 'US',

  -- Tax
  tax_id              TEXT,                            -- VAT / EIN / GST
  tax_id_type         TEXT,                            -- 'us_ein', 'eu_vat', etc.

  -- Stripe identifiers (mirrors organizations.stripe_customer_id for convenience)
  stripe_customer_id  TEXT,

  -- Metadata
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.customer_billing_profiles IS
  'Billing contact and address info per organization. Distinct from org settings to '
  'allow a separate billing email/contact without changing account settings.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_billing_profiles_org
  ON public.customer_billing_profiles(organization_id);

CREATE INDEX IF NOT EXISTS idx_billing_profiles_stripe_customer
  ON public.customer_billing_profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_billing_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_profiles_updated_at ON public.customer_billing_profiles;
CREATE TRIGGER trg_billing_profiles_updated_at
  BEFORE UPDATE ON public.customer_billing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_billing_profile_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.customer_billing_profiles ENABLE ROW LEVEL SECURITY;

-- Org members can read their own billing profile
DROP POLICY IF EXISTS "Org members read own billing profile" ON public.customer_billing_profiles;
CREATE POLICY "Org members read own billing profile"
  ON public.customer_billing_profiles FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Org owners/admins can update their billing profile
DROP POLICY IF EXISTS "Org admins update billing profile" ON public.customer_billing_profiles;
CREATE POLICY "Org admins update billing profile"
  ON public.customer_billing_profiles FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Org owners/admins can insert (first-time creation)
DROP POLICY IF EXISTS "Org admins insert billing profile" ON public.customer_billing_profiles;
CREATE POLICY "Org admins insert billing profile"
  ON public.customer_billing_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Super admins full access
DROP POLICY IF EXISTS "Super admins full access on billing profiles" ON public.customer_billing_profiles;
CREATE POLICY "Super admins full access on billing profiles"
  ON public.customer_billing_profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- Service role full access (webhooks write stripe_customer_id)
DROP POLICY IF EXISTS "Service role full access on billing profiles" ON public.customer_billing_profiles;
CREATE POLICY "Service role full access on billing profiles"
  ON public.customer_billing_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Auto-create an empty billing profile when an org is created
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_billing_profile_for_org()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.customer_billing_profiles (organization_id, company_name)
  VALUES (NEW.id, NEW.name)
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_billing_profile ON public.organizations;
CREATE TRIGGER trg_create_billing_profile
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.create_billing_profile_for_org();

-- Back-fill existing orgs that don't have a profile yet
INSERT INTO public.customer_billing_profiles (organization_id, company_name)
SELECT id, name FROM public.organizations
ON CONFLICT (organization_id) DO NOTHING;
