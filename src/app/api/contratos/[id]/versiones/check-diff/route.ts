import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verify_token } from '@/lib/auth-utils';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Helper to get file hash
async function getFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', err => reject(err));
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

// Helper to get buffer hash
function getBufferHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verify_token(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const newFileHash = getBufferHash(buffer);

    // Get latest version
    const latestVersion = await prisma.contratoVersion.findFirst({
      where: { contratoId: id },
      orderBy: { numeroVersion: 'desc' },
      include: { archivos: true }
    });

    if (!latestVersion || latestVersion.archivos.length === 0) {
      return NextResponse.json({ 
        hasChanges: true, 
        isFirst: true, 
        message: 'Primera versión con archivo.' 
      });
    }

    // Get previous file path
    // Assuming the first archive is the main contract document
    const prevArchivo = latestVersion.archivos[0];
    const normalizedRelativePath = prevArchivo.rutaArchivo.replace(/^\/+/, '');
    const prevFilePath = path.join(process.cwd(), 'public', normalizedRelativePath);

    if (!fs.existsSync(prevFilePath)) {
      // If file missing, assume changed
      return NextResponse.json({ hasChanges: true, message: 'Archivo anterior no encontrado.' });
    }

    const prevFileHash = await getFileHash(prevFilePath);

    if (newFileHash === prevFileHash) {
      return NextResponse.json({ 
        hasChanges: false, 
        message: 'El archivo es idéntico a la última versión.' 
      });
    }

    // Attempt text diff if text file
    let diffSummary = null;
    const isText = file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md');
    
    if (isText) {
      try {
        const prevContent = fs.readFileSync(prevFilePath, 'utf-8');
        const newContent = buffer.toString('utf-8');
        // Simple diff logic (very basic)
        if (prevContent !== newContent) {
            // Very naive diff, just returning "Content changed" for now to avoid huge payload
            // Or we could use a diff lib if we had one.
            diffSummary = "Contenido de texto modificado.";
        }
      } catch (e) {
        console.error("Error comparing text", e);
      }
    }

    return NextResponse.json({ 
      hasChanges: true, 
      message: 'Se detectaron cambios en el archivo.',
      diffSummary 
    });

  } catch (error) {
    console.error('Error checking diff:', error);
    return NextResponse.json({ error: 'Error checking diff' }, { status: 500 });
  }
}
