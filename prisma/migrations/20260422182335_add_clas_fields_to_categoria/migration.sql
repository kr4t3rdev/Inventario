-- AddColumn clasSectionId and clasSpecificId to Categoria
ALTER TABLE "Categoria" ADD COLUMN "clasSectionId" TEXT;
ALTER TABLE "Categoria" ADD COLUMN "clasSpecificId" TEXT;

-- CreateIndex on CLAS fields for performance
CREATE INDEX "Categoria_clasSectionId_idx" ON "Categoria"("clasSectionId");
CREATE INDEX "Categoria_clasSpecificId_idx" ON "Categoria"("clasSpecificId");
