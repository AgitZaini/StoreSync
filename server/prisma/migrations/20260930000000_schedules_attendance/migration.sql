-- CreateEnum
CREATE TYPE "AttendanceKind" AS ENUM ('CHECK_IN', 'CHECK_OUT');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('WEB', 'APP');

-- CreateEnum
CREATE TYPE "AttendanceExceptionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "spgId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "isOff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "kind" "AttendanceKind" NOT NULL,
    "businessDate" TEXT NOT NULL,
    "serverAt" TIMESTAMP(3) NOT NULL,
    "photoFileId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracyM" DOUBLE PRECISION NOT NULL,
    "distanceM" DOUBLE PRECISION NOT NULL,
    "faceCheck" JSONB,
    "source" "AttendanceSource" NOT NULL DEFAULT 'WEB',
    "userAgent" TEXT,
    "exceptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceException" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "kind" "AttendanceKind" NOT NULL,
    "businessDate" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "photoFileId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracyM" DOUBLE PRECISION NOT NULL,
    "distanceM" DOUBLE PRECISION NOT NULL,
    "faceCheck" JSONB,
    "reason" TEXT NOT NULL,
    "status" "AttendanceExceptionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceNote" (
    "id" TEXT NOT NULL,
    "spgId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Schedule_date_idx" ON "Schedule"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_spgId_pharmacyId_date_key" ON "Schedule"("spgId", "pharmacyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_photoFileId_key" ON "Attendance"("photoFileId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_exceptionId_key" ON "Attendance"("exceptionId");

-- CreateIndex
CREATE INDEX "Attendance_userId_businessDate_idx" ON "Attendance"("userId", "businessDate");

-- CreateIndex
CREATE INDEX "Attendance_pharmacyId_businessDate_idx" ON "Attendance"("pharmacyId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceException_photoFileId_key" ON "AttendanceException"("photoFileId");

-- CreateIndex
CREATE INDEX "AttendanceException_status_createdAt_idx" ON "AttendanceException"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceException_userId_businessDate_idx" ON "AttendanceException"("userId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceNote_spgId_pharmacyId_date_key" ON "AttendanceNote"("spgId", "pharmacyId", "date");

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_spgId_fkey" FOREIGN KEY ("spgId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_photoFileId_fkey" FOREIGN KEY ("photoFileId") REFERENCES "FileObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "AttendanceException"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceException" ADD CONSTRAINT "AttendanceException_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceException" ADD CONSTRAINT "AttendanceException_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceException" ADD CONSTRAINT "AttendanceException_photoFileId_fkey" FOREIGN KEY ("photoFileId") REFERENCES "FileObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Absen yang sudah tercatat tidak boleh diubah atau dihapus (AB-14).
CREATE FUNCTION "prevent_row_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% bersifat append-only; % tidak diizinkan', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Attendance_append_only"
BEFORE UPDATE OR DELETE ON "Attendance"
FOR EACH ROW EXECUTE FUNCTION "prevent_row_mutation"();
