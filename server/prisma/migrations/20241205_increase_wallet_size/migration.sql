-- Increase wallet_address column sizes to support Solana addresses (44 chars)
-- ETH addresses are 42 chars, SOL addresses are 44 chars

ALTER TABLE "users" ALTER COLUMN "wallet_address" TYPE VARCHAR(64);
ALTER TABLE "watchlists" ALTER COLUMN "wallet_address" TYPE VARCHAR(64);
ALTER TABLE "auth_nonces" ALTER COLUMN "wallet_address" TYPE VARCHAR(64);
