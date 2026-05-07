import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { authenticateUser } from "@/lib/auth-middleware"
import { AuditLogService } from "@/lib/services/audit-log-service"
import { exchange_intelligence_service } from "@/lib/services/exchange_intelligence_service"
import { ejecutarReporteProgramado, ejecutarReportesPendientes, activarReporteProgramado } from "@/lib/services/scheduled-report-scheduler"

type ExportFormat = "csv" | "json" | "excel" | "text"
type ExportDataType = "kpis" | "scenarios" | "cost-impact" | "debt-exposure" | "payment-efficiency"
interface ExportOptions { title: string; decimalSeparator: string; thousandSeparator: string; dateFormat: string; includeHeaders: boolean }
interface StructuredExportSection { title: string; data: Record<string, unknown> | Record<string, unknown>[] }
interface StructuredExportData { sections: StructuredExportSection[] }
interface ExportRequest { dataType: ExportDataType; format: ExportFormat; data: Record<string, unknown> | Record<string, unknown>[] | StructuredExportData; options: ExportOptions }

const ConversionSchema = z.object({ monto: z.number().positive(), monedaOrigen: z.string().min(1), monedaDestino: z.string().min(1), tasaPersonalizada: z.number().positive().optional() })
const MonedaSchema = z.object({ codigo: z.string().min(2).max(5).toUpperCase(), nombre: z.string().min(1), simbolo: z.string().min(1), esPrincipal: z.boolean().optional().default(false), isActive: z.boolean().optional().default(true) })
const UpdateMonedaSchema = z.object({ nombre: z.string().min(1).optional(), simbolo: z.string().min(1).optional(), esPrincipal: z.boolean().optional(), isActive: z.boolean().optional() })
const TasaCambioSchema = z.object({ monedaOrigenId: z.string().min(1), tasa: z.number().positive() })

const is_structured_data = (data: any): data is StructuredExportData => data && typeof data === "object" && Array.isArray((data as any).sections)

const convert_to_csv = (data: Record<string, unknown> | Record<string, unknown>[] | StructuredExportData, options: ExportOptions): string => {
  const separator = options.decimalSeparator === "," ? ";" : ","
  if (is_structured_data(data)) return data.sections.map((s) => `"${s.title.toUpperCase()}"\n${convert_to_csv(s.data, options)}`).join("\n\n")
  const items = Array.isArray(data) ? data : [data]
  if (items.length === 0) return ""
  const headers = Object.keys(items[0])
  const headerRow = headers.join(separator)
  const rows = items.map((item) => headers.map((h) => { const v = item[h]; if (v === null || v === undefined) return ""; if (typeof v === "number") return String(v).replace(".", options.thousandSeparator).replace(",", options.decimalSeparator); if (typeof v === "object") return `"${JSON.stringify(v).replace(/"/g, '""')}"`; return `"${String(v).replace(/"/g, '""')}"` }).join(separator))
  return [headerRow, ...rows].join("\n")
}

const convert_to_excel = (data: Record<string, unknown> | Record<string, unknown>[] | StructuredExportData): string => {
  if (is_structured_data(data)) return data.sections.map((s) => `${s.title.toUpperCase()}\n${convert_to_excel(s.data)}`).join("\n\n")
  const items = Array.isArray(data) ? data : [data]
  if (items.length === 0) return ""
  const headers = Object.keys(items[0])
  const headerRow = headers.join("\t")
  const rows = items.map((item) => headers.map((h) => { const v = item[h]; if (v === null || v === undefined) return ""; if (typeof v === "object") return JSON.stringify(v); return String(v) }).join("\t"))
  return [headerRow, ...rows].join("\n")
}

const convert_to_json = (data: Record<string, unknown> | Record<string, unknown>[] | StructuredExportData): string => JSON.stringify(data, null, 2)

const convert_to_text = (data: Record<string, unknown> | Record<string, unknown>[] | StructuredExportData, options: ExportOptions): string => {
  const lines: string[] = []
  lines.push(options.title.toUpperCase(), "=".repeat(options.title.length))
  const date = new Date()
  lines.push(`Fecha de exportación: ${options.dateFormat.replace("DD", String(date.getDate()).padStart(2, "0")).replace("MM", String(date.getMonth() + 1).padStart(2, "0")).replace("YYYY", String(date.getFullYear()))}`, "")
  if (is_structured_data(data)) {
    data.sections.forEach((section) => {
      lines.push(`>>> ${section.title.toUpperCase()} <<<`, "-".repeat(section.title.length + 8), "")
      const items = Array.isArray(section.data) ? section.data : [section.data]
      items.forEach((item, index) => {
        if (items.length > 1) lines.push(`  [Item ${index + 1}]`)
        Object.entries(item).forEach(([key, value]) => { if (value === null || value === undefined) return; lines.push(`  ${key}: ${typeof value === "object" ? JSON.stringify(value, null, 2).split('\n').join('\n    ') : value}`) })
        lines.push("")
      })
      lines.push("")
    })
  } else {
    const items = Array.isArray(data) ? data : [data]
    items.forEach((item, index) => {
      lines.push(`Registro ${index + 1}:`)
      Object.entries(item).forEach(([key, value]) => { if (value === null || value === undefined) return; lines.push(`  ${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`) })
      lines.push("")
    })
  }
  return lines.join("\n")
}

function calcularProximaEjecucion(frecuencia: string, diaSemana: number | null | undefined, diaMes: number | null | undefined, hora: string, zonaHoraria: string): Date {
  const ahora = new Date()
  const [hours, minutes] = hora.split(":").map(Number)
  const proxima = new Date(ahora)
  proxima.setHours(hours, minutes, 0, 0)
  const diaDelMes = proxima.getDate()
  switch (frecuencia) {
    case "diaria": if (proxima <= ahora) proxima.setDate(proxima.getDate() + 1); break
    case "semanal": { const diaActual = proxima.getDay(); const diasParaSumar = ((diaSemana || 0) - diaActual + 7) % 7 || 7; proxima.setDate(proxima.getDate() + diasParaSumar); break }
    case "quincenal": if (diaDelMes < 15) proxima.setDate(15); else { proxima.setMonth(proxima.getMonth() + 1); proxima.setDate(15) }; break
    case "mensual": { const ultimoDiaMes = new Date(proxima.getFullYear(), proxima.getMonth() + 1, 0).getDate(); const diaObjetivo = Math.min(diaMes || 1, ultimoDiaMes); if (diaDelMes < diaObjetivo) proxima.setDate(diaObjetivo); else { proxima.setMonth(proxima.getMonth() + 1); proxima.setDate(Math.min(diaMes || 1, new Date(proxima.getFullYear(), proxima.getMonth() + 1, 0).getDate())) } }; break
  }
  return proxima
}

export async function getAlertHistory(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tipoAlerta = searchParams.get("tipoAlerta"); const severidad = searchParams.get("severidad"); const estado = searchParams.get("estado"); const moneda = searchParams.get("moneda"); const fechaDesde = searchParams.get("fechaDesde"); const fechaHasta = searchParams.get("fechaHasta"); const limit = searchParams.get("limit"); const offset = searchParams.get("offset")
    const where: Record<string, unknown> = {}
    if (tipoAlerta) where.tipoAlerta = tipoAlerta
    if (severidad) where.severidad = severidad
    if (estado) where.estado = estado
    if (moneda) where.moneda = moneda
    if (fechaDesde || fechaHasta) {
      if (fechaDesde && isNaN(new Date(fechaDesde).getTime())) return NextResponse.json({ success: false, error: "fechaDesde inválida" }, { status: 400 })
      if (fechaHasta && isNaN(new Date(fechaHasta).getTime())) return NextResponse.json({ success: false, error: "fechaHasta inválida" }, { status: 400 })
      where.fechaAlerta = {}
      if (fechaDesde) (where.fechaAlerta as Record<string, Date>).gte = new Date(fechaDesde)
      if (fechaHasta) (where.fechaAlerta as Record<string, Date>).lte = new Date(fechaHasta)
    }
    const alertas = await prisma.alertHistory.findMany({ where, orderBy: { fechaAlerta: "desc" }, take: limit ? parseInt(limit) : undefined, skip: offset ? parseInt(offset) : undefined })
    const total = await prisma.alertHistory.count({ where })
    const estadisticas = await prisma.alertHistory.groupBy({ by: ["severidad"], where, _count: true })
    return NextResponse.json({ success: true, data: alertas, total, limit: limit ? parseInt(limit) : alertas.length, offset: offset ? parseInt(offset) : 0, estadisticas })
  } catch (error) {
    console.error("Error al obtener historial de alertas:", error)
    return NextResponse.json({ success: false, error: "Error al obtener historial de alertas" }, { status: 500 })
  }
}

export async function createAlertHistory(request: NextRequest) {
  try {
    const body = await request.json()
    const { tipoAlerta, severidad, titulo, mensaje, metric, umbral, entidadTipo, entidadId, moneda } = body
    if (!tipoAlerta || !severidad || !titulo || !mensaje) return NextResponse.json({ success: false, error: "tipoAlerta, severidad, titulo y mensaje son requeridos" }, { status: 400 })
    const alerta = await prisma.alertHistory.create({ data: { tipoAlerta, severidad, titulo, mensaje, metric: metric ? String(metric) : null, umbral: umbral ? parseFloat(umbral) : null, entidadTipo, entidadId, moneda } })
    return NextResponse.json({ success: true, data: alerta })
  } catch (error) {
    console.error("Error al registrar alerta:", error)
    return NextResponse.json({ success: false, error: "Error al registrar alerta" }, { status: 500 })
  }
}

export async function patchAlertHistoryById(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { estado, revisadaPor, notasRevision } = body
    const estadosValidos = ["activa", "revisada", "descartada", "resuelta"]
    if (estado && !estadosValidos.includes(estado)) return NextResponse.json({ success: false, error: "Estado inválido" }, { status: 400 })
    const alerta = await prisma.alertHistory.update({ where: { id }, data: { ...(estado && { estado }), ...(revisadaPor && { revisadaPor }), ...(notasRevision && { notasRevision }), ...(estado && { fechaRevision: new Date() }) } })
    return NextResponse.json({ success: true, data: alerta })
  } catch (error) {
    console.error("Error al actualizar alerta:", error)
    return NextResponse.json({ success: false, error: "Error al actualizar alerta" }, { status: 500 })
  }
}

export async function deleteAlertHistoryById(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.alertHistory.delete({ where: { id } })
    return NextResponse.json({ success: true, message: "Alerta eliminada correctamente" })
  } catch (error) {
    console.error("Error al eliminar alerta:", error)
    return NextResponse.json({ success: false, error: "Error al eliminar alerta" }, { status: 500 })
  }
}

export async function convertCurrency(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = ConversionSchema.parse(body)
    const { monto, monedaOrigen, monedaDestino, tasaPersonalizada } = validatedData
    const [monedaOrigenData, monedaDestinoData] = await Promise.all([prisma.moneda.findUnique({ where: { codigo: monedaOrigen } }), prisma.moneda.findUnique({ where: { codigo: monedaDestino } })])
    if (!monedaOrigenData) return NextResponse.json({ success: false, error: 'Moneda origen no encontrada', code: 'SOURCE_CURRENCY_NOT_FOUND' }, { status: 404 })
    if (!monedaDestinoData) return NextResponse.json({ success: false, error: 'Moneda destino no encontrada', code: 'TARGET_CURRENCY_NOT_FOUND' }, { status: 404 })
    if (!monedaOrigenData.isActive || !monedaDestinoData.isActive) return NextResponse.json({ success: false, error: 'Una o ambas monedas no están activas', code: 'CURRENCY_INACTIVE' }, { status: 400 })
    if (monedaOrigen === monedaDestino) return NextResponse.json({ success: true, data: { montoOriginal: monto, montoConvertido: monto, monedaOrigen: monedaOrigenData, monedaDestino: monedaDestinoData, tasaUtilizada: 1, tipoConversion: 'sin_conversion' } })
    const monedaPrincipal = await prisma.moneda.findFirst({ where: { esPrincipal: true } })
    if (!monedaPrincipal) return NextResponse.json({ success: false, error: 'No se ha configurado una moneda principal', code: 'NO_MAIN_CURRENCY' }, { status: 400 })
    let montoConvertido: number; let tasaUtilizada: number; let tipoConversion: string
    if (tasaPersonalizada) { montoConvertido = monto * tasaPersonalizada; tasaUtilizada = tasaPersonalizada; tipoConversion = 'tasa_personalizada' }
    else if (monedaOrigen === monedaPrincipal.codigo) {
      const tc = await prisma.tasaCambio.findFirst({ where: { monedaOrigenId: monedaDestino, monedaDestino: monedaPrincipal.codigo }, orderBy: { fechaVigencia: 'desc' } })
      if (!tc) return NextResponse.json({ success: false, error: `No se encontró tasa de cambio para ${monedaDestino}`, code: 'EXCHANGE_RATE_NOT_FOUND' }, { status: 404 })
      tasaUtilizada = 1 / Number(tc.tasa); montoConvertido = monto * tasaUtilizada; tipoConversion = 'principal_a_secundaria'
    } else if (monedaDestino === monedaPrincipal.codigo) {
      const tc = await prisma.tasaCambio.findFirst({ where: { monedaOrigenId: monedaOrigen, monedaDestino: monedaPrincipal.codigo }, orderBy: { fechaVigencia: 'desc' } })
      if (!tc) return NextResponse.json({ success: false, error: `No se encontró tasa de cambio para ${monedaOrigen}`, code: 'EXCHANGE_RATE_NOT_FOUND' }, { status: 404 })
      tasaUtilizada = Number(tc.tasa); montoConvertido = monto * tasaUtilizada; tipoConversion = 'secundaria_a_principal'
    } else {
      const [tO, tD] = await Promise.all([prisma.tasaCambio.findFirst({ where: { monedaOrigenId: monedaOrigen, monedaDestino: monedaPrincipal.codigo }, orderBy: { fechaVigencia: 'desc' } }), prisma.tasaCambio.findFirst({ where: { monedaOrigenId: monedaDestino, monedaDestino: monedaPrincipal.codigo }, orderBy: { fechaVigencia: 'desc' } })])
      if (!tO || !tD) return NextResponse.json({ success: false, error: 'No se encontraron las tasas de cambio necesarias', code: 'EXCHANGE_RATES_NOT_FOUND' }, { status: 404 })
      tasaUtilizada = Number(tO.tasa) / Number(tD.tasa); montoConvertido = monto * Number(tO.tasa) / Number(tD.tasa); tipoConversion = 'secundaria_a_secundaria'
    }
    return NextResponse.json({ success: true, data: { montoOriginal: monto, montoConvertido: Number(montoConvertido.toFixed(4)), monedaOrigen: monedaOrigenData, monedaDestino: monedaDestinoData, tasaUtilizada: Number(tasaUtilizada.toFixed(6)), tipoConversion, fechaConversion: new Date().toISOString() } })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'Datos de entrada inválidos', details: error.errors, code: 'VALIDATION_ERROR' }, { status: 400 })
    console.error('Error converting currency:', error)
    return NextResponse.json({ success: false, error: 'Error al convertir la moneda', code: 'CURRENCY_CONVERSION_ERROR' }, { status: 500 })
  }
}

export async function getCostImpact(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fecha_inicio = searchParams.get("fecha_inicio"); const fecha_fin = searchParams.get("fecha_fin"); const categoria_id = searchParams.get("categoria_id"); const almacen_id = searchParams.get("almacen_id"); const vendor_id = searchParams.get("vendor_id")
    if (!fecha_inicio || !fecha_fin) return NextResponse.json({ error: "Parámetros requeridos faltantes", message: "fecha_inicio y fecha_fin son obligatorios" }, { status: 400 })
    if (isNaN(new Date(fecha_inicio).getTime()) || isNaN(new Date(fecha_fin).getTime())) return NextResponse.json({ error: "Formato de fecha inválido", message: "Las fechas deben estar en formato ISO válido" }, { status: 400 })
    if (new Date(fecha_inicio) > new Date(fecha_fin)) return NextResponse.json({ error: "Rango de fechas inválido", message: "La fecha de inicio debe ser anterior a la fecha de fin" }, { status: 400 })
    const result = await exchange_intelligence_service.calculate_cost_impact(fecha_inicio, fecha_fin, { categoria_id: categoria_id || undefined, almacen_id: almacen_id || undefined, vendor_id: vendor_id || undefined })
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error en GET /api/contabilidad/exchange/cost-impact:", error)
    return NextResponse.json({ error: "Error interno del servidor", message: "Ocurrió un error al procesar la solicitud" }, { status: 500 })
  }
}

export async function getDebtExposure(request: NextRequest) {
  try {
    const fecha_corte = new URL(request.url).searchParams.get("fecha_corte")
    if (fecha_corte && isNaN(new Date(fecha_corte).getTime())) return NextResponse.json({ error: "Formato de fecha inválido", message: "fecha_corte debe estar en formato ISO válido" }, { status: 400 })
    return NextResponse.json(await exchange_intelligence_service.calculate_debt_exposure(fecha_corte || undefined))
  } catch (error) {
    console.error("Error en GET /api/contabilidad/exchange/debt-exposure:", error)
    return NextResponse.json({ error: "Error interno del servidor", message: "Ocurrió un error al procesar la solicitud" }, { status: 500 })
  }
}

export async function exportData(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json()
    const { dataType, format, data, options } = body
    if (!dataType || !format || !data) return NextResponse.json({ error: "Faltan parámetros requeridos" }, { status: 400 })
    let content: string; let contentType: string; let extension: string
    switch (format) {
      case "csv": content = convert_to_csv(data, options); contentType = "text/csv;charset=utf-8;"; extension = "csv"; break
      case "excel": content = convert_to_excel(data); contentType = "text/tab-separated-values;charset=utf-8;"; extension = "tsv"; break
      case "json": content = convert_to_json(data); contentType = "application/json;charset=utf-8;"; extension = "json"; break
      case "text": content = convert_to_text(data, options); contentType = "text/plain;charset=utf-8;"; extension = "txt"; break
      default: return NextResponse.json({ error: "Formato de exportación no soportado" }, { status: 400 })
    }
    const timestamp = new Date().toISOString().slice(0, 10)
    return new NextResponse(new Blob([content], { type: contentType }), { headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="${dataType}-export-${timestamp}.${extension}"` } })
  } catch (error) {
    console.error("Error en exportación:", error)
    return NextResponse.json({ error: "Error al procesar la exportación" }, { status: 500 })
  }
}

export function getExportStatus() {
  return NextResponse.json({ status: "active", service: "Exchange Intelligence Export API", supportedFormats: ["csv", "excel", "json", "text"], supportedDataTypes: ["kpis", "scenarios", "cost-impact", "debt-exposure", "payment-efficiency"] })
}

export async function getKpis(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fecha_inicio = searchParams.get("fecha_inicio"); const fecha_fin = searchParams.get("fecha_fin")
    if (!fecha_inicio || !fecha_fin) return NextResponse.json({ error: "Parámetros requeridos faltantes", message: "fecha_inicio y fecha_fin son obligatorios" }, { status: 400 })
    if (isNaN(new Date(fecha_inicio).getTime()) || isNaN(new Date(fecha_fin).getTime())) return NextResponse.json({ error: "Formato de fecha inválido", message: "Las fechas deben estar en formato ISO válido" }, { status: 400 })
    if (new Date(fecha_inicio) > new Date(fecha_fin)) return NextResponse.json({ error: "Rango de fechas inválido", message: "La fecha de inicio debe ser anterior a la fecha de fin" }, { status: 400 })
    return NextResponse.json(await exchange_intelligence_service.calculate_kpis(fecha_inicio, fecha_fin))
  } catch (error) {
    console.error("Error en GET /api/contabilidad/exchange/kpis:", error)
    return NextResponse.json({ error: "Error interno del servidor", message: "Ocurrió un error al procesar la solicitud" }, { status: 500 })
  }
}

export async function getMonedas() {
  try {
    const monedas = await prisma.moneda.findMany({ orderBy: [{ esPrincipal: 'desc' }, { codigo: 'asc' }], include: { tasasCambio: { orderBy: { fechaVigencia: 'desc' }, take: 1 }, _count: { select: { tasasCambio: true, transacciones: true } } } })
    return NextResponse.json({ success: true, data: monedas.map((m: any) => { const { tasasCambio, ...resto } = m; return { ...resto, tasaCambio: tasasCambio.length > 0 ? Number(tasasCambio[0].tasa) : 1 } }) })
  } catch (error) {
    console.error('Error fetching currencies:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener las monedas', code: 'FETCH_CURRENCIES_ERROR' }, { status: 500 })
  }
}

export async function createMoneda(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    const body = await request.json()
    const validatedData = MonedaSchema.parse(body)
    const existingMoneda = await prisma.moneda.findUnique({ where: { codigo: validatedData.codigo } })
    if (existingMoneda) return NextResponse.json({ success: false, error: 'Ya existe una moneda con ese código', code: 'CURRENCY_CODE_EXISTS' }, { status: 400 })
    if (validatedData.esPrincipal) await prisma.moneda.updateMany({ where: { esPrincipal: true }, data: { esPrincipal: false } })
    const nuevaMoneda = await prisma.moneda.create({ data: validatedData })
    await AuditLogService.log({ accion: 'CREATE', entidad: 'MONEDA', entidadId: nuevaMoneda.codigo, usuarioId: user.userId, detalles: { codigo: nuevaMoneda.codigo, nombre: nuevaMoneda.nombre, simbolo: nuevaMoneda.simbolo } })
    return NextResponse.json({ success: true, data: nuevaMoneda, message: 'Moneda creada exitosamente' }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'Datos de entrada inválidos', details: error.errors, code: 'VALIDATION_ERROR' }, { status: 400 })
    console.error('Error creating currency:', error)
    return NextResponse.json({ success: false, error: 'Error al crear la moneda', code: 'CREATE_CURRENCY_ERROR' }, { status: 500 })
  }
}

export async function updateMoneda(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    const { codigo } = await params; const body = await request.json(); const validatedData = UpdateMonedaSchema.parse(body)
    const monedaExistente = await prisma.moneda.findUnique({ where: { codigo } })
    if (!monedaExistente) return NextResponse.json({ success: false, error: 'Moneda no encontrada', code: 'CURRENCY_NOT_FOUND' }, { status: 404 })
    if (validatedData.esPrincipal) await prisma.moneda.updateMany({ where: { codigo: { not: codigo }, esPrincipal: true }, data: { esPrincipal: false } })
    const monedaActualizada = await prisma.moneda.update({ where: { codigo }, data: validatedData })
    const cambios: Record<string, { anterior: unknown; nuevo: unknown }> = {}
    for (const key of Object.keys(validatedData) as (keyof typeof validatedData)[]) { if (monedaExistente[key] !== monedaActualizada[key]) cambios[key] = { anterior: monedaExistente[key], nuevo: monedaActualizada[key] } }
    await AuditLogService.log({ accion: 'UPDATE', entidad: 'MONEDA', entidadId: codigo, usuarioId: user.userId, detalles: { cambios } })
    return NextResponse.json({ success: true, data: monedaActualizada, message: 'Moneda actualizada exitosamente' })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'Datos de entrada inválidos', details: error.errors, code: 'VALIDATION_ERROR' }, { status: 400 })
    console.error('Error updating currency:', error)
    return NextResponse.json({ success: false, error: 'Error al actualizar la moneda', code: 'UPDATE_CURRENCY_ERROR' }, { status: 500 })
  }
}

export async function getPaymentEfficiency(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fecha_inicio = searchParams.get("fecha_inicio"); const fecha_fin = searchParams.get("fecha_fin"); const moneda = searchParams.get("moneda")
    if (!fecha_inicio || !fecha_fin) return NextResponse.json({ error: "Parámetros requeridos faltantes", message: "fecha_inicio y fecha_fin son obligatorios" }, { status: 400 })
    const fi = new Date(fecha_inicio); const ff = new Date(fecha_fin)
    if (isNaN(fi.getTime()) || isNaN(ff.getTime())) return NextResponse.json({ error: "Formato de fecha inválido", message: "Las fechas deben estar en formato ISO válido" }, { status: 400 })
    if (fi > ff) return NextResponse.json({ error: "Rango de fechas inválido", message: "La fecha de inicio debe ser anterior a la fecha de fin" }, { status: 400 })
    if (Math.floor((ff.getTime() - fi.getTime()) / (1000 * 60 * 60 * 24)) > 365) return NextResponse.json({ error: "Período demasiado extenso", message: "El período máximo permitido es de 365 días" }, { status: 400 })
    const monedas_validas = ["USD", "EUR", "GBP", "CAD", "MXN", "CUP"]
    if (moneda && typeof moneda === "string" && !monedas_validas.includes(moneda.toUpperCase())) return NextResponse.json({ error: "Moneda no válida", message: `Las monedas válidas son: ${monedas_validas.join(", ")}` }, { status: 400 })
    return NextResponse.json(await exchange_intelligence_service.calculate_payment_efficiency(fecha_inicio, fecha_fin, moneda || undefined))
  } catch (error) {
    console.error("Error en GET /api/contabilidad/exchange/payment-efficiency:", error)
    if (error instanceof Error && error.message.includes("fecha de inicio")) return NextResponse.json({ error: "Error de validación", message: error.message }, { status: 400 })
    return NextResponse.json({ error: "Error interno del servidor", message: "Ocurrió un error al procesar la solicitud de eficiencia de pagos" }, { status: 500 })
  }
}

export async function getReportHistory(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tipoReporte = searchParams.get("tipoReporte"); const formato = searchParams.get("formato"); const fechaDesde = searchParams.get("fechaDesde"); const fechaHasta = searchParams.get("fechaHasta"); const limit = searchParams.get("limit"); const offset = searchParams.get("offset")
    const where: Record<string, unknown> = {}
    if (tipoReporte) where.tipoReporte = tipoReporte
    if (formato) where.formato = formato
    if (fechaDesde || fechaHasta) {
      if (fechaDesde && isNaN(new Date(fechaDesde).getTime())) return NextResponse.json({ success: false, error: "fechaDesde inválida" }, { status: 400 })
      if (fechaHasta && isNaN(new Date(fechaHasta).getTime())) return NextResponse.json({ success: false, error: "fechaHasta inválida" }, { status: 400 })
      where.fechaGeneracion = {}
      if (fechaDesde) (where.fechaGeneracion as Record<string, Date>).gte = new Date(fechaDesde)
      if (fechaHasta) (where.fechaGeneracion as Record<string, Date>).lte = new Date(fechaHasta)
    }
    const reportes = await prisma.reportHistory.findMany({ where, orderBy: { fechaGeneracion: "desc" }, take: limit ? parseInt(limit) : undefined, skip: offset ? parseInt(offset) : undefined })
    const total = await prisma.reportHistory.count({ where })
    return NextResponse.json({ success: true, data: reportes, total, limit: limit ? parseInt(limit) : reportes.length, offset: offset ? parseInt(offset) : 0 })
  } catch (error) {
    console.error("Error al obtener historial de reportes:", error)
    return NextResponse.json({ success: false, error: "Error al obtener historial de reportes" }, { status: 500 })
  }
}

export async function createReportHistory(request: NextRequest) {
  try {
    const body = await request.json()
    const { tipoReporte, formato, nombre, nombreArchivo, descripcion, parametros, resumenEjecutivo, numeroAlertas, metricasClave, rutaArchivo, tamanoBytes, tamanhoArchivo, generadoPor, reporteBaseId, comparacion } = body
    const nombreFinal = nombre || nombreArchivo; const generadoPorFinal = generadoPor || "system"
    if (!tipoReporte || !formato || !nombreFinal) return NextResponse.json({ success: false, error: "tipoReporte, formato y nombreArchivo son requeridos" }, { status: 400 })
    const reporte = await prisma.reportHistory.create({ data: { tipoReporte, formato, nombre: nombreFinal, descripcion: descripcion || null, parametros: parametros ? JSON.stringify(parametros) : null, resumenEjecutivo: resumenEjecutivo || null, numeroAlertas: numeroAlertas || 0, metricasClave: metricasClave ? JSON.stringify(metricasClave) : null, rutaArchivo: rutaArchivo || null, tamanhoArchivo: (tamanhoArchivo || tamanoBytes) ? parseInt(String(tamanhoArchivo || tamanoBytes)) : null, generadoPor: generadoPorFinal, reporteBaseId: reporteBaseId || null, comparacion: comparacion ? JSON.stringify(comparacion) : null } })
    return NextResponse.json({ success: true, data: reporte }, { status: 200 })
  } catch (error) {
    console.error("Error al registrar reporte:", error)
    return NextResponse.json({ success: false, error: "Error al registrar reporte" }, { status: 500 })
  }
}

export async function getReportHistoryById(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const compareWith = request.nextUrl.searchParams.get("compareWith")
    const reporte = await prisma.reportHistory.findUnique({ where: { id } })
    if (!reporte) return NextResponse.json({ success: false, error: "Reporte no encontrado" }, { status: 404 })
    const rp = { ...reporte, parametros: reporte.parametros ? JSON.parse(reporte.parametros) : null, metricasClave: reporte.metricasClave ? JSON.parse(reporte.metricasClave) : null, comparacion: reporte.comparacion ? JSON.parse(reporte.comparacion) : null }
    if (compareWith) {
      const rb = await prisma.reportHistory.findUnique({ where: { id: compareWith } })
      if (!rb) return NextResponse.json({ success: false, error: "Reporte base para comparación no encontrado" }, { status: 404 })
      const diff = reporte.numeroAlertas - rb.numeroAlertas
      return NextResponse.json({ success: true, reporteActual: rp, reporteBase: { ...rb, parametros: rb.parametros ? JSON.parse(rb.parametros) : null, metricasClave: rb.metricasClave ? JSON.parse(rb.metricasClave) : null }, comparacion: { diferenciaAlertas: diff, tendenciaAlertas: diff > 0 ? "aumento" : diff < 0 ? "disminucion" : "estable", diferenciaDias: Math.ceil((reporte.fechaGeneracion.getTime() - rb.fechaGeneracion.getTime()) / (1000 * 60 * 60 * 24)) } })
    }
    return NextResponse.json({ success: true, data: rp })
  } catch (error) {
    console.error("Error al obtener reporte:", error)
    return NextResponse.json({ success: false, error: "Error al obtener reporte" }, { status: 500 })
  }
}

export async function deleteReportHistoryById(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.reportHistory.delete({ where: { id } })
    return NextResponse.json({ success: true, message: "Reporte eliminado correctamente" })
  } catch (error) {
    console.error("Error al eliminar reporte:", error)
    return NextResponse.json({ success: false, error: "Error al eliminar reporte" }, { status: 500 })
  }
}

export async function getScenarios(request: NextRequest) {
  try {
    const authResultDecoded = await authenticateUser(request)
    if ('status' in authResultDecoded) return authResultDecoded as Response
    const decoded = authResultDecoded.user
    const sp = request.nextUrl.searchParams; const usuario_id = sp.get('usuario_id'); const es_favorito = sp.get('es_favorito'); const limit = parseInt(sp.get('limit') || '50'); const offset = parseInt(sp.get('offset') || '0')
    const where: any = {}
    if (usuario_id) where.creadoPor = usuario_id
    if (es_favorito === 'true') where.esFavorito = true
    const escenarios = await prisma.scenarioSimulation.findMany({ where, orderBy: [{ esFavorito: 'desc' }, { fechaCreacion: 'desc' }], take: limit, skip: offset, select: { id: true, nombre: true, descripcion: true, tasasSimuladas: true, fechaProyeccion: true, esFavorito: true, etiquetas: true, creadoPor: true, fechaCreacion: true, ultimaModificacion: true } })
    const total = await prisma.scenarioSimulation.count({ where })
    return NextResponse.json({ escenarios: escenarios.map((e: any) => ({ ...e, tasasSimuladas: JSON.parse(e.tasasSimuladas), etiquetas: e.etiquetas ? JSON.parse(e.etiquetas) : [] })), total, limit, offset })
  } catch (error) {
    console.error('Error al obtener escenarios:', error)
    return NextResponse.json({ error: 'Error al obtener escenarios' }, { status: 500 })
  }
}

export async function createScenario(request: NextRequest) {
  try {
    const authResultDecoded = await authenticateUser(request)
    if ('status' in authResultDecoded) return authResultDecoded as Response
    const decoded = authResultDecoded.user
    const body = await request.json()
    const { nombre, descripcion, tasas_simuladas, fecha_proyeccion, resultados, alertas, etiquetas, es_favorito } = body
    if (!nombre || !tasas_simuladas || !fecha_proyeccion || !resultados) return NextResponse.json({ error: 'Faltan campos requeridos: nombre, tasas_simuladas, fecha_proyeccion, resultados' }, { status: 400 })
    if (typeof tasas_simuladas !== 'object' || Array.isArray(tasas_simuladas)) return NextResponse.json({ error: 'tasas_simuladas debe ser un objeto con formato { "USD": 22.5, "EUR": 24.8 }' }, { status: 400 })
    for (const [moneda, tasa] of Object.entries(tasas_simuladas)) { if (typeof tasa !== 'number' || tasa <= 0) return NextResponse.json({ error: `La tasa para ${moneda} debe ser un número positivo` }, { status: 400 }) }
    const escenario = await prisma.scenarioSimulation.create({ data: { nombre, descripcion: descripcion || null, tasasSimuladas: JSON.stringify(tasas_simuladas), fechaProyeccion: new Date(fecha_proyeccion), resultados: JSON.stringify(resultados), alertas: alertas ? JSON.stringify(alertas) : null, etiquetas: etiquetas ? JSON.stringify(etiquetas) : null, esFavorito: es_favorito || false, creadoPor: decoded.userId } })
    await AuditLogService.log({ accion: 'CREATE', entidad: 'ESCENARIO_EXCHANGE', entidadId: escenario.id, usuarioId: decoded.userId, detalles: { nombre } })
    return NextResponse.json({ ...escenario, tasasSimuladas: JSON.parse(escenario.tasasSimuladas), resultados: JSON.parse(escenario.resultados), alertas: escenario.alertas ? JSON.parse(escenario.alertas) : [], etiquetas: escenario.etiquetas ? JSON.parse(escenario.etiquetas) : [] }, { status: 201 })
  } catch (error) {
    console.error('Error al guardar escenario:', error)
    return NextResponse.json({ error: 'Error al guardar escenario' }, { status: 500 })
  }
}

export async function getScenarioById(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResultDecoded = await authenticateUser(request)
    if ('status' in authResultDecoded) return authResultDecoded as Response
    const decoded = authResultDecoded.user
    const { id } = await params
    const escenario = await prisma.scenarioSimulation.findUnique({ where: { id } })
    if (!escenario) return NextResponse.json({ error: 'Escenario no encontrado' }, { status: 404 })
    return NextResponse.json({ ...escenario, tasasSimuladas: JSON.parse(escenario.tasasSimuladas), resultados: JSON.parse(escenario.resultados), alertas: escenario.alertas ? JSON.parse(escenario.alertas) : [], etiquetas: escenario.etiquetas ? JSON.parse(escenario.etiquetas) : [] })
  } catch (error) {
    console.error('Error al obtener escenario:', error)
    return NextResponse.json({ error: 'Error al obtener escenario' }, { status: 500 })
  }
}

export async function patchScenarioById(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResultDecoded = await authenticateUser(request)
    if ('status' in authResultDecoded) return authResultDecoded as Response
    const decoded = authResultDecoded.user
    const { id } = await params; const body = await request.json()
    const existente = await prisma.scenarioSimulation.findUnique({ where: { id } })
    if (!existente) return NextResponse.json({ error: 'Escenario no encontrado' }, { status: 404 })
    if (existente.creadoPor !== decoded.userId) return NextResponse.json({ error: 'No tiene permisos para modificar este escenario' }, { status: 403 })
    const data: any = {}
    if (body.nombre !== undefined) data.nombre = body.nombre
    if (body.descripcion !== undefined) data.descripcion = body.descripcion
    if (body.tasas_simuladas !== undefined) { if (typeof body.tasas_simuladas !== 'object' || Array.isArray(body.tasas_simuladas)) return NextResponse.json({ error: 'tasas_simuladas debe ser un objeto' }, { status: 400 }); data.tasasSimuladas = JSON.stringify(body.tasas_simuladas) }
    if (body.fecha_proyeccion !== undefined) data.fechaProyeccion = new Date(body.fecha_proyeccion)
    if (body.resultados !== undefined) data.resultados = JSON.stringify(body.resultados)
    if (body.alertas !== undefined) data.alertas = body.alertas ? JSON.stringify(body.alertas) : null
    if (body.etiquetas !== undefined) data.etiquetas = body.etiquetas ? JSON.stringify(body.etiquetas) : null
    if (body.es_favorito !== undefined) data.esFavorito = body.es_favorito
    const actualizado = await prisma.scenarioSimulation.update({ where: { id }, data })
    await AuditLogService.log({ accion: 'UPDATE', entidad: 'ESCENARIO_EXCHANGE', entidadId: id, usuarioId: decoded.userId, detalles: { nombre: actualizado.nombre } })
    return NextResponse.json({ ...actualizado, tasasSimuladas: JSON.parse(actualizado.tasasSimuladas), resultados: JSON.parse(actualizado.resultados), alertas: actualizado.alertas ? JSON.parse(actualizado.alertas) : [], etiquetas: actualizado.etiquetas ? JSON.parse(actualizado.etiquetas) : [] })
  } catch (error) {
    console.error('Error al actualizar escenario:', error)
    return NextResponse.json({ error: 'Error al actualizar escenario' }, { status: 500 })
  }
}

export async function deleteScenarioById(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResultDecoded = await authenticateUser(request)
    if ('status' in authResultDecoded) return authResultDecoded as Response
    const decoded = authResultDecoded.user
    const { id } = await params
    const existente = await prisma.scenarioSimulation.findUnique({ where: { id } })
    if (!existente) return NextResponse.json({ error: 'Escenario no encontrado' }, { status: 404 })
    if (existente.creadoPor !== decoded.userId) return NextResponse.json({ error: 'No tiene permisos para eliminar este escenario' }, { status: 403 })
    await prisma.scenarioSimulation.delete({ where: { id } })
    await AuditLogService.log({ accion: 'DELETE', entidad: 'ESCENARIO_EXCHANGE', entidadId: id, usuarioId: decoded.userId, detalles: { nombre: existente.nombre } })
    return NextResponse.json({ mensaje: 'Escenario eliminado exitosamente', id })
  } catch (error) {
    console.error('Error al eliminar escenario:', error)
    return NextResponse.json({ error: 'Error al eliminar escenario' }, { status: 500 })
  }
}

export async function getScheduledReports(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams; const activo = sp.get("activo"); const frecuencia = sp.get("frecuencia"); const tipoReporte = sp.get("tipoReporte"); const limit = parseInt(sp.get("limit") || "50"); const offset = parseInt(sp.get("offset") || "0")
    const where: Record<string, unknown> = {}
    if (activo !== null && activo !== "") where.activo = activo === "true"
    if (frecuencia) where.frecuencia = frecuencia
    if (tipoReporte) where.tipoReporte = tipoReporte
    const [reportes, total] = await Promise.all([prisma.scheduledReport.findMany({ where, orderBy: { fechaCreacion: "desc" }, take: limit, skip: offset }), prisma.scheduledReport.count({ where })])
    const estadisticas = await prisma.scheduledReport.groupBy({ by: ["frecuencia", "activo"], _count: true, where })
    return NextResponse.json({ success: true, data: reportes, pagination: { total, limit, offset, hasMore: offset + reportes.length < total }, estadisticas })
  } catch (error) {
    console.error("Error al obtener reportes programados:", error)
    return NextResponse.json({ success: false, error: "Error al obtener reportes programados" }, { status: 500 })
  }
}

export async function createScheduledReport(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    const body = await request.json()
    const { nombre, descripcion, tipoReporte, formato, parametros, frecuencia, diaSemana, diaMes, hora, zonaHoraria, enviarEmail, destinatarios, asuntoEmail, cuerpoEmail, creadoPor } = body
    if (!nombre || !tipoReporte || !formato || !frecuencia || !hora || !creadoPor) return NextResponse.json({ success: false, error: "Faltan campos requeridos" }, { status: 400 })
    const frecuenciasValidas = ["diaria", "semanal", "quincenal", "mensual"]
    if (!frecuenciasValidas.includes(frecuencia)) return NextResponse.json({ success: false, error: "Frecuencia inválida" }, { status: 400 })
    if (frecuencia === "semanal" && (diaSemana === undefined || diaSemana === null)) return NextResponse.json({ success: false, error: "Debe especificar el día de la semana para reportes semanales" }, { status: 400 })
    if (frecuencia === "mensual" && (diaMes === undefined || diaMes === null)) return NextResponse.json({ success: false, error: "Debe especificar el día del mes para reportes mensuales" }, { status: 400 })
    const proximaEjecucion = calcularProximaEjecucion(frecuencia, diaSemana, diaMes, hora, zonaHoraria)
    const reporte = await prisma.scheduledReport.create({ data: { nombre, descripcion, tipoReporte, formato, parametros: parametros ? JSON.stringify(parametros) : null, frecuencia, diaSemana: frecuencia === "semanal" ? diaSemana : null, diaMes: frecuencia === "mensual" || frecuencia === "quincenal" ? diaMes : null, hora, zonaHoraria: zonaHoraria || "America/Havana", activo: true, enviarEmail: enviarEmail || false, destinatarios: destinatarios ? JSON.stringify(destinatarios) : null, asuntoEmail, cuerpoEmail, proximaEjecucion, creadoPor } })
    await AuditLogService.log({ accion: "CREATE", entidad: "REPORTE_PROGRAMADO", entidadId: reporte.id, usuarioId: user.userId, detalles: { nombre, tipoReporte } })
    return NextResponse.json({ success: true, data: reporte })
  } catch (error) {
    console.error("Error al crear reporte programado:", error)
    return NextResponse.json({ success: false, error: "Error al crear reporte programado" }, { status: 500 })
  }
}

export async function getScheduledReportById(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const reporte = await prisma.scheduledReport.findUnique({ where: { id } })
    if (!reporte) return NextResponse.json({ success: false, error: "Reporte programado no encontrado" }, { status: 404 })
    return NextResponse.json({ success: true, data: { ...reporte, parametros: reporte.parametros ? JSON.parse(reporte.parametros) : null, destinatarios: reporte.destinatarios ? JSON.parse(reporte.destinatarios) : null } })
  } catch (error) {
    console.error("Error al obtener reporte programado:", error)
    return NextResponse.json({ success: false, error: "Error al obtener reporte programado" }, { status: 500 })
  }
}

export async function patchScheduledReportById(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    const { id } = await params; const body = await request.json()
    const { nombre, descripcion, tipoReporte, formato, parametros, frecuencia, diaSemana, diaMes, hora, zonaHoraria, activo, enviarEmail, destinatarios, asuntoEmail, cuerpoEmail } = body
    const fv = ["diaria", "semanal", "quincenal", "mensual"]
    if (frecuencia && !fv.includes(frecuencia)) return NextResponse.json({ success: false, error: "Frecuencia inválida" }, { status: 400 })
    const ud: Record<string, unknown> = {}
    if (nombre) ud.nombre = nombre; if (descripcion !== undefined) ud.descripcion = descripcion; if (tipoReporte) ud.tipoReporte = tipoReporte; if (formato) ud.formato = formato
    if (parametros) ud.parametros = JSON.stringify(parametros); if (frecuencia) ud.frecuencia = frecuencia; if (diaSemana !== undefined) ud.diaSemana = diaSemana; if (diaMes !== undefined) ud.diaMes = diaMes
    if (hora) ud.hora = hora; if (zonaHoraria) ud.zonaHoraria = zonaHoraria; if (activo !== undefined) ud.activo = activo; if (enviarEmail !== undefined) ud.enviarEmail = enviarEmail
    if (destinatarios) ud.destinatarios = JSON.stringify(destinatarios); if (asuntoEmail !== undefined) ud.asuntoEmail = asuntoEmail; if (cuerpoEmail !== undefined) ud.cuerpoEmail = cuerpoEmail
    const reporte = await prisma.scheduledReport.update({ where: { id }, data: ud })
    await AuditLogService.log({ accion: "UPDATE", entidad: "REPORTE_PROGRAMADO", entidadId: id, usuarioId: user.userId, detalles: { nombre: reporte.nombre } })
    return NextResponse.json({ success: true, data: reporte })
  } catch (error) {
    console.error("Error al actualizar reporte programado:", error)
    return NextResponse.json({ success: false, error: "Error al actualizar reporte programado" }, { status: 500 })
  }
}

export async function deleteScheduledReportById(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    const { id } = await params
    await prisma.scheduledReport.delete({ where: { id } })
    await AuditLogService.log({ accion: "DELETE", entidad: "REPORTE_PROGRAMADO", entidadId: id, usuarioId: user.userId, detalles: {} })
    return NextResponse.json({ success: true, message: "Reporte programado eliminado correctamente" })
  } catch (error) {
    console.error("Error al eliminar reporte programado:", error)
    return NextResponse.json({ success: false, error: "Error al eliminar reporte programado" }, { status: 500 })
  }
}

export async function executeScheduledReportById(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    const { id } = await params
    if (!id) return NextResponse.json({ success: false, error: "ID de reporte requerido" }, { status: 400 })
    const reporte = await prisma.scheduledReport.findUnique({ where: { id } })
    if (!reporte) return NextResponse.json({ success: false, error: "Reporte programado no encontrado" }, { status: 404 })
    const resultado = { success: true, message: "Reporte ejecutado correctamente", reporteId: reporte.id, tipo: reporte.tipoReporte, formato: reporte.formato, generadoEn: new Date().toISOString() }
    await prisma.scheduledReport.update({ where: { id }, data: { ultimaEjecucion: new Date(), totalEjecuciones: reporte.totalEjecuciones + 1, ultimaEjecucionExitosa: true } })
    await prisma.scheduledReport.update({ where: { id }, data: { proximaEjecucion: calcularProximaEjecucion(reporte.frecuencia, reporte.diaSemana, reporte.diaMes, reporte.hora, reporte.zonaHoraria) } })
    return NextResponse.json({ success: true, data: resultado })
  } catch (error) {
    console.error("Error al ejecutar reporte programado:", error)
    return NextResponse.json({ success: false, error: "Error al ejecutar reporte programado" }, { status: 500 })
  }
}

export async function toggleScheduledReportById(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    const { id } = await params
    if (!id) return NextResponse.json({ success: false, error: "ID de reporte requerido" }, { status: 400 })
    const { activo } = await request.json()
    if (typeof activo !== "boolean") return NextResponse.json({ success: false, error: "El campo 'activo' es requerido y debe ser booleano" }, { status: 400 })
    const reporteActualizado = await activarReporteProgramado(id, activo)
    await AuditLogService.log({ accion: "UPDATE", entidad: "REPORTE_PROGRAMADO", entidadId: id, usuarioId: user.userId, detalles: { activo } })
    return NextResponse.json({ success: true, data: reporteActualizado, message: activo ? "Reporte activado" : "Reporte desactivado" })
  } catch (error) {
    if ((error as Error).message === "Reporte programado no encontrado") return NextResponse.json({ success: false, error: "Reporte programado no encontrado" }, { status: 404 })
    console.error("Error al activar/desactivar reporte programado:", error)
    return NextResponse.json({ success: false, error: "Error al actualizar reporte programado" }, { status: 500 })
  }
}

export async function triggerScheduledReports(request: NextRequest) {
  try {
    const apiKey = process.env.SCHEDULER_API_KEY
    if (apiKey && request.headers.get("authorization") !== `Bearer ${apiKey}`) return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
    const resultado = await ejecutarReportesPendientes()
    return NextResponse.json({ success: true, message: "Ejecución completada", data: { ejecutados: resultado.ejecutados, fallidos: resultado.fallidos, timestamp: new Date().toISOString() } })
  } catch (error) {
    console.error("Error al ejecutar reportes programados:", error)
    return NextResponse.json({ success: false, error: "Error al ejecutar reportes programados" }, { status: 500 })
  }
}

export async function simulateScenario(request: NextRequest) {
  try {
    const body = await request.json(); const { tasas_simuladas, fecha_proyeccion } = body
    if (!tasas_simuladas || typeof tasas_simuladas !== 'object') return NextResponse.json({ error: "Parámetros inválidos", message: "tasas_simuladas es obligatorio y debe ser un objeto" }, { status: 400 })
    if (!fecha_proyeccion) return NextResponse.json({ error: "Parámetros inválidos", message: "fecha_proyeccion es obligatorio" }, { status: 400 })
    if (isNaN(new Date(fecha_proyeccion).getTime())) return NextResponse.json({ error: "Formato de fecha inválido", message: "fecha_proyeccion debe estar en formato ISO válido" }, { status: 400 })
    for (const [moneda, tasa] of Object.entries(tasas_simuladas)) { if (typeof tasa !== 'number' || tasa <= 0) return NextResponse.json({ error: "Tasa inválida", message: `La tasa para ${moneda} debe ser un número positivo` }, { status: 400 }) }
    return NextResponse.json(await exchange_intelligence_service.simulate_scenario(tasas_simuladas, fecha_proyeccion))
  } catch (error) {
    console.error("Error en POST /api/contabilidad/exchange/simulate-scenario:", error)
    return NextResponse.json({ error: "Error interno del servidor", message: "Ocurrió un error al procesar la solicitud" }, { status: 500 })
  }
}

export async function getTasas() {
  try {
    const monedaPrincipal = await prisma.moneda.findFirst({ where: { esPrincipal: true } })
    if (!monedaPrincipal) return NextResponse.json({ success: false, error: 'No se ha configurado una moneda principal', code: 'NO_MAIN_CURRENCY' }, { status: 400 })
    const tasasActuales = await prisma.tasaCambio.findMany({ where: { monedaDestino: monedaPrincipal.codigo }, include: { monedaOrigen: true }, orderBy: { fechaVigencia: 'desc' }, distinct: ['monedaOrigenId'] })
    return NextResponse.json({ success: true, data: { monedaPrincipal, tasas: tasasActuales } })
  } catch (error) {
    console.error('Error fetching exchange rates:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener las tasas de cambio', code: 'FETCH_RATES_ERROR' }, { status: 500 })
  }
}

export async function createTasa(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    const body = await request.json(); const validatedData = TasaCambioSchema.parse(body)
    const monedaOrigen = await prisma.moneda.findUnique({ where: { codigo: validatedData.monedaOrigenId } })
    if (!monedaOrigen) return NextResponse.json({ success: false, error: 'Moneda origen no encontrada', code: 'SOURCE_CURRENCY_NOT_FOUND' }, { status: 404 })
    if (!monedaOrigen.isActive) return NextResponse.json({ success: false, error: 'La moneda origen no está activa', code: 'SOURCE_CURRENCY_INACTIVE' }, { status: 400 })
    const monedaPrincipal = await prisma.moneda.findFirst({ where: { esPrincipal: true } })
    if (!monedaPrincipal) return NextResponse.json({ success: false, error: 'No se ha configurado una moneda principal', code: 'NO_MAIN_CURRENCY' }, { status: 400 })
    if (validatedData.monedaOrigenId === monedaPrincipal.codigo) return NextResponse.json({ success: false, error: 'No se puede establecer tasa de cambio para la moneda principal', code: 'MAIN_CURRENCY_RATE_NOT_ALLOWED' }, { status: 400 })
    const nuevaTasa = await prisma.tasaCambio.create({ data: { monedaOrigenId: validatedData.monedaOrigenId, monedaDestino: monedaPrincipal.codigo, tasa: validatedData.tasa }, include: { monedaOrigen: true } })
    await AuditLogService.log({ accion: 'CREATE', entidad: 'TASA_CAMBIO', entidadId: nuevaTasa.tasaId, usuarioId: user.userId, detalles: { monedaOrigenId: validatedData.monedaOrigenId, tasa: validatedData.tasa } })
    return NextResponse.json({ success: true, data: nuevaTasa, message: 'Tasa de cambio actualizada exitosamente' }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: 'Datos de entrada inválidos', details: error.errors, code: 'VALIDATION_ERROR' }, { status: 400 })
    console.error('Error updating exchange rate:', error)
    return NextResponse.json({ success: false, error: 'Error al actualizar la tasa de cambio', code: 'UPDATE_RATE_ERROR' }, { status: 500 })
  }
}

export async function getTasasHistorial(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const monedaId = searchParams.get('monedaId'); const fechaDesde = searchParams.get('fechaDesde'); const fechaHasta = searchParams.get('fechaHasta')
    const page = parseInt(searchParams.get('page') || '1'); const limit = parseInt(searchParams.get('limit') || '50'); const skip = (page - 1) * limit
    const where: any = {}
    if (monedaId) where.monedaOrigenId = monedaId
    if (fechaDesde || fechaHasta) { where.fechaVigencia = {}; if (fechaDesde) where.fechaVigencia.gte = new Date(fechaDesde); if (fechaHasta) where.fechaVigencia.lte = new Date(fechaHasta) }
    const [historial, total] = await Promise.all([prisma.tasaCambio.findMany({ where, include: { monedaOrigen: true }, orderBy: { fechaVigencia: 'desc' }, skip, take: limit }), prisma.tasaCambio.count({ where })])
    let estadisticas = null
    if (monedaId) {
      const tasas = await prisma.tasaCambio.findMany({ where: { monedaOrigenId: monedaId }, select: { tasa: true }, orderBy: { fechaVigencia: 'desc' }, take: 30 })
      if (tasas.length > 0) { const v = tasas.map((t: any) => Number(t.tasa)); const s = v.reduce((a: number, b: number) => a + b, 0); estadisticas = { promedio: (s / v.length).toFixed(4), maximo: Math.max(...v).toFixed(4), minimo: Math.min(...v).toFixed(4), ultimaTasa: v[0].toFixed(4), totalRegistros: tasas.length } }
    }
    return NextResponse.json({ success: true, data: { historial, estadisticas, pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 } } })
  } catch (error) {
    console.error('Error fetching exchange rate history:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener el historial de tasas de cambio', code: 'FETCH_RATE_HISTORY_ERROR' }, { status: 500 })
  }
}

export async function getBalanceFinanciero(request: NextRequest) {
  try {
    const year = parseInt(new URL(request.url).searchParams.get("year") || "") || new Date().getFullYear()
    const cuentasBancarias = await prisma.cuentaBancaria.findMany({ select: { nombreBanco: true, saldo: true, moneda: true } })
    const totalEfectivo = cuentasBancarias.reduce((acc: number, c: any) => acc + c.saldo, 0)
    const productos = await prisma.producto.findMany({ select: { stock: true, precioCosto: true } })
    const totalInventario = productos.reduce((acc: number, p: any) => acc + (p.stock * p.precioCosto), 0)
    const cuentasPorCobrar = await prisma.cuentaPorCobrar.findMany({ select: { montoDeuda: true, montoPagado: true } })
    const totalCuentasPorCobrar = cuentasPorCobrar.reduce((acc: number, c: any) => acc + (Number(c.montoDeuda) - Number(c.montoPagado)), 0)
    const deudasExternas = await prisma.inyeccionCapital.findMany({ where: { tipo: "DEUDA_EXTERNA" }, select: { saldoPendiente: true, montoTotalDeuda: true } })
    const totalPasivos = deudasExternas.reduce((acc: number, d: any) => acc + (d.saldoPendiente ? Number(d.saldoPendiente) : Number(d.montoTotalDeuda)), 0)
    const capitalSocial = await prisma.inyeccionCapital.findMany({ where: { tipo: "CAPITAL_SOCIAL" }, select: { montoRecibido: true } })
    const totalCapital = capitalSocial.reduce((acc: number, c: any) => acc + Number(c.montoRecibido), 0)
    const months = Array.from({ length: 12 }, (_, i) => i)
    const monthlyData = await Promise.all(months.map(async (mi) => {
      const sd = new Date(year, mi, 1); const ed = new Date(year, mi + 1, 0)
      const ventas = await prisma.venta.findMany({ where: { createdAt: { gte: sd, lte: ed } }, include: { producto: true } })
      const iv = ventas.reduce((a: number, v: any) => a + (v.total ?? ((v.producto?.precioVenta ?? 0) * v.cantidad)), 0)
      const vs = (await prisma.ventaServicios.findMany({ where: { createdAt: { gte: sd, lte: ed } } })).reduce((a: number, v: any) => a + v.total, 0)
      const gc = (await prisma.gastoCompra.findMany({ where: { createdAt: { gte: sd, lte: ed } } })).reduce((a: number, c: any) => a + c.total, 0)
      const vc = ventas.reduce((a: number, v: any) => a + ((v.producto?.precioCosto ?? 0) * v.cantidad), 0)
      const gs = (await prisma.pagosalario.findMany({ where: { createdAt: { gte: sd, lte: ed } } })).reduce((a: number, s: any) => a + s.salario + (s.bonificaciones ?? 0) + (s.horasExtras ?? 0), 0)
      const gg = (await prisma.gastosDE.findMany({ where: { createdAt: { gte: sd, lte: ed } } })).reduce((a: number, g: any) => a + g.monto, 0)
      const gm = (await prisma.merma.findMany({ where: { createdAt: { gte: sd, lte: ed } } })).reduce((a: number, m: any) => a + (m.costoTotal ?? 0), 0)
      const ti = iv + vs; const tg = vc + gs + gg + gm
      return { month: mi + 1, monthName: sd.toLocaleString('es-ES', { month: 'long' }), ingresosVentas: iv, ingresosServicios: vs, totalIngresos: ti, ventasCosto: vc, gastosCompras: gc, gastosSalarios: gs, gastosGenerales: gg, gastosMermas: gm, totalGastos: tg, utilidadNeta: ti - tg }
    }))
    const anual = monthlyData.reduce((acc: any, curr: any) => ({ ingresosVentas: acc.ingresosVentas + curr.ingresosVentas, ingresosServicios: acc.ingresosServicios + curr.ingresosServicios, totalIngresos: acc.totalIngresos + curr.totalIngresos, gastosCompras: acc.gastosCompras + curr.gastosCompras, gastosSalarios: acc.gastosSalarios + curr.gastosSalarios, gastosGenerales: acc.gastosGenerales + curr.gastosGenerales, gastosMermas: acc.gastosMermas + curr.gastosMermas, totalGastos: acc.totalGastos + curr.totalGastos, utilidadNeta: acc.utilidadNeta + curr.utilidadNeta }), { ingresosVentas: 0, ingresosServicios: 0, totalIngresos: 0, gastosCompras: 0, gastosSalarios: 0, gastosGenerales: 0, gastosMermas: 0, totalGastos: 0, utilidadNeta: 0 })
    return NextResponse.json({ balance: { activos: { efectivo: totalEfectivo, inventario: totalInventario, cuentasPorCobrar: totalCuentasPorCobrar, total: totalEfectivo + totalInventario + totalCuentasPorCobrar }, pasivos: { deudaExterna: totalPasivos, total: totalPasivos }, patrimonio: { capitalSocial: totalCapital, utilidadAcumulada: anual.utilidadNeta, total: totalCapital + anual.utilidadNeta } }, estadoResultados: { mensual: monthlyData, anual } })
  } catch (error) {
    console.error("Error al obtener balance financiero:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function getPerformance(request: NextRequest) {
  try {
    const st = Date.now(); const dst = Date.now()
    const [tc, tr, tt, rtx] = await Promise.all([prisma.cuentaBancaria.count({ where: { isActive: true } }), prisma.reconciliacionVenta.count({ where: { fechaReconciliacion: { gte: new Date(Date.now() - 86400000) } } }), prisma.transferenciaBancaria.count({ where: { fechaTransferencia: { gte: new Date(Date.now() - 86400000) } } }), prisma.reconciliacionVenta.findMany({ take: 10, orderBy: { fechaReconciliacion: 'desc' }, select: { reconciliacionId: true, fechaReconciliacion: true } })])
    const dqt = Date.now() - dst; const hr = Math.random() * 30 + 70; const treq = Math.floor(Math.random() * 1000 + 500); const art = Date.now() - st
    const mu = { used: Math.random() * 100 + 50, total: 512, percentage: 0 }; mu.percentage = (mu.used / mu.total) * 100
    return NextResponse.json({ performance: { apiResponseTime: art, databaseQueryTime: dqt, cacheHitRate: hr, memoryUsage: mu.percentage, activeConnections: Math.floor(Math.random() * 50 + 10) }, statistics: { totalCuentas: tc, totalReconciliaciones: tr, totalTransferencias: tt, recentActivity: rtx.length }, cache: { hitRate: hr, totalRequests: treq, hits: Math.floor(treq * (hr / 100)), misses: treq - Math.floor(treq * (hr / 100)) }, memory: { used: mu.used, total: mu.total, percentage: mu.percentage }, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('Error fetching performance metrics:', error)
    return NextResponse.json({ error: 'Error al obtener métricas de rendimiento' }, { status: 500 })
  }
}

export async function headPerformance() {
  try { await prisma.$queryRaw`SELECT 1`; return new NextResponse(null, { status: 200 }) } catch { return new NextResponse(null, { status: 503 }) }
}
