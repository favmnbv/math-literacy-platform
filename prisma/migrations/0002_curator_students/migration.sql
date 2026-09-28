CREATE TABLE "CuratorStudent" (
  "curatorId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CuratorStudent_pkey" PRIMARY KEY ("curatorId", "studentId"),
  CONSTRAINT "CuratorStudent_curatorId_fkey" FOREIGN KEY ("curatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CuratorStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CuratorStudent_studentId_idx" ON "CuratorStudent"("studentId");
