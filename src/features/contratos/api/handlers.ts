import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { authenticateUser } from '@/lib/auth-middleware'
import { generarProximoConsecutivo, formatearNumeroContrato } from '@/features/contratos/lib/numeroContratoGenerator'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { v2 as cloudinary } from 'cloudinary'
import {
  assertContratoAttachmentAsset,
  assertContratoVersionFile,
  contratoArchivoCreateSchema,
} from './contrato-archivo-schema'
import { recordOwnerAsset } from '@/lib/upload/cloudinary-admin'

const contratoSchema = z.object({
  tipo: z.string().min(1, 'El tipo de contrato es requerido'),
  fechaInicio: z.string().datetime(),
  fechaFin: z.string().datetime().nullable().optional(),
  monto: z.string().nullable().optional(),
  moneda: z.string().default('CUP'),
  esMultiMoneda: z.boolean().default(false).optional(),
  condiciones: z.any().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  numeroContratoClienteProveedor: z.string().nullable().optional(),
  clienteId: z.string().nullable().optional(),
  vendorId: z.string().nullable().optional(),
}).refine(
  (data) => Boolean(data.clienteId) !== Boolean(data.vendorId),
  { message: 'Debes seleccionar solo un cliente o un proveedor', path: ['clienteId'] }
)

const contratoUpdateSchema = z.object({
  tipo: z.string().min(1).optional(),
  fechaInicio: z.string().datetime().optional(),
  fechaFin: z.string().datetime().nullable().optional(),
  monto: z.string().nullable().optional(),
  moneda: z.string().optional(),
  esMultiMoneda: z.boolean().optional(),
  condiciones: z.any().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  numeroContratoClienteProveedor: z.string().nullable().optional(),
  clienteId: z.string().nullable().optional(),
  vendorId: z.string().nullable().optional(),
  estado: z.enum(['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO', 'RECHAZADO', 'ACTIVO', 'FINALIZADO', 'ANULADO']).optional(),
  numeroContrato: z.string().optional(),
  fechaAprobacion: z.string().datetime().nullable().optional(),
  aprobadoPor: z.string().nullable().optional(),
}).refine(
  (data) => {
    if (data.tipo) {
      if ((data.tipo === 'COMPRA_VENTA' || data.tipo === 'SERVICIO') && data.clienteId === null && data.clienteId !== undefined) return false
      if (data.tipo === 'SUMINISTROS' && data.vendorId === null && data.vendorId !== undefined) return false
    }
    return true
  },
  (data) => {
    if (data.tipo === 'SUMINISTROS') return { message: 'El campo Proveedor es requerido para contratos de tipo SUMINISTROS', path: ['vendorId'] }
    return { message: 'El campo Cliente es requerido para contratos de tipo COMPRA_VENTA o SERVICIO', path: ['clienteId'] }
  }
)

const bulkStatusSchema = z.object({
  ids: z.array(z.string()),
  estado: z.enum(['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO', 'RECHAZADO', 'ACTIVO', 'FINALIZADO', 'ANULADO']),
})

const bulkDeleteSchema = z.object({
  ids: z.array(z.string()),
})

export async function getContratosHandler(request: NextRequest): Promise<Response> {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit
    const tipo = searchParams.get('tipo')
    const estado = searchParams.get('estado')
    const fechaInicioStr = searchParams.get('fechaInicio')
    const fechaFinStr = searchParams.get('fechaFin')
    const where: any = {}
    if (tipo && tipo !== 'ALL') where.tipo = tipo
    if (estado && estado !== 'ALL') where.estado = estado
    if (fechaInicioStr || fechaFinStr) {
      where.fechaInicio = {}
      if (fechaInicioStr) where.fechaInicio.gte = new Date(fechaInicioStr)
      if (fechaFinStr) where.fechaInicio.lte = new Date(fechaFinStr)
    }
    const [contratos, total] = await Promise.all([
      prisma.contrato.findMany({
        where,
        include: {
          cliente: true,
          vendor: true,
          creador: { select: { userId: true, name: true, email: true } },
          aprobador: { select: { userId: true, name: true, email: true } },
          versiones: { orderBy: { numeroVersion: 'desc' }, take: 1 },
          firmas: true,
          aprobaciones: true,
          archivos: true,
          alertas: { orderBy: { fechaAlerta: 'desc' }, take: 5 },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.contrato.count({ where }),
    ])
    return NextResponse.json({
      data: contratos,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Error al obtener contratos:', error)
    return NextResponse.json({ error: 'Failed to fetch contratos' }, { status: 500 })
  }
}

export async function createContratoHandler(request: NextRequest): Promise<Response> {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    const body = await request.json()
    const data = contratoSchema.parse(body)
    const numeroConsecutivo = await generarProximoConsecutivo(data.tipo)
    const numeroContrato = formatearNumeroContrato(data.tipo, numeroConsecutivo)
    const contrato = await prisma.contrato.create({
      data: {
        ...data,
        tenantId: user.tenantId ?? '',
        creadoPor: user.userId,
        numeroContrato,
        numeroConsecutivo,
        numeroContratoClienteProveedor: data.numeroContratoClienteProveedor || null,
        fechaInicio: new Date(data.fechaInicio),
        fechaFin: data.fechaFin ? new Date(data.fechaFin) : null,
      },
      include: {
        cliente: true,
        vendor: true,
        creador: { select: { userId: true, name: true, email: true } },
      },
    })
    const version = await prisma.contratoVersion.create({
      data: {
        contratoId: contrato.contratoId,
        numeroVersion: 1,
        contenido: { condiciones: data.condiciones },
        cambios: 'Versión inicial',
        creadoPor: user.userId,
      },
    })
    if (data.clienteId) {
      await prisma.cliente.update({
        where: { clienteId: data.clienteId },
        data: { numeroContrato: contrato.numeroContrato },
      })
    }
    return NextResponse.json({ ...contrato, versionActual: version })
  } catch (error) {
    console.error('Error al crear contrato:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create contrato' }, { status: 500 })
  }
}

export async function getContratoByIdHandler(req: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const authResultReq1 = await authenticateUser(req)
    if ('status' in authResultReq1) return authResultReq1 as Response
    const { id } = await context.params
    const contrato = await prisma.contrato.findUnique({
      where: { contratoId: id },
      include: {
        cliente: true,
        vendor: true,
        creador: { select: { userId: true, name: true, email: true } },
        aprobador: { select: { userId: true, name: true, email: true } },
        versiones: { orderBy: { numeroVersion: 'desc' } },
        firmas: { include: { firmante: { select: { userId: true, name: true, email: true } } } },
        aprobaciones: { include: { aprobador: { select: { userId: true, name: true, email: true } } } },
        archivos: { include: { version: true, generador: { select: { userId: true, name: true, email: true } } } },
        alertas: { orderBy: { fechaAlerta: 'desc' } },
      },
    })
    if (!contrato) return NextResponse.json({ error: 'contrato no encontrado' }, { status: 404 })
    return NextResponse.json(contrato)
  } catch (error) {
    console.error('Error al obtener contrato:', error)
    return NextResponse.json({ error: 'Error al obtener contrato' }, { status: 500 })
  }
}

export async function updateContratoHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    const { id } = await params
    const body = await request.json()
    const validatedBody = contratoUpdateSchema.parse(body)
    const existingContrato = await prisma.contrato.findUnique({ where: { contratoId: id } })
    if (!existingContrato) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    const tipoActual = validatedBody.tipo || existingContrato.tipo
    if ((tipoActual === 'COMPRA_VENTA' || tipoActual === 'SERVICIO')) {
      const clienteId = validatedBody.clienteId !== undefined ? validatedBody.clienteId : existingContrato.clienteId
      if (!clienteId) return NextResponse.json({ error: 'El campo Cliente es requerido para contratos de tipo COMPRA_VENTA o SERVICIO' }, { status: 400 })
    }
    if (tipoActual === 'SUMINISTROS') {
      const vendorId = validatedBody.vendorId !== undefined ? validatedBody.vendorId : existingContrato.vendorId
      if (!vendorId) return NextResponse.json({ error: 'El campo Proveedor es requerido para contratos de tipo SUMINISTROS' }, { status: 400 })
    }
    const data: any = {}
    if (validatedBody.numeroContrato !== undefined) data.numeroContrato = validatedBody.numeroContrato
    if (validatedBody.tipo !== undefined) data.tipo = validatedBody.tipo
    if (validatedBody.estado !== undefined) data.estado = validatedBody.estado
    if (validatedBody.monto !== undefined) data.monto = validatedBody.monto
    if (validatedBody.moneda !== undefined) data.moneda = validatedBody.moneda
    if (validatedBody.esMultiMoneda !== undefined) data.esMultiMoneda = validatedBody.esMultiMoneda
    if (validatedBody.condiciones !== undefined) data.condiciones = validatedBody.condiciones
    if (validatedBody.observaciones !== undefined) data.observaciones = validatedBody.observaciones
    if (validatedBody.numeroContratoClienteProveedor !== undefined) data.numeroContratoClienteProveedor = validatedBody.numeroContratoClienteProveedor
    if (validatedBody.fechaInicio !== undefined) data.fechaInicio = new Date(validatedBody.fechaInicio)
    if (validatedBody.fechaFin !== undefined) data.fechaFin = validatedBody.fechaFin ? new Date(validatedBody.fechaFin) : null
    if (validatedBody.fechaAprobacion !== undefined) data.fechaAprobacion = validatedBody.fechaAprobacion ? new Date(validatedBody.fechaAprobacion) : null
    if (validatedBody.clienteId !== undefined) data.cliente = validatedBody.clienteId ? { connect: { clienteId: validatedBody.clienteId } } : { disconnect: true }
    if (validatedBody.vendorId !== undefined) data.vendor = validatedBody.vendorId ? { connect: { vendorId: validatedBody.vendorId } } : { disconnect: true }
    if (validatedBody.aprobadoPor !== undefined) data.aprobador = validatedBody.aprobadoPor ? { connect: { userId: validatedBody.aprobadoPor } } : { disconnect: true }
    const contrato = await prisma.contrato.update({
      where: { contratoId: id },
      data,
      include: {
        cliente: true,
        vendor: true,
        creador: { select: { userId: true, name: true, email: true } },
        aprobador: { select: { userId: true, name: true, email: true } },
      },
    })
    if (validatedBody.clienteId && contrato.numeroContrato) {
      await prisma.cliente.update({
        where: { clienteId: validatedBody.clienteId },
        data: { numeroContrato: contrato.numeroContrato },
      })
    }
    return NextResponse.json(contrato)
  } catch (error) {
    console.error('Error al actualizar contrato:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al actualizar contrato' }, { status: 500 })
  }
}

export async function deleteContratoHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const { id } = await params
    const contrato = await prisma.contrato.findUnique({
      where: { contratoId: id },
      select: { clienteId: true, numeroContrato: true },
    })
    if (contrato?.clienteId) {
      await prisma.cliente.update({
        where: { clienteId: contrato.clienteId },
        data: { numeroContrato: null },
      })
    }
    await prisma.contrato.delete({ where: { contratoId: id } })
    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('Error al eliminar contrato:', error)
    return NextResponse.json({ error: 'Error al eliminar contrato' }, { status: 500 })
  }
}

export async function bulkUpdateContratoStatusHandler(req: NextRequest): Promise<Response> {
  try {
    const authResultReq1 = await authenticateUser(req)
    if ('status' in authResultReq1) return authResultReq1 as Response
    const body = await req.json()
    const { ids, estado } = bulkStatusSchema.parse(body)
    if (ids.length === 0) return NextResponse.json({ message: 'No IDs provided' }, { status: 400 })
    const result = await prisma.contrato.updateMany({
      where: { contratoId: { in: ids } },
      data: { estado },
    })
    return NextResponse.json({ success: true, count: result.count, message: `${result.count} contratos actualizados a ${estado}` })
  } catch (error) {
    console.error('Error in bulk status update:', error)
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function bulkDeleteContratosHandler(req: NextRequest): Promise<Response> {
  try {
    const authResultReq1 = await authenticateUser(req)
    if ('status' in authResultReq1) return authResultReq1 as Response
    const body = await req.json()
    const { ids } = bulkDeleteSchema.parse(body)
    if (ids.length === 0) return NextResponse.json({ message: 'No IDs provided' }, { status: 400 })
    const contractsToDelete = await prisma.contrato.findMany({
      where: { contratoId: { in: ids } },
      select: { contratoId: true, clienteId: true },
    })
    const clientIds = contractsToDelete.map((c) => c.clienteId).filter((id): id is string => id !== null)
    if (clientIds.length > 0) {
      await prisma.cliente.updateMany({
        where: { clienteId: { in: clientIds } },
        data: { numeroContrato: null },
      })
    }
    const result = await prisma.contrato.deleteMany({
      where: { contratoId: { in: ids } },
    })
    return NextResponse.json({ success: true, count: result.count, message: `${result.count} contratos eliminados` })
  } catch (error) {
    console.error('Error in bulk delete:', error)
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function createContratoVersionHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const authResultReq1 = await authenticateUser(req)
    if ('status' in authResultReq1) return authResultReq1 as Response
    const user = authResultReq1.user
    const { id } = await params
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const cambios = formData.get('cambios') as string
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    assertContratoVersionFile(file)
    const latestVersion = await prisma.contratoVersion.findFirst({
      where: { contratoId: id },
      orderBy: { numeroVersion: 'desc' },
    })
    const nextVersionNum = (latestVersion?.numeroVersion || 0) + 1

    // Subir archivo a Cloudinary (server-side, con SDK directo)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const tenantId = user.tenantId ?? 'sin-tenant'
    const uploadFolder = `${tenantId}/contratos/${id}/versiones`

    const uploadResult = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: uploadFolder,
          resource_type: 'raw',
          public_id: `v${nextVersionNum}_${Date.now()}`,
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result as any)
        }
      ).end(buffer)
    })
    const fileUrl = uploadResult.secure_url
    const version = await prisma.contratoVersion.create({
      data: {
        contratoId: id,
        numeroVersion: nextVersionNum,
        contenido: { originalName: file.name, mimeType: file.type, size: file.size },
        cambios: cambios || 'Actualización de documento',
        creadoPor: user.userId,
      },
    })
    await prisma.contratoArchivo.create({
      data: {
        contratoId: id,
        versionId: version.versionId,
        tipo: 'CONTRATO_VERSION',
        rutaArchivo: fileUrl,
        nombreArchivo: file.name,
        generadoPor: user.userId,
      },
    })
    await recordOwnerAsset({
      tenantId,
      ownerType: 'contratoArchivo',
      ownerId: version.versionId,
      slot: 'contract-version',
      asset: {
        uploadKey: 'contratos.version',
        secureUrl: fileUrl,
        publicId: uploadResult.public_id,
        resourceType: 'raw',
        bytes: file.size,
        mimeType: file.type,
        originalFilename: file.name,
      },
    })
    return NextResponse.json(version)
  } catch (error) {
    console.error('Error creating version:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.flatten() }, { status: 400 })
    }
    if (error instanceof Error && /no permitido|máximo permitido/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error creating version' }, { status: 500 })
  }
}

async function getFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('error', err => reject(err))
    stream.on('data', chunk => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

function getBufferHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export async function checkContratoVersionDiffHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const authResultReq1 = await authenticateUser(req)
    if ('status' in authResultReq1) return authResultReq1 as Response
    const { id } = await params
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const newFileHash = getBufferHash(buffer)
    const latestVersion = await prisma.contratoVersion.findFirst({
      where: { contratoId: id },
      orderBy: { numeroVersion: 'desc' },
      include: { archivos: true },
    })
    if (!latestVersion || latestVersion.archivos.length === 0) {
      return NextResponse.json({ hasChanges: true, isFirst: true, message: 'Primera versión con archivo.' })
    }
    const prevArchivo = latestVersion.archivos[0]
    const normalizedRelativePath = prevArchivo.rutaArchivo.replace(/^\/+/, '')
    const prevFilePath = path.join(process.cwd(), 'public', normalizedRelativePath)
    if (!fs.existsSync(prevFilePath)) {
      return NextResponse.json({ hasChanges: true, message: 'Archivo anterior no encontrado.' })
    }
    const prevFileHash = await getFileHash(prevFilePath)
    if (newFileHash === prevFileHash) {
      return NextResponse.json({ hasChanges: false, message: 'El archivo es idéntico a la última versión.' })
    }
    let diffSummary = null
    const isText = file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')
    if (isText) {
      try {
        const prevContent = fs.readFileSync(prevFilePath, 'utf-8')
        const newContent = buffer.toString('utf-8')
        if (prevContent !== newContent) diffSummary = 'Contenido de texto modificado.'
      } catch (e) {
        console.error('Error comparing text', e)
      }
    }
    return NextResponse.json({ hasChanges: true, message: 'Se detectaron cambios en el archivo.', diffSummary })
  } catch (error) {
    console.error('Error checking diff:', error)
    return NextResponse.json({ error: 'Error checking diff' }, { status: 500 })
  }
}

export async function getContratoFirmasHandler(req: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const authResultReq1 = await authenticateUser(req)
    if ('status' in authResultReq1) return authResultReq1 as Response
    const { id } = await context.params
    const firmas = await prisma.contratoFirma.findMany({
      where: { contratoId: id },
      include: { firmante: { select: { userId: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(firmas)
  } catch (error) {
    console.error('Error al obtener firmas:', error)
    return NextResponse.json({ error: 'Error al obtener firmas' }, { status: 500 })
  }
}

export async function createContratoFirmaHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const { id } = await params
    const body = await request.json()
    const firma = await prisma.contratoFirma.create({
      data: {
        contratoId: id,
        firmanteId: body.firmanteId,
        tipoFirma: body.tipoFirma,
        estado: body.estado || 'PENDIENTE',
        firmaDigital: body.firmaDigital,
        fechaFirma: body.fechaFirma ? new Date(body.fechaFirma) : null,
        comentarios: body.comentarios,
      },
      include: { firmante: { select: { userId: true, name: true, email: true } } },
    })
    return NextResponse.json(firma)
  } catch (error) {
    console.error('Error al crear firma:', error)
    return NextResponse.json({ error: 'Error al crear firma' }, { status: 500 })
  }
}

export async function getContratoArchivosHandler(req: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const authResultReq1 = await authenticateUser(req)
    if ('status' in authResultReq1) return authResultReq1 as Response
    const { id } = await context.params
    const archivos = await prisma.contratoArchivo.findMany({
      where: { contratoId: id },
      include: { version: true, generador: { select: { userId: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(archivos)
  } catch (error) {
    console.error('Error al obtener archivos:', error)
    return NextResponse.json({ error: 'Error al obtener archivos' }, { status: 500 })
  }
}

export async function createContratoArchivoHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    const { id } = await params
    const body = contratoArchivoCreateSchema.parse(await request.json())
    const tenantId = user.tenantId ?? 'sin-tenant'
    const storageProvider = body.storageProvider ?? 'cloudinary'
    assertContratoAttachmentAsset({
      tenantId,
      provider: storageProvider,
      publicId: body.cloudinaryPublicId,
      secureUrl: body.rutaArchivo,
      mimeType: body.mimeType,
      bytes: body.bytes,
    })
    const archivo = await prisma.contratoArchivo.create({
      data: {
        contratoId: id,
        versionId: body.versionId || null,
        tipo: body.tipo,
        rutaArchivo: body.rutaArchivo,
        nombreArchivo: body.nombreArchivo,
        generadoPor: user.userId,
      },
      include: { generador: { select: { userId: true, name: true, email: true } } },
    })
    await recordOwnerAsset({
      tenantId,
      ownerType: 'contratoArchivo',
      ownerId: archivo.archivoId,
      slot: 'attachment',
      asset: {
        uploadKey: 'contratos.attachment',
        secureUrl: body.rutaArchivo,
        publicId: body.cloudinaryPublicId,
        resourceType: 'raw',
        bytes: body.bytes,
        mimeType: body.mimeType,
        originalFilename: body.nombreArchivo,
      },
    })
    return NextResponse.json(archivo)
  } catch (error) {
    console.error('Error al crear archivo:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.flatten() }, { status: 400 })
    }
    if (error instanceof Error && /Cloudinary|tenant|no permitido|máximo permitido/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al crear archivo', details: String(error) }, { status: 500 })
  }
}

export async function getContratoAprobacionesHandler(req: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const authResultReq1 = await authenticateUser(req)
    if ('status' in authResultReq1) return authResultReq1 as Response
    const { id } = await context.params
    const aprobaciones = await prisma.contratoAprobacion.findMany({
      where: { contratoId: id },
      include: { aprobador: { select: { userId: true, name: true, email: true } } },
      orderBy: [{ nivel: 'asc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json(aprobaciones)
  } catch (error) {
    console.error('Error al obtener aprobaciones:', error)
    return NextResponse.json({ error: 'Error al obtener aprobaciones' }, { status: 500 })
  }
}

export async function createContratoAprobacionHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const { id } = await params
    const body = await request.json()
    const aprobacion = await prisma.contratoAprobacion.create({
      data: {
        contratoId: id,
        nivel: body.nivel,
        aprobadorId: body.aprobadorId,
        estado: body.estado || 'PENDIENTE',
        comentarios: body.comentarios,
        fechaAprobacion: body.fechaAprobacion ? new Date(body.fechaAprobacion) : null,
      },
      include: { aprobador: { select: { userId: true, name: true, email: true } } },
    })
    if (body.estado === 'APROBADO' && body.fechaAprobacion) {
      await prisma.contrato.update({
        where: { contratoId: id },
        data: { aprobadoPor: body.aprobadorId, fechaAprobacion: new Date(body.fechaAprobacion), estado: 'APROBADO' },
      })
    }
    return NextResponse.json(aprobacion)
  } catch (error) {
    console.error('Error al crear aprobación:', error)
    return NextResponse.json({ error: 'Error al crear aprobación' }, { status: 500 })
  }
}

export async function getContratoAlertasHandler(req: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const authResultReq1 = await authenticateUser(req)
    if ('status' in authResultReq1) return authResultReq1 as Response
    const { id } = await context.params
    const searchParams = req.nextUrl.searchParams
    const noLeidas = searchParams.get('noLeidas')
    const where: any = { contratoId: id }
    if (noLeidas === 'true') where.leida = false
    const alertas = await prisma.contratoAlerta.findMany({
      where,
      orderBy: { fechaAlerta: 'desc' },
    })
    return NextResponse.json(alertas)
  } catch (error) {
    console.error('Error al obtener alertas:', error)
    return NextResponse.json({ error: 'Error al obtener alertas' }, { status: 500 })
  }
}

export async function createContratoAlertaHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const { id } = await params
    const body = await request.json()
    const alerta = await prisma.contratoAlerta.create({
      data: {
        contratoId: id,
        tipo: body.tipo,
        fechaAlerta: new Date(body.fechaAlerta),
        mensaje: body.mensaje,
        accionRequerida: body.accionRequerida || false,
      },
    })
    return NextResponse.json(alerta)
  } catch (error) {
    console.error('Error al crear alerta:', error)
    return NextResponse.json({ error: 'Error al crear alerta' }, { status: 500 })
  }
}
