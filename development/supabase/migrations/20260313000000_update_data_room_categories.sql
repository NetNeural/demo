-- Update Data Room categories to A-K investor/corporate structure
-- Issue: #507 (Feature Request from Heath Scheiman)
-- Replaces old generic categories with structured investor due-diligence folders

-- 1. Map existing documents to the closest new category
UPDATE org_documents SET category = 'operating_contracts' WHERE category = 'contract';
UPDATE org_documents SET category = 'corporate_matters'   WHERE category = 'compliance';
UPDATE org_documents SET category = 'financial_matters'   WHERE category = 'report';
UPDATE org_documents SET category = 'financial_matters'   WHERE category = 'invoice';
UPDATE org_documents SET category = 'operating_contracts' WHERE category = 'agreement';
UPDATE org_documents SET category = 'corporate_matters'   WHERE category = 'other';

-- 2. Drop old CHECK constraint and add new one
ALTER TABLE org_documents DROP CONSTRAINT IF EXISTS org_documents_category_check;
ALTER TABLE org_documents ADD CONSTRAINT org_documents_category_check
  CHECK (category IN (
    'investor_summary',
    'corporate_matters',
    'financial_matters',
    'financing_cap_table',
    'founders_employees_vendors',
    'market_research',
    'product_ip',
    'sales_marketing',
    'operating_contracts',
    'insurance',
    'dod_nih'
  ));

-- 3. Update default
ALTER TABLE org_documents ALTER COLUMN category SET DEFAULT 'investor_summary';
