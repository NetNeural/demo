-- Migration: Add created_by and parent_organization_id to organizations
-- Date: 2026-02-19

ALTER TABLE organizations
ADD COLUMN created_by uuid NULL,
ADD COLUMN parent_organization_id uuid NULL;

-- Optionally, add foreign key constraints if needed:
-- ALTER TABLE organizations
-- ADD CONSTRAINT fk_organizations_created_by FOREIGN KEY (created_by) REFERENCES users(id),
-- ADD CONSTRAINT fk_organizations_parent_organization_id FOREIGN KEY (parent_organization_id) REFERENCES organizations(id);
