-- Set NetNeural core team members as platform_admin
-- chris.payne@netneural.org should already be platform_admin from prior migration
-- Adding heath.scheiman@netneural.ai and mike.jordan@netneural.ai

UPDATE public.users
SET role = 'platform_admin'
WHERE email IN (
  'chris.payne@netneural.org',
  'heath.scheiman@netneural.ai',
  'mike.jordan@netneural.ai'
)
AND role != 'platform_admin';
