-- Run this once against your PostgreSQL database to create the tables.
-- Example: psql -U postgres -d storage_server -f sql/schema.sql

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    storage_limit   BIGINT NOT NULL DEFAULT 5368709120, -- bytes, default 5GB
    storage_used    BIGINT NOT NULL DEFAULT 0,           -- bytes
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS files (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename        VARCHAR(255) NOT NULL,      -- name stored on disk (uuid-based)
    original_name   VARCHAR(255) NOT NULL,      -- name the user uploaded it as
    folder_path     VARCHAR(1024) NOT NULL DEFAULT '/', -- virtual folder, e.g. /photos/2024
    size            BIGINT NOT NULL,            -- bytes
    mime_type       VARCHAR(255),
    storage_path    VARCHAR(1024) NOT NULL,     -- actual path/key on disk (or future S3 key)
    share_token     VARCHAR(64) UNIQUE,         -- set when a share link is generated
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_share_token ON files(share_token);

-- Not used yet, but modeled now so billing can be added later without
-- reworking the schema.
CREATE TABLE IF NOT EXISTS subscription_plans (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(100) NOT NULL,
    storage_limit_gb  INTEGER NOT NULL,
    price_per_month   NUMERIC(10, 2) NOT NULL
);
