-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "sheetSourceId" TEXT;

-- CreateIndex
CREATE INDEX "Lead_sheetSourceId_createdAt_idx" ON "Lead"("sheetSourceId", "createdAt");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_sheetSourceId_fkey" FOREIGN KEY ("sheetSourceId") REFERENCES "LeadSheetSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
