import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'

interface ContratoData {
  numeroContrato: string
  tipo: string
  fechaInicio: string
  fechaFin: string | null
  monto: number | null
  moneda: string
  estado: string
  cliente?: {
    nombre: string
  }
  vendor?: {
    nombre: string
    contacto: string
  }
  condiciones?: any
  observaciones?: string
  createdAt: string
}

interface CompanyInfo {
  nombre: string
  direccion: string
  telefono: string
  email: string
}

class ContratoPDFGenerator {
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
    this.doc.setFontSize(16)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text(companyInfo.nombre, this.margin, this.margin + 10)
    
    this.doc.setFontSize(10)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(companyInfo.direccion, this.margin, this.margin + 20)
    this.doc.text(`Tel: ${companyInfo.telefono} | Email: ${companyInfo.email}`, this.margin, this.margin + 28)
    
    this.doc.setFontSize(18)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('CONTRATO', this.pageWidth / 2, this.margin + 45, { align: 'center' })
    
    return this.margin + 60
  }

  private addContratoInfo(data: ContratoData, startY: number): number {
    let currentY = startY
    
    this.doc.setFontSize(11)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('INFORMACIÓN DEL CONTRATO:', this.margin, currentY)
    
    currentY += 10
    this.doc.setFont('helvetica', 'normal')
    
    this.doc.text(`Número de Contrato: ${data.numeroContrato}`, this.margin + 5, currentY)
    this.doc.text(`Tipo: ${data.tipo}`, this.margin + 100, currentY)
    
    currentY += 8
    this.doc.text(`Estado: ${data.estado}`, this.margin + 5, currentY)
    this.doc.text(`Fecha de Inicio: ${new Date(data.fechaInicio).toLocaleDateString()}`, this.margin + 100, currentY)
    
    if (data.fechaFin) {
      currentY += 8
      this.doc.text(`Fecha de Fin: ${new Date(data.fechaFin).toLocaleDateString()}`, this.margin + 5, currentY)
    }
    
    if (data.monto) {
      currentY += 8
      this.doc.text(`Monto: ${data.monto.toLocaleString()} ${data.moneda}`, this.margin + 5, currentY)
    }
    
    return currentY + 20
  }

  private addParteInfo(data: ContratoData, startY: number): number {
    let currentY = startY + 10
    
    this.doc.setFontSize(11)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('INFORMACIÓN DE LAS PARTES:', this.margin, currentY)
    
    currentY += 12
    
    if (data.cliente) {
      this.doc.setFont('helvetica', 'normal')
      this.doc.text(`Cliente: ${data.cliente.nombre}`, this.margin + 5, currentY)
      currentY += 12
    }
    
    if (data.vendor) {
      this.doc.setFont('helvetica', 'normal')
      this.doc.text(`Proveedor: ${data.vendor.nombre}`, this.margin + 5, currentY)
      this.doc.text(`Contacto: ${data.vendor.contacto}`, this.margin + 5, currentY + 6)
      currentY += 20
    }
    
    return currentY
  }

  private addCondiciones(data: ContratoData, startY: number): number {
    let currentY = startY + 10
    
    this.doc.setFontSize(11)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('CONDICIONES Y TÉRMINOS:', this.margin, currentY)
    
    if (data.observaciones) {
      currentY += 10
      this.doc.setFont('helvetica', 'normal')
      this.doc.text('Observaciones:', this.margin + 5, currentY)
      currentY += 6
      this.doc.text(data.observaciones, this.margin + 5, currentY, { maxWidth: this.pageWidth - 2 * this.margin - 10 })
      currentY += 20
    }
    
    return currentY
  }

  private addFooter(startY: number): void {
    const footerY = Math.max(startY + 20, this.pageHeight - 80)
    
    this.doc.setLineWidth(0.5)
    this.doc.line(this.margin, footerY, this.pageWidth - this.margin, footerY)
    
    const signatureWidth = 70
    const leftSignatureX = this.margin + 30
    const centerSignatureX = this.pageWidth / 2 - signatureWidth / 2
    const rightSignatureX = this.pageWidth - this.margin - signatureWidth - 30
    
    this.doc.setFontSize(9)
    this.doc.setFont('helvetica', 'bold')
    
    this.doc.text('Firma del Cliente', leftSignatureX + signatureWidth / 2, footerY + 15, { align: 'center' })
    this.doc.line(leftSignatureX, footerY + 35, leftSignatureX + signatureWidth, footerY + 35)
    
    this.doc.text('Firma de la Empresa', centerSignatureX + signatureWidth / 2, footerY + 15, { align: 'center' })
    this.doc.line(centerSignatureX, footerY + 35, centerSignatureX + signatureWidth, footerY + 35)
    
    this.doc.text('Firma de Aprobación', rightSignatureX + signatureWidth / 2, footerY + 15, { align: 'center' })
    this.doc.line(rightSignatureX, footerY + 35, rightSignatureX + signatureWidth, footerY + 35)
    
    this.doc.setFontSize(8)
    this.doc.setTextColor(128, 128, 128)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(`Generado automáticamente el ${new Date().toLocaleString()}`, this.pageWidth / 2, this.pageHeight - 20, { align: 'center' })
  }

  generateContratoPDF(data: ContratoData, companyInfo: CompanyInfo): Uint8Array {
    this.doc = new jsPDF()
    
    let currentY = this.addHeader(companyInfo)
    currentY = this.addContratoInfo(data, currentY)
    currentY = this.addParteInfo(data, currentY)
    currentY = this.addCondiciones(data, currentY)
    this.addFooter(currentY)
    
    return new Uint8Array(this.doc.output('arraybuffer'))
  }
}

export function generateContratoPDF(data: ContratoData): Uint8Array {
  const generator = new ContratoPDFGenerator()
  const companyInfo: CompanyInfo = {
    nombre: process.env.COMPANY_NAME || 'Mi Empresa',
    direccion: process.env.COMPANY_ADDRESS || 'Dirección de la empresa',
    telefono: process.env.COMPANY_PHONE || 'Teléfono',
    email: process.env.COMPANY_EMAIL || 'email@empresa.com'
  }
  
  return generator.generateContratoPDF(data, companyInfo)
}

export function generateContratoExcel(data: ContratoData[]): Uint8Array {
  const headers = [
    'Número de Contrato',
    'Tipo',
    'Estado',
    'Fecha de Inicio',
    'Fecha de Fin',
    'Monto',
    'Cliente',
    'Proveedor',
    'Creado el'
  ]
  
  const rows = data.map(contrato => [
    contrato.numeroContrato,
    contrato.tipo,
    contrato.estado,
    new Date(contrato.fechaInicio).toLocaleDateString(),
    contrato.fechaFin ? new Date(contrato.fechaFin).toLocaleDateString() : '',
    contrato.monto ? `${contrato.monto} ${contrato.moneda}` : '',
    contrato.cliente ? `${contrato.cliente.nombre}` : '',
    contrato.vendor ? contrato.vendor.nombre : '',
    contrato.createdAt ? new Date(contrato.createdAt).toLocaleDateString() : '',
  ])
  
  const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
  
  return new TextEncoder().encode(csvContent)
}
