-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "emailOptIn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "textOptIn" BOOLEAN NOT NULL DEFAULT true;
