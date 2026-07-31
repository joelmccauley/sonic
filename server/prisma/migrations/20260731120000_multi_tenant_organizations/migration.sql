-- Multi-tenant: Organizations, plans, subscriptions
-- Creates Organization, backfills a default org (id 1) for existing rows,
-- and scopes previously-global unique constraints per organization.

-- ── Enums ────────────────────────────────────────────────────────────────────
CREATE TYPE "PlanTier" AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- ── Organization table ───────────────────────────────────────────────────────
CREATE TABLE "Organization" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "planTier" "PlanTier" NOT NULL DEFAULT 'STARTER',
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization"("stripeCustomerId");
CREATE UNIQUE INDEX "Organization_stripeSubscriptionId_key" ON "Organization"("stripeSubscriptionId");
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- ── Backfill default organization for pre-existing data ─────────────────────
INSERT INTO "Organization" ("name", "slug", "email", "planTier", "subscriptionStatus", "isActive", "updatedAt")
VALUES ('SonicPOS Restaurant', 'sonicpos-restaurant', 'admin@sonicpos.com', 'ENTERPRISE', 'ACTIVE', true, CURRENT_TIMESTAMP);

-- ── User ─────────────────────────────────────────────────────────────────────
ALTER TABLE "User" ADD COLUMN "organizationId" INTEGER;
ALTER TABLE "User" ADD COLUMN "googleId" TEXT;
UPDATE "User" SET "organizationId" = 1;
ALTER TABLE "User" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "User_username_key";
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX "User_organizationId_username_key" ON "User"("organizationId", "username");
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Table ────────────────────────────────────────────────────────────────────
ALTER TABLE "Table" ADD COLUMN "organizationId" INTEGER;
UPDATE "Table" SET "organizationId" = 1;
ALTER TABLE "Table" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Table_organizationId_idx" ON "Table"("organizationId");
ALTER TABLE "Table" ADD CONSTRAINT "Table_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── MenuCategory ─────────────────────────────────────────────────────────────
ALTER TABLE "MenuCategory" ADD COLUMN "organizationId" INTEGER;
UPDATE "MenuCategory" SET "organizationId" = 1;
ALTER TABLE "MenuCategory" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "MenuCategory_organizationId_idx" ON "MenuCategory"("organizationId");
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── MenuItem ─────────────────────────────────────────────────────────────────
ALTER TABLE "MenuItem" ADD COLUMN "organizationId" INTEGER;
UPDATE "MenuItem" SET "organizationId" = 1;
ALTER TABLE "MenuItem" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "MenuItem_sku_key";
CREATE UNIQUE INDEX "MenuItem_organizationId_sku_key" ON "MenuItem"("organizationId", "sku");
CREATE INDEX "MenuItem_organizationId_idx" ON "MenuItem"("organizationId");
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── ModifierGroup ────────────────────────────────────────────────────────────
ALTER TABLE "ModifierGroup" ADD COLUMN "organizationId" INTEGER;
UPDATE "ModifierGroup" SET "organizationId" = 1;
ALTER TABLE "ModifierGroup" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "ModifierGroup_organizationId_idx" ON "ModifierGroup"("organizationId");
ALTER TABLE "ModifierGroup" ADD CONSTRAINT "ModifierGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Order ────────────────────────────────────────────────────────────────────
ALTER TABLE "Order" ADD COLUMN "organizationId" INTEGER;
UPDATE "Order" SET "organizationId" = 1;
ALTER TABLE "Order" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "Order_orderNumber_key";
CREATE UNIQUE INDEX "Order_organizationId_orderNumber_key" ON "Order"("organizationId", "orderNumber");
CREATE INDEX "Order_organizationId_idx" ON "Order"("organizationId");
ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Payment ──────────────────────────────────────────────────────────────────
ALTER TABLE "Payment" ADD COLUMN "organizationId" INTEGER;
UPDATE "Payment" SET "organizationId" = 1;
ALTER TABLE "Payment" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Payment_organizationId_idx" ON "Payment"("organizationId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Discount ─────────────────────────────────────────────────────────────────
ALTER TABLE "Discount" ADD COLUMN "organizationId" INTEGER;
UPDATE "Discount" SET "organizationId" = 1;
ALTER TABLE "Discount" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "Discount_code_key";
CREATE UNIQUE INDEX "Discount_organizationId_code_key" ON "Discount"("organizationId", "code");
CREATE INDEX "Discount_organizationId_idx" ON "Discount"("organizationId");
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Shift ────────────────────────────────────────────────────────────────────
ALTER TABLE "Shift" ADD COLUMN "organizationId" INTEGER;
UPDATE "Shift" SET "organizationId" = 1;
ALTER TABLE "Shift" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Shift_organizationId_idx" ON "Shift"("organizationId");
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── InventoryItem ────────────────────────────────────────────────────────────
ALTER TABLE "InventoryItem" ADD COLUMN "organizationId" INTEGER;
UPDATE "InventoryItem" SET "organizationId" = 1;
ALTER TABLE "InventoryItem" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "InventoryItem_organizationId_idx" ON "InventoryItem"("organizationId");
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Customer ─────────────────────────────────────────────────────────────────
ALTER TABLE "Customer" ADD COLUMN "organizationId" INTEGER;
UPDATE "Customer" SET "organizationId" = 1;
ALTER TABLE "Customer" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "Customer_email_key";
DROP INDEX IF EXISTS "Customer_phone_key";
CREATE UNIQUE INDEX "Customer_organizationId_email_key" ON "Customer"("organizationId", "email");
CREATE UNIQUE INDEX "Customer_organizationId_phone_key" ON "Customer"("organizationId", "phone");
CREATE INDEX "Customer_organizationId_idx" ON "Customer"("organizationId");
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── AuditLog ─────────────────────────────────────────────────────────────────
ALTER TABLE "AuditLog" ADD COLUMN "organizationId" INTEGER;
UPDATE "AuditLog" SET "organizationId" = 1;
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Printer ──────────────────────────────────────────────────────────────────
ALTER TABLE "Printer" ADD COLUMN "organizationId" INTEGER;
UPDATE "Printer" SET "organizationId" = 1;
ALTER TABLE "Printer" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Printer_organizationId_idx" ON "Printer"("organizationId");
ALTER TABLE "Printer" ADD CONSTRAINT "Printer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Setting ──────────────────────────────────────────────────────────────────
ALTER TABLE "Setting" ADD COLUMN "organizationId" INTEGER;
UPDATE "Setting" SET "organizationId" = 1;
ALTER TABLE "Setting" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "Setting_key_key";
CREATE UNIQUE INDEX "Setting_organizationId_key_key" ON "Setting"("organizationId", "key");
CREATE INDEX "Setting_organizationId_idx" ON "Setting"("organizationId");
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
