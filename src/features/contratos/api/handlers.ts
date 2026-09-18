import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { authenticateUser } from '@/lib/auth-middleware'
import { ActionError } from '@/lib/server-actions/types'
import { generarProximoConsecutivo, formatearNumeroContrato, crearContratoConConsecutivo } from '@/features/contratos/lib/numeroContratoGenerator'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { v2 as cloudinary } from 'cloudinary'
import { UTApi, UTFile } from 'uploadthing/server'
import {
  assertContratoAttachmentAsset,
  assertContratoVersionFile,
  contratoArchivoCreateSchema,
} from './contrato-archivo-schema'
import { recordOwnerAsset } from '@/lib/upload/cloudinary-admin'
import { resolveUploadPolicy } from '@/lib/upload/upload-policy'

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

const contratoFirmaSchema = z.object({
  firmanteId: z.string().min(1, 'El firmante es requerido'),
  tipoFirma: z.enum(['CLIENTE', 'PROVEEDOR', 'INTERNO']),
  estado: z.string().optional(),
  firmaDigital: z.string().nullable().optional(),
  fechaFirma: z.string().datetime().nullable().optional(),
  comentarios: z.string().nullable().optional(),
})

/**
 * @description Busca un contrato verificando que pertenezca al tenant autenticado.
 * @param {string} contratoId - Identificador público del contrato.
 * @param {string} tenantId - Tenant del usuario autenticado (del servidor).
 * @returns {Promise<object | null>} Contrato si pertenece al tenant, null en otro caso.
 */
export async function findContratoDelTenant(contratoId: string, tenantId: string) {
  return prisma.contrato.findFirst({ where: { contratoId, tenantId } })
}

/**
 * @description Valida que un userId sea miembro del tenant (para firmantes/aprobadores).
 * @returns {Promise<boolean>} true si el usuario es miembro del tenant.
 */
async function usuarioEsMiembroDelTenant(userId: string, tenantId: string): Promise<boolean> {
  const m = await prisma.tenantMembership.findFirst({ where: { userId, tenantId }, select: { membershipId: true } })
  return Boolean(m)
}

export async function getContratosHandler(request: NextRequest): Promise<Response> {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    const tenantId = user.tenantId ?? ''
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit
    const tipo = searchParams.get('tipo')
    const estado = searchParams.get('estado')
    const fechaInicioStr = searchParams.get('fechaInicio')
    const fechaFinStr = searchParams.get('fechaFin')
    const where: any = { tenantId }
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
    if (!user.tenantId) return NextResponse.json({ error: 'Se requiere una membresía de empresa activa' }, { status: 403 })
    const tenantId = user.tenantId ?? ''
    if (data.clienteId) {
      const cliente = await prisma.cliente.findFirst({
        where: { clienteId: data.clienteId, tenantId },
      })
      if (!cliente) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }
    if (data.vendorId) {
      const vendor = await prisma.vendor.findFirst({
        where: { vendorId: data.vendorId, tenantId },
      })
      if (!vendor) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }
    const contratoAcc = await crearContratoConConsecutivo({
      tenantId: tenantId,
      tipo: data.tipo,
      buildData: (numeroConsecutivo, numeroContrato) => ({
        ...data,
        tenantId: tenantId,
        creadoPor: user.userId,
        numeroContrato,
        numeroConsecutivo,
        numeroContratoClienteProveedor: data.numeroContratoClienteProveedor || null,
        fechaInicio: new Date(data.fechaInicio),
        fechaFin: data.fechaFin ? new Date(data.fechaFin) : null,
      }),
      create: async (payload) => {
        const c = await prisma.contrato.create({
          data: payload,
          include: {
            cliente: true,
            vendor: true,
            creador: { select: { userId: true, name: true, email: true } },
          },
        })
        const version = await prisma.contratoVersion.create({
          data: {
            contratoId: c.contratoId,
            numeroVersion: 1,
            contenido: { condiciones: data.condiciones },
            cambios: 'Versión inicial',
            creadoPor: user.userId,
          },
        })
        if (data.clienteId) {
          await prisma.cliente.update({
            where: { clienteId: data.clienteId },
            data: { numeroContrato: c.numeroContrato },
          })
        }
        return { ...c, versionActual: version }
      },
    })
    return NextResponse.json(contratoAcc)
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
    const tenantId = authResultReq1.user.tenantId ?? ''
    const { id } = await context.params
    const contrato = await prisma.contrato.findFirst({
      where: { contratoId: id, tenantId },
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
    const tenantId = user.tenantId ?? ''
    const { id } = await params
    const body = await request.json()
    const validatedBody = contratoUpdateSchema.parse(body)
    const existingContrato = await findContratoDelTenant(id, tenantId)
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
    // Validar IDs de relaciones externas al contrato pertenecer al tenant
    if (validatedBody.clienteId !== undefined && validatedBody.clienteId !== null) {
      const c = await prisma.cliente.findFirst({ where: { clienteId: validatedBody.clienteId, tenantId } })
      if (!c) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }
    if (validatedBody.vendorId !== undefined && validatedBody.vendorId !== null) {
      const v = await prisma.vendor.findFirst({ where: { vendorId: validatedBody.vendorId, tenantId } })
      if (!v) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }
    if (validatedBody.aprobadoPor !== undefined && validatedBody.aprobadoPor !== null) {
      const validMiembro = await usuarioEsMiembroDelTenant(validatedBody.aprobadoPor, tenantId)
      if (!validMiembro) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
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
    const tenantId = authResultUser.user.tenantId ?? ''
    const { id } = await params
    const contrato = await prisma.contrato.findFirst({
      where: { contratoId: id, tenantId },
      select: { clienteId: true, numeroContrato: true },
    })
    if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
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
    const tenantId = authResultReq1.user.tenantId ?? ''
    const body = await req.json()
    const { ids, estado } = bulkStatusSchema.parse(body)
    if (ids.length === 0) return NextResponse.json({ message: 'No IDs provided' }, { status: 400 })
    const result = await prisma.contrato.updateMany({
      where: { contratoId: { in: ids }, tenantId },
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
    const tenantIdBulk = authResultReq1.user.tenantId ?? ''
    const body = await req.json()
    const { ids } = bulkDeleteSchema.parse(body)
    if (ids.length === 0) return NextResponse.json({ message: 'No IDs provided' }, { status: 400 })
    const contractsToDelete = await prisma.contrato.findMany({
      where: { contratoId: { in: ids }, tenantId: tenantIdBulk },
      select: { contratoId: true, clienteId: true },
    })
    const clientIds = contractsToDelete.map((c) => c.clienteId).filter((id): id is string => id !== null)
    if (clientIds.length > 0) {
      await prisma.cliente.updateMany({
        where: { clienteId: { in: clientIds } },
        data: { numeroContrato: null },
      })
    }
    const ownedIds = contractsToDelete.map((c) => c.contratoId)
    const result = await prisma.contrato.deleteMany({
      where: { contratoId: { in: ownedIds.length > 0 ? ownedIds : ['__none__'] } },
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
    const tenantId = user.tenantId ?? 'sin-tenant'
    const owner = await findContratoDelTenant(id, user.tenantId ?? '')
    if (!owner) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    const formData = await req.formData() as any
    const file = formData.get('file') as File | null
    const cambios = formData.get('cambios') as string
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    assertContratoVersionFile(file)
    const latestVersion = await prisma.contratoVersion.findFirst({
      where: { contratoId: id },
      orderBy: { numeroVersion: 'desc' },
    })
    const nextVersionNum = (latestVersion?.numeroVersion || 0) + 1

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const fileHash = getBufferHash(buffer)
    const uploadPolicy = resolveUploadPolicy({
      uploadKey: 'contratos.version',
      user,
      input: {
        filename: file.name,
        mimeType: file.type,
        bytes: file.size,
        entityId: id,
      },
    })

    const uploadedAsset = uploadPolicy.provider === 'uploadthing'
      ? await uploadContratoVersionToUploadthing({
          buffer,
          file,
          publicId: uploadPolicy.publicId,
        })
      : await uploadContratoVersionToCloudinary({
          buffer,
          file,
          folder: uploadPolicy.folder,
          publicId: `${uploadPolicy.publicId}_${Date.now()}`,
        })

    const version = await prisma.contratoVersion.create({
      data: {
        contratoId: id,
        numeroVersion: nextVersionNum,
        contenido: {
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          fileHash,
          uploadKey: 'contratos.version',
          storageProvider: uploadedAsset.provider,
          publicId: uploadedAsset.publicId,
          fileUrl: uploadedAsset.secureUrl,
        },
        cambios: cambios || 'Actualización de documento',
        creadoPor: user.userId,
      },
    })
    const archivo = await prisma.contratoArchivo.create({
      data: {
        contratoId: id,
        versionId: version.versionId,
        tipo: 'CONTRATO_VERSION',
        rutaArchivo: uploadedAsset.secureUrl,
        nombreArchivo: file.name,
        generadoPor: user.userId,
      },
    })
    await recordOwnerAsset({
      tenantId,
      ownerType: 'contratoArchivo',
      ownerId: archivo.archivoId,
      slot: 'contract-version',
      asset: {
        uploadKey: 'contratos.version',
        secureUrl: uploadedAsset.secureUrl,
        publicId: uploadedAsset.publicId,
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
    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' || error.code === 'FEATURE_NOT_AVAILABLE'
        ? 403
        : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status })
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
    const ownerDiff = await findContratoDelTenant(id, authResultReq1.user.tenantId ?? '')
    if (!ownerDiff) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    const formData = await req.formData() as any
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
    const previousMetadata = extractContratoVersionStorageMetadata(latestVersion.contenido)
    if (previousMetadata?.fileHash && newFileHash === previousMetadata.fileHash) {
      return NextResponse.json({ hasChanges: false, message: 'El archivo es idéntico a la última versión.' })
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

function extractContratoVersionStorageMetadata(
  contenido: unknown
): { fileHash?: string } | null {
  if (!contenido || typeof contenido !== 'object' || Array.isArray(contenido)) {
    return null
  }

  const candidate = contenido as { fileHash?: unknown }
  return {
    fileHash: typeof candidate.fileHash === 'string' ? candidate.fileHash : undefined,
  }
}

async function uploadContratoVersionToUploadthing(input: {
  buffer: Buffer
  file: File
  publicId: string
}): Promise<{ provider: 'uploadthing'; secureUrl: string; publicId: string }> {
  const utapi = new UTApi()
  const uploaded = await utapi.uploadFiles(
    new UTFile([new Uint8Array(input.buffer)], input.file.name, {
      type: input.file.type,
      customId: input.publicId,
    })
  )

  const uploadResult = Array.isArray(uploaded) ? uploaded[0] : uploaded

  if (!uploadResult || uploadResult.error || !uploadResult.data) {
    throw new Error('UploadThing upload failed')
  }

  return {
    provider: 'uploadthing',
    secureUrl: uploadResult.data.ufsUrl,
    publicId: uploadResult.data.customId ?? input.publicId,
  }
}

async function uploadContratoVersionToCloudinary(input: {
  buffer: Buffer
  file: File
  folder: string
  publicId: string
}): Promise<{ provider: 'cloudinary'; secureUrl: string; publicId: string }> {
  const uploadResult = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: input.folder,
        resource_type: 'raw',
        public_id: input.publicId,
      },
      (error, result) => {
        if (error) reject(error)
        else resolve(result as { secure_url: string; public_id: string })
      }
    ).end(input.buffer)
  })

  return {
    provider: 'cloudinary',
    secureUrl: uploadResult.secure_url,
    publicId: uploadResult.public_id,
  }
}

export async function getContratoFirmasHandler(req: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const authResultReq1 = await authenticateUser(req)
    if ('status' in authResultReq1) return authResultReq1 as Response
    const { id } = await context.params
    const owner = await findContratoDelTenant(id, authResultReq1.user.tenantId ?? '')
    if (!owner) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
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
    const tenantId = authResultUser.user.tenantId ?? ''
    const owner = await findContratoDelTenant(id, tenantId)
    if (!owner) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    let body: unknown
    try {
      body = contratoFirmaSchema.parse(await request.json())
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
      }
      throw error
    }
    const parsed = body as z.infer<typeof contratoFirmaSchema>
    // Validar que el firmante es miembro del tenant (prevención IDOR en relaciones)
    const firmanteValido = await usuarioEsMiembroDelTenant(parsed.firmanteId, tenantId)
    if (!firmanteValido) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }
    const firma = await prisma.contratoFirma.create({
      data: {
        contratoId: id,
        firmanteId: parsed.firmanteId,
        tipoFirma: parsed.tipoFirma,
        estado: parsed.estado || 'PENDIENTE',
        firmaDigital: parsed.firmaDigital,
        fechaFirma: parsed.fechaFirma ? new Date(parsed.fechaFirma) : null,
        comentarios: parsed.comentarios,
      },
      include: { firmante: { select: { userId: true, name: true, email: true } } },
    })
    return NextResponse.json(firma)
  } catch (error) {
    console.error('Error al crear firma:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al crear firma' }, { status: 500 })
  }
}

export async function getContratoArchivosHandler(req: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const authResultReq1 = await authenticateUser(req)
    if ('status' in authResultReq1) return authResultReq1 as Response
    const { id } = await context.params
    const owner = await findContratoDelTenant(id, authResultReq1.user.tenantId ?? '')
    if (!owner) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
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
    const ownerArchivo = await findContratoDelTenant(id, user.tenantId ?? '')
    if (!ownerArchivo) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    const body = contratoArchivoCreateSchema.parse(await request.json())
    // Validar que la versión referenciada pertenece al contrato (prevención IDOR en relaciones)
    if (body.versionId) {
      const versionDelContrato = await prisma.contratoVersion.findFirst({
        where: { versionId: body.versionId, contratoId: id },
      })
      if (!versionDelContrato) {
        return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
      }
    }
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
    const owner = await findContratoDelTenant(id, authResultReq1.user.tenantId ?? '')
    if (!owner) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
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
    const tenantId = authResultUser.user.tenantId ?? ''
    const owner = await findContratoDelTenant(id, tenantId)
    if (!owner) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    const body = await request.json()
    // Validar que el aprobador es miembro del tenant (prevención IDOR en relaciones)
    const aprobadorValido = await usuarioEsMiembroDelTenant(body.aprobadorId, tenantId)
    if (!aprobadorValido) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }
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
    const owner = await findContratoDelTenant(id, authResultReq1.user.tenantId ?? '')
    if (!owner) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
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
    const owner = await findContratoDelTenant(id, authResultUser.user.tenantId ?? '')
    if (!owner) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
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
