import { getPagoSalariosHandler, createPagoSalarioHandler } from "@/features/pago-salario/api/handlers";

export const dynamic = 'force-dynamic';

export const GET = getPagoSalariosHandler;
export const POST = createPagoSalarioHandler;
