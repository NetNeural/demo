-- Fix Stripe test-mode Price IDs on billing_plans (corrected IDs)

UPDATE public.billing_plans
SET stripe_price_id_monthly = 'price_1T5FXE2NblSBgnwlkZ2zmfaL',
    stripe_price_id_annual  = 'price_1T5Fdc2NblSBgnwl3ByOmLhu',
    updated_at = now()
WHERE slug = 'monitor';

UPDATE public.billing_plans
SET stripe_price_id_monthly = 'price_1T5FYz2NblSBgnwlKBUUcBqE',
    stripe_price_id_annual  = 'price_1T5FcD2NblSBgnwlI04oNxlX',
    updated_at = now()
WHERE slug = 'protect';

UPDATE public.billing_plans
SET stripe_price_id_monthly = 'price_1T5FaC2NblSBgnwlbKy3dgCy',
    stripe_price_id_annual  = 'price_1T5FjQ2NblSBgnwlj7rgUWaJ',
    updated_at = now()
WHERE slug = 'command';
