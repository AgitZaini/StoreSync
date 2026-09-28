-- CreateTable
CREATE TABLE "LeaderVisit" (
    "id" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "checkInId" TEXT NOT NULL,
    "checkOutId" TEXT,
    "checkInAt" TIMESTAMP(3) NOT NULL,
    "checkOutAt" TIMESTAMP(3),
    "durationMin" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderWorkDay" (
    "id" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderWorkDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationPing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracyM" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationPing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitPlan" (
    "id" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "addedAfterLock" BOOLEAN NOT NULL DEFAULT false,
    "removedAt" TIMESTAMP(3),
    "missReason" TEXT,
    "missReasonAt" TIMESTAMP(3),
    "evidenceFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaderVisit_checkInId_key" ON "LeaderVisit"("checkInId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderVisit_checkOutId_key" ON "LeaderVisit"("checkOutId");

-- CreateIndex
CREATE INDEX "LeaderVisit_leaderId_businessDate_idx" ON "LeaderVisit"("leaderId", "businessDate");

-- CreateIndex
CREATE INDEX "LeaderVisit_pharmacyId_businessDate_idx" ON "LeaderVisit"("pharmacyId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderWorkDay_leaderId_businessDate_key" ON "LeaderWorkDay"("leaderId", "businessDate");

-- CreateIndex
CREATE INDEX "LocationPing_userId_recordedAt_idx" ON "LocationPing"("userId", "recordedAt");

-- CreateIndex
CREATE INDEX "LocationPing_businessDate_idx" ON "LocationPing"("businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "VisitPlan_leaderId_weekStart_key" ON "VisitPlan"("leaderId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "VisitPlanItem_evidenceFileId_key" ON "VisitPlanItem"("evidenceFileId");

-- CreateIndex
CREATE INDEX "VisitPlanItem_planId_date_idx" ON "VisitPlanItem"("planId", "date");

-- AddForeignKey
ALTER TABLE "LeaderVisit" ADD CONSTRAINT "LeaderVisit_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderVisit" ADD CONSTRAINT "LeaderVisit_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderVisit" ADD CONSTRAINT "LeaderVisit_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "Attendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderVisit" ADD CONSTRAINT "LeaderVisit_checkOutId_fkey" FOREIGN KEY ("checkOutId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderWorkDay" ADD CONSTRAINT "LeaderWorkDay_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationPing" ADD CONSTRAINT "LocationPing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitPlan" ADD CONSTRAINT "VisitPlan_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitPlanItem" ADD CONSTRAINT "VisitPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "VisitPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitPlanItem" ADD CONSTRAINT "VisitPlanItem_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitPlanItem" ADD CONSTRAINT "VisitPlanItem_evidenceFileId_fkey" FOREIGN KEY ("evidenceFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

