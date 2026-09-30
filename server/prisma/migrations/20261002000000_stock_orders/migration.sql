-- CreateEnum
CREATE TYPE "WarehouseMovementType" AS ENUM ('INBOUND', 'ORDER_SHIPPED', 'RETURN_RECEIVED', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "FieldStockMovementType" AS ENUM ('OPENING', 'ORDER_RECEIVED', 'SALE_APPROVED', 'RETURN_RECEIVED', 'CORRECTION', 'HANDOVER_OUT', 'HANDOVER_IN');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'SHIPPED', 'RECEIVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalEntity" AS ENUM ('ORDER', 'SALES_REPORT', 'RETURN', 'LEAVE', 'MOU');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "WarehouseStock" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "WarehouseMovementType" NOT NULL,
    "qty" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "poNumber" TEXT,
    "note" TEXT,
    "orderId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldStock" (
    "id" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldStockMovement" (
    "id" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "FieldStockMovementType" NOT NULL,
    "qty" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "note" TEXT,
    "orderId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "spgId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'SUBMITTED',
    "note" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "shippedAt" TIMESTAMP(3),
    "shippedById" TEXT,
    "shipNote" TEXT,
    "receivedAt" TIMESTAMP(3),
    "receiveNote" TEXT,
    "hasDiscrepancy" BOOLEAN NOT NULL DEFAULT false,
    "discrepancyResolvedAt" TIMESTAMP(3),
    "discrepancyResolvedById" TEXT,
    "discrepancyNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "requestedQty" INTEGER NOT NULL,
    "stockAtSubmit" INTEGER NOT NULL,
    "unfulfilledAtSubmit" BOOLEAN NOT NULL,
    "approvedQty" INTEGER,
    "shippedQty" INTEGER,
    "receivedQty" INTEGER,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "entityType" "ApprovalEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "reason" TEXT,
    "approverId" TEXT NOT NULL,
    "cashierName" TEXT,
    "cashierPhotoFileId" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseStock_productId_key" ON "WarehouseStock"("productId");

-- CreateIndex
CREATE INDEX "WarehouseMovement_productId_createdAt_idx" ON "WarehouseMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "WarehouseMovement_type_createdAt_idx" ON "WarehouseMovement"("type", "createdAt");

-- CreateIndex
CREATE INDEX "WarehouseMovement_orderId_idx" ON "WarehouseMovement"("orderId");

-- CreateIndex
CREATE INDEX "FieldStock_pharmacyId_idx" ON "FieldStock"("pharmacyId");

-- CreateIndex
CREATE UNIQUE INDEX "FieldStock_holderId_pharmacyId_productId_key" ON "FieldStock"("holderId", "pharmacyId", "productId");

-- CreateIndex
CREATE INDEX "FieldStockMovement_holderId_pharmacyId_createdAt_idx" ON "FieldStockMovement"("holderId", "pharmacyId", "createdAt");

-- CreateIndex
CREATE INDEX "FieldStockMovement_productId_idx" ON "FieldStockMovement"("productId");

-- CreateIndex
CREATE INDEX "FieldStockMovement_orderId_idx" ON "FieldStockMovement"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE INDEX "Order_status_submittedAt_idx" ON "Order"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "Order_spgId_submittedAt_idx" ON "Order"("spgId", "submittedAt");

-- CreateIndex
CREATE INDEX "Order_pharmacyId_idx" ON "Order"("pharmacyId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_orderId_productId_key" ON "OrderItem"("orderId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_cashierPhotoFileId_key" ON "Approval"("cashierPhotoFileId");

-- CreateIndex
CREATE INDEX "Approval_entityType_entityId_idx" ON "Approval"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "WarehouseStock" ADD CONSTRAINT "WarehouseStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseMovement" ADD CONSTRAINT "WarehouseMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseMovement" ADD CONSTRAINT "WarehouseMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseMovement" ADD CONSTRAINT "WarehouseMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldStock" ADD CONSTRAINT "FieldStock_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldStock" ADD CONSTRAINT "FieldStock_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldStock" ADD CONSTRAINT "FieldStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldStockMovement" ADD CONSTRAINT "FieldStockMovement_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldStockMovement" ADD CONSTRAINT "FieldStockMovement_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldStockMovement" ADD CONSTRAINT "FieldStockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldStockMovement" ADD CONSTRAINT "FieldStockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldStockMovement" ADD CONSTRAINT "FieldStockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_spgId_fkey" FOREIGN KEY ("spgId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shippedById_fkey" FOREIGN KEY ("shippedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_discrepancyResolvedById_fkey" FOREIGN KEY ("discrepancyResolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_cashierPhotoFileId_fkey" FOREIGN KEY ("cashierPhotoFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Stok tidak pernah minus (AB-05); penjaga terakhir di bawah guard kondisional aplikasi.
ALTER TABLE "WarehouseStock" ADD CONSTRAINT "WarehouseStock_qty_nonnegative" CHECK ("qty" >= 0);
ALTER TABLE "FieldStock" ADD CONSTRAINT "FieldStock_qty_nonnegative" CHECK ("qty" >= 0);

-- Mutasi stok dan keputusan persetujuan adalah riwayat: tidak bisa diubah atau dihapus (AB-14, LOG-01).
CREATE TRIGGER "WarehouseMovement_append_only"
BEFORE UPDATE OR DELETE ON "WarehouseMovement"
FOR EACH ROW EXECUTE FUNCTION "prevent_row_mutation"();

CREATE TRIGGER "FieldStockMovement_append_only"
BEFORE UPDATE OR DELETE ON "FieldStockMovement"
FOR EACH ROW EXECUTE FUNCTION "prevent_row_mutation"();

CREATE TRIGGER "Approval_append_only"
BEFORE UPDATE OR DELETE ON "Approval"
FOR EACH ROW EXECUTE FUNCTION "prevent_row_mutation"();
