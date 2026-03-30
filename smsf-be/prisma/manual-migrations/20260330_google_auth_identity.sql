ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(32) NOT NULL DEFAULT 'local';

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255);

UPDATE users
SET auth_provider = 'local'
WHERE auth_provider IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_key
    ON users (google_sub)
    WHERE google_sub IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_auth_provider_email_idx
    ON users (auth_provider, LOWER(email));
