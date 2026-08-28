-- CreateTable
CREATE TABLE "LeadSheetSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "accessMode" TEXT NOT NULL DEFAULT 'SERVICE_ACCOUNT',
    "spreadsheetId" TEXT,
    "sheetName" TEXT,
    "csvUrl" TEXT,
    "sourceId" TEXT,
    "lastRowImported" INTEGER NOT NULL DEFAULT 0,
    "nextAssigneeIndex" INTEGER NOT NULL DEFAULT 0,
    "lastPolledAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastImportedAt" TIMESTAMP(3),
    "totalImported" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadSheetSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadSheetAssignee" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LeadSheetAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadSheetSource_enabled_idx" ON "LeadSheetSource"("enabled");

-- CreateIndex
CREATE INDEX "LeadSheetAssignee_sheetId_position_idx" ON "LeadSheetAssignee"("sheetId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSheetAssignee_sheetId_userId_key" ON "LeadSheetAssignee"("sheetId", "userId");

-- AddForeignKey
ALTER TABLE "LeadSheetSource" ADD CONSTRAINT "LeadSheetSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LeadSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSheetAssignee" ADD CONSTRAINT "LeadSheetAssignee_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "LeadSheetSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSheetAssignee" ADD CONSTRAINT "LeadSheetAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
