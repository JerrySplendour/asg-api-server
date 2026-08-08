-- Run once against the production PostgreSQL database before deploying the
-- dynamic-category release when DB_SYNCHRONIZE is false.
-- Back up the database first. The exact CHECK constraint name varies by the
-- previous TypeORM deployment, so inspect \d visibility_settings and drop its
-- old category constraint if it exists before applying this file.

UPDATE contacts SET category = 'friend' WHERE category = 'regular';
UPDATE contacts SET category = 'public_service' WHERE category = 'untracked';
UPDATE contact_requests SET category = 'friend' WHERE category = 'regular';
UPDATE contact_requests SET category = 'public_service' WHERE category = 'untracked';
UPDATE visibility_settings SET category = 'friend' WHERE category = 'regular';
UPDATE visibility_settings SET category = 'public_service' WHERE category = 'untracked';

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" varchar NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar NOT NULL,
  "behaviorType" varchar NOT NULL DEFAULT 'STANDARD',
  "isSystem" boolean NOT NULL DEFAULT false,
  color varchar NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" varchar NOT NULL UNIQUE,
  "isEnabled" boolean NOT NULL DEFAULT true,
  "lastConfirmedAt" bigint NOT NULL DEFAULT 0,
  "enabledCategories" text NOT NULL DEFAULT 'family',
  "firstNotificationSentAt" bigint NULL,
  "secondNotificationSentAt" bigint NULL,
  "autoPanicTriggeredAt" bigint NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS "fcmToken" varchar;
ALTER TABLE contact_requests ADD COLUMN IF NOT EXISTS "categoryBehaviorType" varchar NOT NULL DEFAULT 'STANDARD';
ALTER TABLE contact_requests ADD COLUMN IF NOT EXISTS "recipientCategory" varchar;
