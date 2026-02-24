import { jsPDF } from 'jspdf'

interface VoucherData {
  numeroComprobante: string
  fechaTransferencia: string
  cuentaOrigen: {
    nombreBanco: string
    numeroCuenta: string
    moneda: string
  }
  cuentaDestino: {
    nombreBanco: string
    numeroCuenta: string
    moneda: string
  }
  montoOrigen: number
  montoDestino: number
  tasaCambio?: number
  motivo: string
  descripcion?: string
  realizadoPor: string
}

interface CompanyInfo {
  nombre: string
  direccion: string
  telefono: string
  email: string
}

class PDFGenerator {
  private doc: jsPDF
  private pageWidth: number
  private pageHeight: number
  private margin: number

  constructor() {
    this.doc = new jsPDF()
    this.pageWidth = this.doc.internal.pageSize.getWidth()
    this.pageHeight = this.doc.internal.pageSize.getHeight()
    this.margin = 20
  }

  private addHeader(companyInfo: CompanyInfo) {
    // Company logo area (placeholder)
    this.doc.setFillColor(240, 240, 240)
    this.doc.rect(this.margin, this.margin, 40, 20, 'F')
    
    // Company info
    this.doc.setFontSize(16)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text(companyInfo.nombre, this.margin + 50, this.margin + 8)
    
    this.doc.setFontSize(10)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(companyInfo.direccion, this.margin + 50, this.margin + 15)
    this.doc.text(`Tel: ${companyInfo.telefono} | Email: ${companyInfo.email}`, this.margin + 50, this.margin + 22)

    // Title
    this.doc.setFontSize(18)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('COMPROBANTE DE TRANSFERENCIA BANCARIA', this.pageWidth / 2, this.margin + 50, { align: 'center' })

    return this.margin + 70
  }

  private addVoucherInfo(voucherData: VoucherData, startY: number) {
    let currentY = startY

    // Voucher number and date
    this.doc.setFontSize(12)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text(`Comprobante No: ${voucherData.numeroComprobante}`, this.margin, currentY)
    this.doc.text(`Fecha: ${new Date(voucherData.fechaTransferencia).toLocaleDateString()}`, this.pageWidth - this.margin - 60, currentY)

    currentY += 20

    // Transfer details box
    this.doc.setDrawColor(0, 0, 0)
    this.doc.setLineWidth(0.5)
    this.doc.rect(this.margin, currentY, this.pageWidth - 2 * this.margin, 80)

    // Account origin
    currentY += 10
    this.doc.setFontSize(11)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('CUENTA ORIGEN:', this.margin + 5, currentY)
    
    this.doc.setFont('helvetica', 'normal')
    currentY += 8
    this.doc.text(`Banco: ${voucherData.cuentaOrigen.nombreBanco}`, this.margin + 5, currentY)
    currentY += 6
    this.doc.text(`Cuenta: ${voucherData.cuentaOrigen.numeroCuenta}`, this.margin + 5, currentY)
    currentY += 6
    this.doc.text(`Moneda: ${voucherData.cuentaOrigen.moneda}`, this.margin + 5, currentY)
    currentY += 6
    this.doc.text(`Monto: ${voucherData.montoOrigen.toLocaleString()} ${voucherData.cuentaOrigen.moneda}`, this.margin + 5, currentY)

    // Arrow
    const arrowY = currentY - 15
    const arrowX = this.pageWidth / 2 - 10
    this.doc.setFillColor(100, 100, 100)
    this.doc.triangle(arrowX, arrowY, arrowX + 20, arrowY, arrowX + 10, arrowY + 10, 'F')

    // Account destination
    const destX = this.pageWidth / 2 + 20
    currentY = startY + 30
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('CUENTA DESTINO:', destX, currentY)
    
    this.doc.setFont('helvetica', 'normal')
    currentY += 8
    this.doc.text(`Banco: ${voucherData.cuentaDestino.nombreBanco}`, destX, currentY)
    currentY += 6
    this.doc.text(`Cuenta: ${voucherData.cuentaDestino.numeroCuenta}`, destX, currentY)
    currentY += 6
    this.doc.text(`Moneda: ${voucherData.cuentaDestino.moneda}`, destX, currentY)
    currentY += 6
    this.doc.text(`Monto: ${voucherData.montoDestino.toLocaleString()} ${voucherData.cuentaDestino.moneda}`, destX, currentY)

    return startY + 90
  }

  private addExchangeInfo(voucherData: VoucherData, startY: number) {
    if (!voucherData.tasaCambio) return startY

    let currentY = startY + 10

    // Exchange rate box
    this.doc.setFillColor(250, 250, 250)
    this.doc.rect(this.margin, currentY, this.pageWidth - 2 * this.margin, 25, 'F')
    this.doc.rect(this.margin, currentY, this.pageWidth - 2 * this.margin, 25)

    currentY += 8
    this.doc.setFontSize(11)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('INFORMACIÓN DE CAMBIO DE MONEDA:', this.margin + 5, currentY)

    currentY += 8
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(`Tasa de cambio aplicada: 1 ${voucherData.cuentaOrigen.moneda} = ${voucherData.tasaCambio} ${voucherData.cuentaDestino.moneda}`, this.margin + 5, currentY)

    return currentY + 15
  }

  private addTransferDetails(voucherData: VoucherData, startY: number) {
    let currentY = startY + 10

    this.doc.setFontSize(11)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('DETALLES DE LA TRANSFERENCIA:', this.margin, currentY)

    currentY += 10
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(`Motivo: ${voucherData.motivo}`, this.margin, currentY)

    if (voucherData.descripcion) {
      currentY += 8
      this.doc.text(`Descripción: ${voucherData.descripcion}`, this.margin, currentY)
    }

    currentY += 8
    this.doc.text(`Realizado por: ${voucherData.realizadoPor}`, this.margin, currentY)

    return currentY + 15
  }

  private addFooter(startY: number) {
    const footerY = Math.max(startY + 20, this.pageHeight - 60)

    // Signature lines
    const signatureWidth = 60
    const leftSignatureX = this.margin + 20
    const rightSignatureX = this.pageWidth - this.margin - signatureWidth - 20

    this.doc.setLineWidth(0.5)
    this.doc.line(leftSignatureX, footerY, leftSignatureX + signatureWidth, footerY)
    this.doc.line(rightSignatureX, footerY, rightSignatureX + signatureWidth, footerY)

    this.doc.setFontSize(9)
    this.doc.text('Autorizado por', leftSignatureX + signatureWidth / 2, footerY + 8, { align: 'center' })
    this.doc.text('Recibido por', rightSignatureX + signatureWidth / 2, footerY + 8, { align: 'center' })

    // Generation info
    const generationY = this.pageHeight - 20
    this.doc.setFontSize(8)
    this.doc.setTextColor(128, 128, 128)
    this.doc.text(`Generado automáticamente el ${new Date().toLocaleString()}`, this.pageWidth / 2, generationY, { align: 'center' })
  }

  generateTransferVoucher(voucherData: VoucherData, companyInfo: CompanyInfo): Uint8Array {
    // Reset document
    this.doc = new jsPDF()

    let currentY = this.addHeader(companyInfo)
    currentY = this.addVoucherInfo(voucherData, currentY)
    currentY = this.addExchangeInfo(voucherData, currentY)
    currentY = this.addTransferDetails(voucherData, currentY)
    this.addFooter(currentY)

    return new Uint8Array(this.doc.output('arraybuffer'))
  }
}

// Optimized PDF generation with caching
class OptimizedPDFGenerator extends PDFGenerator {
  private static instance: OptimizedPDFGenerator
  private cache = new Map<string, Uint8Array>()
  private readonly maxCacheSize = 50

  static getInstance(): OptimizedPDFGenerator {
    if (!OptimizedPDFGenerator.instance) {
      OptimizedPDFGenerator.instance = new OptimizedPDFGenerator()
    }
    return OptimizedPDFGenerator.instance
  }

  private getCacheKey(voucherData: VoucherData): string {
    return `voucher_${voucherData.numeroComprobante}_${voucherData.fechaTransferencia}`
  }

  generateTransferVoucher(voucherData: VoucherData, companyInfo: CompanyInfo): Uint8Array {
    const cacheKey = this.getCacheKey(voucherData)
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    // Generate PDF
    const pdfBuffer = super.generateTransferVoucher(voucherData, companyInfo)

    // Cache the result
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(cacheKey, pdfBuffer)

    return pdfBuffer
  }

  clearCache(): void {
    this.cache.clear()
  }

  getCacheSize(): number {
    return this.cache.size
  }
}

export const pdfGenerator = OptimizedPDFGenerator.getInstance()

// Utility function for generating vouchers
export async function generateTransferVoucherPDF(
  transferId: string,
  voucherData: VoucherData
): Promise<Uint8Array> {
  const companyInfo: CompanyInfo = {
    nombre: process.env.COMPANY_NAME || 'Mi Empresa',
    direccion: process.env.COMPANY_ADDRESS || 'Dirección de la empresa',
    telefono: process.env.COMPANY_PHONE || 'Teléfono',
    email: process.env.COMPANY_EMAIL || 'email@empresa.com'
  }

  return pdfGenerator.generateTransferVoucher(voucherData, companyInfo)
}