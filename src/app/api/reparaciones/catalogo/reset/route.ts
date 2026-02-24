import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuthPost } from '@/lib/auth-middleware';

export const POST = withAuthPost(async (_request: Request, _context: any, user: any) => {
  try {
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }

    await prisma.$transaction([
      prisma.ordenReparacionMaterial.deleteMany(),
      prisma.ordenReparacionItem.deleteMany(),
      prisma.ordenReparacion.deleteMany(),
      prisma.piezaReparacion.deleteMany(),
      prisma.equipoReparacion.deleteMany(),
      prisma.defectacionCatalogo.deleteMany(),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al resetear catálogo de reparaciones:', error);
    return NextResponse.json({ error: 'Error al resetear catálogo' }, { status: 500 });
  }
});
