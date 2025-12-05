-- Add chain_type and privy_user_id columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "chain_type" VARCHAR(20);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "privy_user_id" VARCHAR(100);
