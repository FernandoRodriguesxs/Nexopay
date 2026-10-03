-- CreateEnum
CREATE TYPE "environment" AS ENUM ('SANDBOX', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "merchant_role" AS ENUM ('OWNER', 'ADMIN', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "audit_actor_type" AS ENUM ('USER', 'API_KEY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "idempotency_key_status" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "absolute_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_member" (
    "id" UUID NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "merchant_role" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "environment" "environment" NOT NULL,
    "name" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "hint" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_by_user_id" TEXT,

    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_key" (
    "id" UUID NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "environment" "environment" NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" "idempotency_key_status" NOT NULL,
    "resource_id" TEXT,
    "response_status" INTEGER,
    "response_body" JSONB,
    "locked_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "merchant_id" TEXT,
    "environment" "environment",
    "actor_type" "audit_actor_type" NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_hash_key" ON "session"("token_hash");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE INDEX "session_expires_at_idx" ON "session"("expires_at");

-- CreateIndex
CREATE INDEX "merchant_member_user_id_idx" ON "merchant_member"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_member_merchant_id_user_id_key" ON "merchant_member"("merchant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_hash_key" ON "api_key"("hash");

-- CreateIndex
CREATE INDEX "api_key_merchant_id_environment_id_idx" ON "api_key"("merchant_id", "environment", "id" DESC);

-- CreateIndex
CREATE INDEX "idempotency_key_expires_at_idx" ON "idempotency_key"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_key_merchant_id_environment_key_key" ON "idempotency_key"("merchant_id", "environment", "key");

-- CreateIndex
CREATE INDEX "audit_log_merchant_id_created_at_idx" ON "audit_log"("merchant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_actor_type_actor_id_created_at_idx" ON "audit_log"("actor_type", "actor_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_member" ADD CONSTRAINT "merchant_member_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_member" ADD CONSTRAINT "merchant_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_key" ADD CONSTRAINT "idempotency_key_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- Constraints de integridade não expressáveis no schema Prisma.
-- Defesa em profundidade: a aplicação já garante estas regras.
-- ─────────────────────────────────────────────────────────────

-- IDs públicos sempre com o prefixo da entidade.
ALTER TABLE "user" ADD CONSTRAINT "user_id_prefix_check" CHECK ("id" ~ '^usr_[0-9A-HJKMNP-TV-Z]{26}$');
ALTER TABLE "merchant" ADD CONSTRAINT "merchant_id_prefix_check" CHECK ("id" ~ '^mer_[0-9A-HJKMNP-TV-Z]{26}$');
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_id_prefix_check" CHECK ("id" ~ '^key_[0-9A-HJKMNP-TV-Z]{26}$');

-- Email sempre normalizado: impede contas duplicadas por diferença de caixa.
ALTER TABLE "user" ADD CONSTRAINT "user_email_lowercase_check" CHECK ("email" = lower("email"));

-- A dica da API Key corresponde ao ambiente (sk_test_ ⇔ SANDBOX, sk_live_ ⇔ PRODUCTION).
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_hint_environment_check" CHECK (
  ("environment" = 'SANDBOX' AND "hint" LIKE 'sk\_test\_%')
  OR ("environment" = 'PRODUCTION' AND "hint" LIKE 'sk\_live\_%')
);

-- Hash HMAC-SHA256 em hex (64 caracteres).
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_hash_format_check" CHECK ("hash" ~ '^[0-9a-f]{64}$');

-- Quem revogou só existe se a key foi revogada.
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_revoked_by_check" CHECK ("revoked_by_user_id" IS NULL OR "revoked_at" IS NOT NULL);

-- SHA-256 do token de sessão em hex; expiração deslizante nunca ultrapassa a absoluta.
ALTER TABLE "session" ADD CONSTRAINT "session_token_hash_format_check" CHECK ("token_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "session" ADD CONSTRAINT "session_expiration_check" CHECK ("expires_at" <= "absolute_expires_at");

-- Audit log é append-only.
CREATE FUNCTION "audit_log_prevent_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_log_append_only"
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_prevent_mutation"();
