-- DropForeignKey
ALTER TABLE "InventoryItem" DROP CONSTRAINT "InventoryItem_menuItemId_fkey";

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "customName" TEXT,
ADD COLUMN     "customSku" TEXT,
ALTER COLUMN "menuItemId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
