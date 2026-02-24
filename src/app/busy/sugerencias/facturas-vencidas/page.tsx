"use client"

import { useMemo } from "react"
import { Download, FileSpreadsheet, FileIcon as FilePdf } from "lucide-react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { PageTransition, StaggerContainer, StaggerItem, AnimatedCard } from "@/components/ui/animations"
import { cn } from "@/lib/utils"

import { useGetIngresosPorEdadesQuery } from "@/lib/redux/services/cuentasPorCobrarApi"
import { formatCurrency } from "@/lib/utils"

// Common styles for "surface" cards to match other pages
const surfaceCardClass = "bg-white/80 dark:bg-slate-950/50 backdrop-blur-xl border-slate-200/60 dark:border-slate-800/60 shadow-sm"

export default function FacturasVencidasPage() {
  const { data, isLoading } = useGetIngresosPorEdadesQuery()
  const facturas = data?.facturas

  // Calculate totals for footer
  const totals = useMemo(() => {
    if (!facturas) return { dias30: 0, dias60: 0, dias90: 0, dias120: 0, diasPlus120: 0, total: 0 }
    
    return facturas.reduce((acc, factura) => {
      const saldo = factura.saldo
      const cat = factura.categoria
      
      const newAcc = { ...acc }
      newAcc.total += saldo
      
      if (cat === 'Corriente') newAcc.dias30 += saldo
      else if (cat === '30-60 Días') newAcc.dias60 += saldo
      else if (cat === '60-90 Días') newAcc.dias90 += saldo
      else if (cat === '90-120 Días') newAcc.dias120 += saldo
      else if (cat === '+120 Días') newAcc.diasPlus120 += saldo
      
      return newAcc
    }, { dias30: 0, dias60: 0, dias90: 0, dias120: 0, diasPlus120: 0, total: 0 })
  }, [facturas])

  const handleExportExcel = () => {
    if (!facturas) return

    // Prepare data for CSV
    const headers = [
      "Factura", 
      "Cliente", 
      "Fecha Emisión", 
      "0-30 Días", 
      "30-60 Días", 
      "60-90 Días", 
      "90-120 Días", 
      "120+ Días", 
      "Total Deuda",
      "Días Vencido"
    ]

    const rows = facturas.map(factura => {
      const is30 = factura.categoria === 'Corriente'
      const is60 = factura.categoria === '30-60 Días'
      const is90 = factura.categoria === '60-90 Días'
      const is120 = factura.categoria === '90-120 Días'
      const isPlus120 = factura.categoria === '+120 Días'

      return [
        factura.numero || 'S/N',
        factura.cliente,
        new Date(factura.fecha).toLocaleDateString(),
        is30 ? factura.saldo : 0,
        is60 ? factura.saldo : 0,
        is90 ? factura.saldo : 0,
        is120 ? factura.saldo : 0,
        isPlus120 ? factura.saldo : 0,
        factura.saldo,
        factura.dias
      ]
    })

    // Add totals row
    rows.push([
      "TOTALES",
      "",
      "",
      totals.dias30,
      totals.dias60,
      totals.dias90,
      totals.dias120,
      totals.diasPlus120,
      totals.total,
      ""
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const date = new Date().toISOString().split('T')[0]
    
    link.href = URL.createObjectURL(blob)
    link.download = `facturas_vencidas_${date}.csv`
    link.style.display = "none"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleExportPDF = () => {
    if (!facturas) return

    const doc = new jsPDF()

    // Title
    doc.setFontSize(18)
    doc.text("Reporte de Facturas Vencidas", 14, 22)
    doc.setFontSize(11)
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 30)

    const tableData = facturas.map(factura => {
      const is30 = factura.categoria === 'Corriente'
      const is60 = factura.categoria === '30-60 Días'
      const is90 = factura.categoria === '60-90 Días'
      const is120 = factura.categoria === '90-120 Días'
      const isPlus120 = factura.categoria === '+120 Días'

      return [
        factura.numero || 'S/N',
        factura.cliente,
        new Date(factura.fecha).toLocaleDateString(),
        is30 ? formatCurrency(factura.saldo) : '-',
        is60 ? formatCurrency(factura.saldo) : '-',
        is90 ? formatCurrency(factura.saldo) : '-',
        is120 ? formatCurrency(factura.saldo) : '-',
        isPlus120 ? `${formatCurrency(factura.saldo)}\n(${factura.dias} días)` : '-',
        formatCurrency(factura.saldo)
      ]
    })

    // Add totals
    tableData.push([
      "TOTALES",
      "",
      "",
      formatCurrency(totals.dias30),
      formatCurrency(totals.dias60),
      formatCurrency(totals.dias90),
      formatCurrency(totals.dias120),
      formatCurrency(totals.diasPlus120),
      formatCurrency(totals.total)
    ])

    autoTable(doc, {
      head: [[
        "Factura", "Cliente", "Fecha", "0-30", "30-60", "60-90", "90-120", "120+", "Total"
      ]],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [66, 66, 66] },
      columnStyles: {
        3: { halign: 'right', textColor: [22, 163, 74] }, // green
        4: { halign: 'right', textColor: [202, 138, 4] }, // yellow/orange
        5: { halign: 'right', textColor: [234, 88, 12] }, // orange
        6: { halign: 'right', textColor: [220, 38, 38] }, // red
        7: { halign: 'right', textColor: [153, 27, 27] }, // dark red
        8: { halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (data) => {
        // Highlight totals row
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = [240, 240, 240]
        }
      }
    })

    const date = new Date().toISOString().split('T')[0]
    doc.save(`facturas_vencidas_${date}.pdf`)
  }

  return (
    <SidebarProvider>
      <SidebarInset className="bg-background">
        <PageTransition className="flex-1 space-y-8 p-4 md:p-8 pt-6">
          <StaggerContainer className="space-y-8">
            <StaggerItem className="flex items-center justify-between space-y-2">
              <div>
                <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
                  Facturas Vencidas
                </h2>
                <p className="text-muted-foreground">
                  Desglose detallado de facturas por antigüedad
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="transition-all hover:bg-muted">
                      <Download className="mr-2 h-4 w-4" />
                      Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExportExcel}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Exportar Excel (CSV)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportPDF}>
                      <FilePdf className="mr-2 h-4 w-4" />
                      Exportar PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </StaggerItem>

            <StaggerItem>
              <AnimatedCard>
                <Card className={surfaceCardClass}>
                  <CardHeader>
                    <CardTitle>Listado de Facturas</CardTitle>
                    <CardDescription>
                      Visualización por rangos de días de vencimiento
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Factura</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-right text-green-600">0-30 Días</TableHead>
                          <TableHead className="text-right text-yellow-600">30-60 Días</TableHead>
                          <TableHead className="text-right text-orange-600">60-90 Días</TableHead>
                          <TableHead className="text-right text-red-500">90-120 Días</TableHead>
                          <TableHead className="text-right text-red-700">120+ Días</TableHead>
                          <TableHead className="text-right font-bold">Total Deuda</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-4">Cargando facturas...</TableCell>
                          </TableRow>
                        ) : facturas?.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-4 text-muted-foreground">No hay facturas vencidas.</TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {facturas?.map((factura) => {
                              const is30 = factura.categoria === 'Corriente';
                              const is60 = factura.categoria === '30-60 Días';
                              const is90 = factura.categoria === '60-90 Días';
                              const is120 = factura.categoria === '90-120 Días';
                              const isPlus120 = factura.categoria === '+120 Días';

                              return (
                                <TableRow key={factura.id} className="hover:bg-muted/50 transition-colors">
                                  <TableCell className="font-medium">
                                    {factura.numero || 'S/N'}
                                  </TableCell>
                                  <TableCell>{factura.cliente}</TableCell>
                                  <TableCell>{new Date(factura.fecha).toLocaleDateString()}</TableCell>
                                  
                                  <TableCell className="text-right">
                                    {is30 ? formatCurrency(factura.saldo) : '-'}
                                  </TableCell>
                                  
                                  <TableCell className="text-right">
                                    {is60 ? formatCurrency(factura.saldo) : '-'}
                                  </TableCell>
                                  
                                  <TableCell className="text-right">
                                    {is90 ? formatCurrency(factura.saldo) : '-'}
                                  </TableCell>
                                  
                                  <TableCell className="text-right">
                                    {is120 ? formatCurrency(factura.saldo) : '-'}
                                  </TableCell>
                                  
                                  <TableCell className="text-right">
                                    {isPlus120 ? (
                                      <div className="flex flex-col items-end">
                                        <span className="font-medium text-destructive">{formatCurrency(factura.saldo)}</span>
                                        <span className="text-[10px] text-muted-foreground">
                                          Hace {factura.dias} días
                                        </span>
                                      </div>
                                    ) : '-'}
                                  </TableCell>
                                  
                                  <TableCell className="text-right font-bold">
                                    {formatCurrency(factura.saldo)}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                            
                            {/* Totals Row */}
                            <TableRow className="bg-muted/50 font-bold border-t-2">
                              <TableCell colSpan={3} className="text-right">TOTALES</TableCell>
                              <TableCell className="text-right text-green-700">{formatCurrency(totals.dias30)}</TableCell>
                              <TableCell className="text-right text-yellow-700">{formatCurrency(totals.dias60)}</TableCell>
                              <TableCell className="text-right text-orange-700">{formatCurrency(totals.dias90)}</TableCell>
                              <TableCell className="text-right text-red-600">{formatCurrency(totals.dias120)}</TableCell>
                              <TableCell className="text-right text-red-800">{formatCurrency(totals.diasPlus120)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(totals.total)}</TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </AnimatedCard>
            </StaggerItem>
          </StaggerContainer>
        </PageTransition>
      </SidebarInset>
    </SidebarProvider>
  )
}
