-- ============================================================================
-- Fix API Key Encryption Functions - Parameter Naming
-- ============================================================================
-- Story #96: Fix parameter naming conflict with column names
-- This fixes the "column reference key_id is ambiguous" error
-- ============================================================================

-- Drop old functions
DROP FUNCTION IF EXISTS encrypt_api_key(TEXT, TEXT);
DROP FUNCTION IF EXISTS decrypt_api_key(TEXT, TEXT);

-- Recreate with fixed parameter names (p_key_id instead of key_id)
CREATE OR REPLACE FUNCTION encrypt_api_key(
  plaintext_key TEXT,
  p_key_id TEXT DEFAULT 'default'
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION encrypt_api_key(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION encrypt_api_key(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION decrypt_api_key(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrypt_api_key(TEXT, TEXT) TO service_role;
