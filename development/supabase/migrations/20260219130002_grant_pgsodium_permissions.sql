-- ============================================================================
-- Grant pgsodium permissions for encryption functions
-- ============================================================================
-- Story #96: API Key Encryption
-- Grant necessary permissions for encrypt/decrypt functions to use pgsodium
-- ============================================================================

-- Grant execute on pgsodium crypto functions to the definer role
-- Since our functions use SECURITY DEFINER, they run as the database owner
-- The postgres role should already have access, but let's be explicit

-- Note: In Supabase, pgsodium functions are available to postgres role by default
-- Our SECURITY DEFINER functions run as postgres, so they should work
-- This migration documents the expected permissions

-- Verify pgsodium is accessible
DO $$
BEGIN
  -- Test if we can call pgsodium functions
  PERFORM pgsodium.crypto_aead_det_encrypt(
    'test'::BYTEA,
    NULL,
    NULL,
    NULL
  );
  RAISE NOTICE 'pgsodium crypto functions are accessible';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pgsodium crypto functions may not be accessible: %', SQLERRM;
END $$;

-- Update function definitions to use explicit schema
CREATE OR REPLACE FUNCTION encrypt_api_key(
  plaintext_key TEXT,
  p_key_id TEXT DEFAULT 'default'
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $$
DECLARE
  encrypted_bytes BYTEA;
  encryption_key_id UUID;
BEGIN
  IF plaintext_key IS NULL OR plaintext_key = '' THEN
    RAISE EXCEPTION 'API key cannot be empty';
  END IF;

  SELECT id INTO encryption_key_id
  FROM pgsodium.key
  WHERE name = p_key_id
  LIMIT 1;

  IF encryption_key_id IS NULL THEN
    encrypted_bytes := pgsodium.crypto_aead_det_encrypt(
      plaintext_key::BYTEA,
      NULL,
      NULL,
      NULL
    );
  ELSE
    encrypted_bytes := pgsodium.crypto_aead_det_encrypt(
      plaintext_key::BYTEA,
      NULL,
      encryption_key_id::BYTEA
    );
  END IF;

  RETURN encode(encrypted_bytes, 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_api_key(
  encrypted_key TEXT,
  p_key_id TEXT DEFAULT 'default'
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $$
DECLARE
  encrypted_bytes BYTEA;
  decrypted_bytes BYTEA;
  encryption_key_id UUID;
BEGIN
  IF encrypted_key IS NULL OR encrypted_key = '' THEN
    RAISE EXCEPTION 'Encrypted key cannot be empty';
  END IF;

  BEGIN
    encrypted_bytes := decode(encrypted_key, 'base64');
  EXCEPTION WHEN OTHERS THEN
    RETURN decode(encrypted_key, 'base64')::TEXT;
  END;

  SELECT id INTO encryption_key_id
  FROM pgsodium.key
  WHERE name = p_key_id
  LIMIT 1;

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

  RETURN convert_from(decrypted_bytes, 'UTF8');
END;
$$;
