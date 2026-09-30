-- CreateEnum
CREATE TYPE "SalesReportStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('SUBMITTED', 'KASIR_APPROVED', 'SA_APPROVED', 'RECEIVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Approval" ADD COLUMN     "cashierFaceCheck" JSONB;

-- AlterTable
ALTER TABLE "FieldStockMovement" ADD COLUMN     "returnId" TEXT,
ADD COLUMN     "salesReportId" TEXT;

-- AlterTable
ALTER TABLE "WarehouseMovement" ADD COLUMN     "returnId" TEXT;

-- CreateTable
CREATE TABLE "SalesReport" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "spgId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "reportDate" TEXT NOT NULL,
    "status" "SalesReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesReportItem" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "SalesReportItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Return" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "spgId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reason" TEXT NOT NULL,
    "photoFileId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kasirDecidedAt" TIMESTAMP(3),
    "saDecidedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "rejectedStep" TEXT,
    "receivedAt" TIMESTAMP(3),
    "receivedById" TEXT,
    "receiveNote" TEXT,
    "hasDiscrepancy" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Return_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "receivedQty" INTEGER,

    CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesReport_number_key" ON "SalesReport"("number");

-- CreateIndex
CREATE INDEX "SalesReport_pharmacyId_status_idx" ON "SalesReport"("pharmacyId", "status");

-- CreateIndex
CREATE INDEX "SalesReport_status_submittedAt_idx" ON "SalesReport"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "SalesReport_reportDate_idx" ON "SalesReport"("reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "SalesReport_spgId_pharmacyId_reportDate_key" ON "SalesReport"("spgId", "pharmacyId", "reportDate");

-- CreateIndex
CREATE INDEX "SalesReportItem_productId_idx" ON "SalesReportItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesReportItem_reportId_productId_key" ON "SalesReportItem"("reportId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Return_number_key" ON "Return"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Return_photoFileId_key" ON "Return"("photoFileId");

-- CreateIndex
CREATE INDEX "Return_status_submittedAt_idx" ON "Return"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "Return_spgId_submittedAt_idx" ON "Return"("spgId", "submittedAt");

-- CreateIndex
CREATE INDEX "Return_pharmacyId_status_idx" ON "Return"("pharmacyId", "status");

-- CreateIndex
CREATE INDEX "ReturnItem_productId_idx" ON "ReturnItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnItem_returnId_productId_key" ON "ReturnItem"("returnId", "productId");

-- CreateIndex
CREATE INDEX "FieldStockMovement_salesReportId_idx" ON "FieldStockMovement"("salesReportId");

-- CreateIndex
CREATE INDEX "FieldStockMovement_returnId_idx" ON "FieldStockMovement"("returnId");

-- CreateIndex
CREATE INDEX "WarehouseMovement_returnId_idx" ON "WarehouseMovement"("returnId");

-- AddForeignKey
ALTER TABLE "WarehouseMovement" ADD CONSTRAINT "WarehouseMovement_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "Return"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldStockMovement" ADD CONSTRAINT "FieldStockMovement_salesReportId_fkey" FOREIGN KEY ("salesReportId") REFERENCES "SalesReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldStockMovement" ADD CONSTRAINT "FieldStockMovement_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "Return"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReport" ADD CONSTRAINT "SalesReport_spgId_fkey" FOREIGN KEY ("spgId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReport" ADD CONSTRAINT "SalesReport_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReportItem" ADD CONSTRAINT "SalesReportItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "SalesReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReportItem" ADD CONSTRAINT "SalesReportItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_spgId_fkey" FOREIGN KEY ("spgId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_photoFileId_fkey" FOREIGN KEY ("photoFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "Return"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AB-06: laporan penjualan yang sudah disetujui kasir tidak bisa diubah atau dihapus, termasuk item-itemnya.
CREATE FUNCTION "prevent_approved_sales_report_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Laporan penjualan yang sudah disetujui tidak bisa diubah atau dihapus (AB-06)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SalesReport_approved_immutable"
BEFORE UPDATE OR DELETE ON "SalesReport"
FOR EACH ROW WHEN (OLD."status" = 'APPROVED')
EXECUTE FUNCTION "prevent_approved_sales_report_mutation"();

CREATE FUNCTION "prevent_approved_sales_item_mutation"() RETURNS trigger AS $$
DECLARE
  target_report TEXT := CASE WHEN TG_OP = 'INSERT' THEN NEW."reportId" ELSE OLD."reportId" END;
BEGIN
  IF EXISTS (SELECT 1 FROM "SalesReport" WHERE "id" = target_report AND "status" = 'APPROVED') THEN
    RAISE EXCEPTION 'Laporan penjualan yang sudah disetujui tidak bisa diubah atau dihapus (AB-06)';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SalesReportItem_approved_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "SalesReportItem"
FOR EACH ROW EXECUTE FUNCTION "prevent_approved_sales_item_mutation"();
