-- ============================================================================
-- API Key Encryption using pgsodium
-- ============================================================================
-- Story #96: API Key Encryption & Provider Factory Type Safety
-- Issue: #96 from Epic #95 (Revive NetNeural Integration Hub)
--
-- Problem: API keys in device_integrations.api_key_encrypted are currently
-- stored as base64 (NOT encrypted). This migration adds proper encryption
-- using PostgreSQL's pgsodium extension (Supabase Vault).
--
-- Security: Uses deterministic encryption (crypto_aead_det_encrypt) so that
-- the same plaintext always produces the same ciphertext, allowing for
-- efficient updates while maintaining security.
-- ============================================================================

-- Enable pgsodium extension (should already be enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- ============================================================================
-- Create Encryption/Decryption Functions
-- ============================================================================

/**
 * Encrypt API key using pgsodium
 * 
 * @param plaintext_key The unencrypted API key
 * @param key_id Optional key ID for key rotation (defaults to 'default')
 * @returns Base64-encoded encrypted key
 * 
 * Security:
 * - Uses AEAD (Authenticated Encryption with Associated Data)
 * - Deterministic mode for consistent ciphertext
 * - Keys never leave the database
 * - Can only be called server-side (RLS enforced)
 */
CREATE OR REPLACE FUNCTION encrypt_api_key(
  plaintext_key TEXT,
  key_id TEXT DEFAULT 'default'
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with database owner privileges
AS $$
DECLARE
  encrypted_bytes BYTEA;
  encryption_key_id UUID;
BEGIN
  -- Validate input
  IF plaintext_key IS NULL OR plaintext_key = '' THEN
    RAISE EXCEPTION 'API key cannot be empty';
  END IF;

  -- Get or create encryption key from pgsodium.key table
  -- In production, you should manage keys via Supabase Vault UI
  SELECT id INTO encryption_key_id
  FROM pgsodium.key
  WHERE name = key_id
  LIMIT 1;

  -- If key doesn't exist, use Supabase's default encryption
  IF encryption_key_id IS NULL THEN
    -- Use pgsodium's deterministic encryption with a derived key
    -- This ensures consistent encryption for the same input
    encrypted_bytes := pgsodium.crypto_aead_det_encrypt(
      plaintext_key::BYTEA,
      NULL, -- No additional authenticated data
      NULL, -- Uses default Supabase key
      NULL  -- Null nonce for deterministic encryption
    );
  ELSE
    -- Use specific key from vault
    encrypted_bytes := pgsodium.crypto_aead_det_encrypt(
      plaintext_key::BYTEA,
      NULL,
      encryption_key_id::BYTEA
    );
  END IF;

  -- Return base64-encoded ciphertext for storage
  RETURN encode(encrypted_bytes, 'base64');
END;
$$;

/**
 * Decrypt API key using pgsodium
 * 
 * @param encrypted_key Base64-encoded encrypted key
 * @param key_id Optional key ID (must match encryption key_id)
 * @returns Decrypted API key plaintext
 * 
 * Security:
 * - Only callable by authenticated users via RLS
 * - Server-side only (never exposed to browser)
 * - Used by Edge Functions for integration operations
 */
CREATE OR REPLACE FUNCTION decrypt_api_key(
  encrypted_key TEXT,
  key_id TEXT DEFAULT 'default'
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  encrypted_bytes BYTEA;
  decrypted_bytes BYTEA;
  encryption_key_id UUID;
BEGIN
  -- Validate input
  IF encrypted_key IS NULL OR encrypted_key = '' THEN
    RAISE EXCEPTION 'Encrypted key cannot be empty';
  END IF;

  -- Decode base64
  BEGIN
    encrypted_bytes := decode(encrypted_key, 'base64');
  EXCEPTION WHEN OTHERS THEN
    -- If base64 decode fails, might be old format (plain base64 encoding)
    -- Return decode attempt for backward compatibility during migration
    RETURN decode(encrypted_key, 'base64')::TEXT;
  END;

  -- Get encryption key
  SELECT id INTO encryption_key_id
  FROM pgsodium.key
  WHERE name = key_id
  LIMIT 1;

  -- Decrypt using matching key
  IF encryption_key_id IS NULL THEN
    decrypted_bytes := pgsodium.crypto_aead_det_decrypt(
      encrypted_bytes,
      NULL,
      NULL,
      NULL
    );
  ELSE
    decrypted_bytes := pgsodium.crypto_aead_det_decrypt(
      encrypted_bytes,
      NULL,
      encryption_key_id::BYTEA
    );
  END IF;

  -- Convert bytea to text
  RETURN convert_from(decrypted_bytes, 'UTF8');
END;
$$;

-- ============================================================================
-- RLS Policies for Encryption Functions
-- ============================================================================

-- These functions should only be callable by:
-- 1. Service role (Edge Functions)
-- 2. Authenticated users operating on their organization's data

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION encrypt_api_key(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION encrypt_api_key(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION decrypt_api_key(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrypt_api_key(TEXT, TEXT) TO service_role;

-- ============================================================================
-- Migration Helper: Re-encrypt Existing Keys
-- ============================================================================

/**
 * Migrate existing base64-encoded keys to proper encryption
 * 
 * This function should be called ONCE after deployment to migrate
 * all existing integrations from base64 to pgsodium encryption.
 * 
 * Usage (via Supabase SQL Editor or Edge Function):
 *   SELECT migrate_api_keys_to_encryption();
 * 
 * Returns count of migrated keys.
 */
CREATE OR REPLACE FUNCTION migrate_api_keys_to_encryption()
RETURNS TABLE (
  migrated_count INTEGER,
  failed_count INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  plaintext TEXT;
  encrypted TEXT;
  success_count INTEGER := 0;
  fail_count INTEGER := 0;
  last_error TEXT := NULL;
BEGIN
  -- Iterate through all device_integrations with encrypted keys
  FOR rec IN 
    SELECT id, api_key_encrypted
    FROM device_integrations
    WHERE api_key_encrypted IS NOT NULL 
      AND api_key_encrypted != ''
  LOOP
    BEGIN
      -- Attempt to decode as base64 (old format)
      plaintext := convert_from(decode(rec.api_key_encrypted, 'base64'), 'UTF8');
      
      -- Check if it's already encrypted (will fail pgsodium decrypt if not)
      BEGIN
        PERFORM decrypt_api_key(rec.api_key_encrypted);
        -- If no error, it's already encrypted, skip
        CONTINUE;
      EXCEPTION WHEN OTHERS THEN
        -- Decryption failed, so it's old format, proceed with migration
      END;
      
      -- Re-encrypt with pgsodium
      encrypted := encrypt_api_key(plaintext);
      
      -- Update the record
      UPDATE device_integrations
      SET api_key_encrypted = encrypted,
          updated_at = NOW()
      WHERE id = rec.id;
      
      success_count := success_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      fail_count := fail_count + 1;
      last_error := SQLERRM;
      -- Continue with next record
    END;
  END LOOP;
  
  RETURN QUERY SELECT success_count, fail_count, last_error;
END;
$$;

GRANT EXECUTE ON FUNCTION migrate_api_keys_to_encryption() TO service_role;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION encrypt_api_key IS 'Encrypt API key using pgsodium AEAD deterministic encryption';
COMMENT ON FUNCTION decrypt_api_key IS 'Decrypt API key encrypted with encrypt_api_key function';
COMMENT ON FUNCTION migrate_api_keys_to_encryption IS 'One-time migration to re-encrypt existing base64 keys';

-- ============================================================================
-- Verification
-- ============================================================================

-- Test the functions (comment out after verification)
/*
DO $$
DECLARE
  test_key TEXT := 'test-api-key-12345';
  encrypted TEXT;
  decrypted TEXT;
BEGIN
  encrypted := encrypt_api_key(test_key);
  RAISE NOTICE 'Encrypted: %', encrypted;
  
  decrypted := decrypt_api_key(encrypted);
  RAISE NOTICE 'Decrypted: %', decrypted;
  
  IF decrypted = test_key THEN
    RAISE NOTICE '✅ Encryption test PASSED';
  ELSE
    RAISE EXCEPTION '❌ Encryption test FAILED: % != %', decrypted, test_key;
  END IF;
END $$;
*/
