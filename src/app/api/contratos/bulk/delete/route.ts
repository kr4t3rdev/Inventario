import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { authenticateUser } from '@/lib/auth-middleware';

const bulkDeleteSchema = z.object({
  ids: z.array(z.string()),
});

export async function POST(req: NextRequest) {
  try {
    const authResultReq1 = await authenticateUser(req);
    if ('status' in authResultReq1) return authResultReq1 as Response;
    const user = authResultReq1.user;

    const body = await req.json();
    const { ids } = bulkDeleteSchema.parse(body);

    if (ids.length === 0) {
      return NextResponse.json({ message: 'No IDs provided' }, { status: 400 });
    }

    // Optional: Check if contracts can be deleted (e.g., not active)
    // For now, we allow deletion as per request

    // First handle related data if necessary (e.g. unlink from clients)
    // The individual DELETE handler did this:
    /*
    const contrato = await prisma.contrato.findUnique(...)
    if (contrato?.clienteId) { ... update client ... }
    */
    // For bulk, we should probably do similar logic.
    // Fetch contracts to be deleted to update clients
    const contractsToDelete = await prisma.contrato.findMany({
      where: { contratoId: { in: ids } },
      select: { contratoId: true, clienteId: true }
    });

    // Update clients (unlink contract)
    const clientIds = contractsToDelete
      .map((c: { clienteId: string | null }) => c.clienteId)
      .filter((id: string | null): id is string => id !== null);

    if (clientIds.length > 0) {
      await prisma.cliente.updateMany({
        where: { clienteId: { in: clientIds } },
        data: { numeroContrato: null }
      });
    }

    // Delete contracts
    const result = await prisma.contrato.deleteMany({
      where: {
        contratoId: {
          in: ids,
        },
      },
    });

    return NextResponse.json({ 
      success: true, 
      count: result.count,
      message: `${result.count} contratos eliminados`
    });
  } catch (error) {
    console.error('Error in bulk delete:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
