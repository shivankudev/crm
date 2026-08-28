-- CreateTable
CREATE TABLE "WhatsAppQuickAction" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppQuickAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppQuickActionMedia" (
    "id" TEXT NOT NULL,
    "quickActionId" TEXT NOT NULL,
    "mediaKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WhatsAppQuickActionMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppQuickAction_enabled_sortOrder_idx" ON "WhatsAppQuickAction"("enabled", "sortOrder");

-- CreateIndex
CREATE INDEX "WhatsAppQuickActionMedia_quickActionId_sortOrder_idx" ON "WhatsAppQuickActionMedia"("quickActionId", "sortOrder");

-- AddForeignKey
ALTER TABLE "WhatsAppQuickActionMedia" ADD CONSTRAINT "WhatsAppQuickActionMedia_quickActionId_fkey" FOREIGN KEY ("quickActionId") REFERENCES "WhatsAppQuickAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
