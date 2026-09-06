-- PG-02: roles personalizados por tenant (permisos-granulares).
-- Aditiva: ninguna destrucción de datos. Sin filas → comportamiento idéntico
-- (los permisos se resuelven por defaults del permission-registry).
-- FK membership.customRoleId con RESTRICT: no se borra un rol con miembros.
-- Generada con prisma migrate diff (offline, schema previo vs actual) y revisada.

-- AlterTable
ALTER TABLE "tenant_memberships" ADD COLUMN     "customRoleId" TEXT;

-- CreateTable
CREATE TABLE "tenant_roles" (
    "roleId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "permissions" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_roles_pkey" PRIMARY KEY ("roleId")
);

-- CreateIndex
CREATE INDEX "tenant_roles_tenantId_idx" ON "tenant_roles"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_roles_tenantId_nombre_key" ON "tenant_roles"("tenantId", "nombre");

-- CreateIndex
CREATE INDEX "tenant_memberships_customRoleId_idx" ON "tenant_memberships"("customRoleId");

-- AddForeignKey
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "tenant_roles"("roleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_roles" ADD CONSTRAINT "tenant_roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
