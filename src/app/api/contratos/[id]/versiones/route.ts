import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verify_token } from '@/lib/auth-utils';
import fs from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verify_token(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const cambios = formData.get('cambios') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 1. Get next version number
    const latestVersion = await prisma.contratoVersion.findFirst({
      where: { contratoId: id },
      orderBy: { numeroVersion: 'desc' },
    });
    const nextVersionNum = (latestVersion?.numeroVersion || 0) + 1;

    // 2. Upload File
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const extension = path.extname(file.name || '');
    const fileName = `${Date.now()}_v${nextVersionNum}_${Math.random().toString(36).substring(7)}${extension}`;
    const savePath = path.join(uploadDir, fileName);
    await writeFile(savePath, buffer);
    const fileUrl = `/uploads/${fileName}`;

    // 3. Create Version
    // Note: 'contenido' is required Json. We'll store basic metadata there.
    const version = await prisma.contratoVersion.create({
      data: {
        contratoId: id,
        numeroVersion: nextVersionNum,
        contenido: { 
          originalName: file.name,
          mimeType: file.type,
          size: file.size
        },
        cambios: cambios || 'Actualización de documento',
        creadoPor: user.userId,
      }
    });

    // 4. Create ContratoArchivo linked to Version
    await prisma.contratoArchivo.create({
      data: {
        contratoId: id,
        versionId: version.versionId,
        tipo: 'CONTRATO_VERSION', // Specific type for version docs
        rutaArchivo: fileUrl,
        nombreArchivo: file.name,
        generadoPor: user.userId,
      }
    });

    return NextResponse.json(version);

  } catch (error) {
    console.error('Error creating version:', error);
    return NextResponse.json({ error: 'Error creating version' }, { status: 500 });
  }
}
