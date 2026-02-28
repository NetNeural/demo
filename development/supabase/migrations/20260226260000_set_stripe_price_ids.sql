-- Set Stripe test-mode Price IDs on per-sensor billing plans
-- These will be replaced with live-mode Price IDs when going to production

UPDATE public.billing_plans
SET stripe_price_id_monthly = 'price_1T5EizRqJM2jmRoCyDcNjJyG',
    stripe_price_id_annual  = 'price_1T5EqWRqJM2jmRoCX23YRXW9',
    updated_at = now()
WHERE slug = 'monitor';

UPDATE public.billing_plans
SET stripe_price_id_monthly = 'price_1T5EkCRqJM2jmRoC8RK6ukGI',
    stripe_price_id_annual  = 'price_1T5EpSRqJM2jmRoCI6KIsOXf',
    updated_at = now()
WHERE slug = 'protect';

UPDATE public.billing_plans
SET stripe_price_id_monthly = 'price_1T5ElpRqJM2jmRoCwH25DknJ',
    stripe_price_id_annual  = 'price_1T5EouRqJM2jmRoCQMD1RKTF',
    updated_at = now()
WHERE slug = 'command';
