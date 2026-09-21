/*
  Warnings:

  - The `content` column on the `documents` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "documents" DROP COLUMN "content",
ADD COLUMN     "content" JSONB NOT NULL DEFAULT '{}';
