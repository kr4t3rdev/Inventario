import { getPagoSalarioByIdHandler, updatePagoSalarioHandler, deletePagoSalarioHandler } from "@/features/pago-salario/api/handlers";

export const dynamic = 'force-dynamic';

export const GET = getPagoSalarioByIdHandler;
export const PUT = updatePagoSalarioHandler;
export const DELETE = deletePagoSalarioHandler;
