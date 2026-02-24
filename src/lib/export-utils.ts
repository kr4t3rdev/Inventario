//import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { format } from "date-fns"

//(jsPDF as any).prototype.autoTable = autoTable

// export function exportToExcel(data: any[], filename: string) {
//   // Convertir data (array de objetos) a array de arrays (AOA)
//   const headers = Object.keys(data[0] || {})
//   const aoaData = [
//     headers,
//     ...data.map(row => headers.map(header => row[header]))
//   ]
//   const worksheet = XLSX.utils.aoa_to_sheet(aoaData)
//   const workbook = XLSX.utils.book_new()
//   XLSX.utils.book_append_sheet(workbook, worksheet, "Datos")

//   // Ajustar ancho de columnas
//   const columnsWidth = Object.keys(data[0] || {}).map(() => ({ wch: 20 }))
//   worksheet["!cols"] = columnsWidth

//   // Generar archivo
//   const date = format(new Date(), "yyyy-MM-dd")
//   XLSX.writeFile(workbook, `${filename}_${date}.xlsx`)
// }

export function exportToPdf(data: any[], categorias: any[] | null, title: string) {
  const doc = new jsPDF()
  
  // Título
  doc.setFontSize(18)
  doc.text(title, 14, 22)

  // Fecha
  doc.setFontSize(11)
  doc.text(`Fecha: ${format(new Date(), "dd/MM/yyyy")}`, 14, 30)

  let currentY = 40

  const addTable = (tableData: any[], sectionTitle: string, columns: any[]) => {
    if (tableData.length === 0) return

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(sectionTitle, 14, currentY)
    currentY += 5

    const keys = Object.keys(tableData[0] || {})
    const tableColumns = columns.length > 0 
      ? columns 
      : keys.map((key) => ({ header: key.charAt(0).toUpperCase() + key.slice(1), dataKey: key }))

    autoTable(doc, {
      columns: tableColumns.map((col) => ({
        header: col.header,
        dataKey: col.dataKey,
      })),
      body: tableData,
      startY: currentY,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
    })

    currentY = (doc as any).lastAutoTable.finalY + 15
  }

  // Si hay categorias definidas, usarlas
  if (categorias && categorias.length > 0) {
    categorias.forEach((cat) => {
      if (cat.data && cat.data.length > 0) {
        let columns: any[] = []
        
        if (cat.nombre === 'Resumen') {
          columns = [
            { header: 'Concepto', dataKey: 'concepto' },
            { header: 'Valor', dataKey: 'valor' }
          ]
          const resumenConConceptos: { concepto: string; valor: unknown }[] = []
          const r = cat.data[0]
          const conceptos = [
            { key: 'fecha', label: 'Fecha' },
            { key: 'totalVentas', label: 'Total Ventas' },
            { key: 'totalServicios', label: 'Total Servicios' },
            { key: 'totalIngresos', label: 'Total Ingresos' },
            { key: 'totalGastos', label: 'Total Gastos' },
            { key: 'diferencia', label: 'Diferencia Neta' }
          ]
          conceptos.forEach(c => {
            resumenConConceptos.push({ concepto: c.label, valor: r[c.key] || '-' })
          })
          addTable(resumenConConceptos, cat.nombre, columns)
        } else if (cat.nombre === 'Ventas y Servicios') {
          columns = [
            { header: 'ID', dataKey: 'id' },
            { header: 'Hora', dataKey: 'hora' },
            { header: 'Cliente', dataKey: 'cliente' },
            { header: 'Producto', dataKey: 'producto' },
            { header: 'Cant', dataKey: 'cantidad' },
            { header: 'Tipo', dataKey: 'tipo' },
            { header: 'Método', dataKey: 'metodoPago' },
            { header: 'Total', dataKey: 'total' }
          ]
          addTable(cat.data, cat.nombre, columns)
        } else if (cat.nombre === 'Movimientos de Caja') {
          columns = [
            { header: 'Hora', dataKey: 'hora' },
            { header: 'Tipo', dataKey: 'tipo' },
            { header: 'Descripción', dataKey: 'descripcion' },
            { header: 'Referencia', dataKey: 'referencia' },
            { header: 'Monto', dataKey: 'monto' }
          ]
          addTable(cat.data, cat.nombre, columns)
        } else {
          addTable(cat.data, cat.nombre, [])
        }
      }
    })
  } else {
  // Determinar tipo de datos y configurar columnas
  let columns: any[] = []
  let tableData: any[] = []

  // Caso especial: productos con formato plano (no anidado)
  if (data[0]?.nombre && (data[0]?.stock !== undefined) && (data[0]?.precioCosto !== undefined)) {
    columns = [
      { header: "Producto", dataKey: "nombre" },
      { header: "Categoría", dataKey: "categoría" },
      { header: "Stock", dataKey: "stock" },
      { header: "Stock Mínimo", dataKey: "stockMínimo" },
      { header: "Precio Costo", dataKey: "precioCosto" },
      { header: "Precio Venta", dataKey: "precioVenta" },
      { header: "Valor Inventario", dataKey: "valorInventario" },
      { header: "Valor Venta", dataKey: "valorVenta" },
    ]

    tableData = data.map((item) => ({
      nombre: item.Producto || item.nombre,
      categoría: item.Categoría || item.categoría || "",
      stock: item.Stock || item.stock || 0,
      stockMínimo: item["Stock Mínimo"] || item.stockMínimo || "-",
      precioCosto: item["Precio Costo"] ? `$${item["Precio Costo"]}` : (item.precioCosto ? `$${item.precioCosto}` : "-"),
      precioVenta: item["Precio Venta"] ? `$${item["Precio Venta"]}` : (item.precioVenta ? `$${item.precioVenta}` : "-"),
      valorInventario: item["Valor Inventario"] || item.valorInventario ? `$${item["Valor Inventario"] || item.valorInventario}` : "-",
      valorVenta: item["Valor Venta"] || item.valorVenta ? `$${item["Valor Venta"] || item.valorVenta}` : "-",
    }))
  } else if (data[0]?.nombre && (data[0]?.stock !== undefined || data[0]?.stockUbicacion !== undefined)) {
      columns = [
        { header: "Producto", dataKey: "nombre" },
        { header: "Categoría", dataKey: "categoria" },
        { header: "Subcategoría", dataKey: "subcategoria" },
        { header: "Stock", dataKey: "stock" },
        { header: "Precio", dataKey: "precio" },
        { header: "Valor", dataKey: "valor" },
      ]

      tableData = data.map((item) => ({
        nombre: item.nombre,
        categoria: (item as any)?.categoria?.nombre || "",
        subcategoria: (item as any)?.subcategoria?.nombre || "",
        stock: item.stockUbicacion !== undefined ? item.stockUbicacion : (item.stock || 0),
        precio: `$${item.precioCosto}`,
        valor: `$${((item.stockUbicacion !== undefined ? item.stockUbicacion : (item.stock || 0)) * item.precioCosto)}`,
      }))
    } else if (data[0]?.ventaId) {
      columns = [
        { header: "ID", dataKey: "id" },
        { header: "Producto", dataKey: "producto" },
        { header: "Cantidad", dataKey: "cantidad" },
        { header: "Fecha", dataKey: "fecha" },
        { header: "Punto de Venta", dataKey: "puntoVenta" },
      ]

      tableData = data.map((item) => ({
        id: item.ventaId,
        producto: item.productoNombre || item.productoId,
        cantidad: item.cantidad,
        fecha: format(new Date(item.createdAt), "dd/MM/yyyy"),
        puntoVenta: item.puntoDeVentaNombre || "",
      }))
    } else if (data[0]?.mermaId) {
      columns = [
        { header: "ID", dataKey: "id" },
        { header: "Producto", dataKey: "producto" },
        { header: "Cantidad", dataKey: "cantidad" },
        { header: "Fecha", dataKey: "fecha" },
        { header: "Motivo", dataKey: "motivo" },
      ]

      tableData = data.map((item) => ({
        id: item.mermaId,
        producto: item.productoNombre || item.productoId,
        cantidad: item.cantidad,
        fecha: format(new Date(item.createdAt), "dd/MM/yyyy"),
        motivo: item.motivo,
      }))
    } else if (data[0]?.transferenciaId) {
      columns = [
        { header: "ID", dataKey: "id" },
        { header: "Producto", dataKey: "producto" },
        { header: "Cantidad", dataKey: "cantidad" },
        { header: "Fecha", dataKey: "fecha" },
        { header: "Origen", dataKey: "origen" },
        { header: "Destino", dataKey: "destino" },
      ]

      tableData = data.map((item) => ({
        id: item.transferenciaId,
        producto: item.productoNombre || item.productoId,
        cantidad: item.cantidad,
        fecha: format(new Date(item.createdAt), "dd/MM/yyyy"),
        origen: item.origenNombre || item.puntoDeVentaOrigenNombre || "N/A",
        destino: item.destinoNombre || item.puntoDeVentaDestinoNombre || "N/A",
      }))
    } else if (data[0]?.categoriaId) {
      columns = [
        { header: "Categoría", dataKey: "nombre" },
        { header: "Productos", dataKey: "productos" },
        { header: "Stock", dataKey: "stock" },
        { header: "Valor", dataKey: "valor" },
      ]

      tableData = data.map((item) => ({
        nombre: item.nombre,
        productos: item.cantidadProductos,
        stock: item.stockTotal,
        valor: `$${item.valorTotal}`,
      }))
    } else {
      const keys = Object.keys(data[0] || {})
      columns = keys.map((key) => ({ header: key.charAt(0).toUpperCase() + key.slice(1), dataKey: key }))
      tableData = data
    }

    addTable(tableData, 'Datos', columns)
  }

  // Pie de página
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(10)
    doc.text(`Página ${i} de ${pageCount}`, (doc as any).internal.pageSize.width / 2, (doc as any).internal.pageSize.height - 10, {
      align: "center",
    })
  }

  // Guardar PDF
  const date = format(new Date(), "yyyy-MM-dd_HHmmss")
  doc.save(`${title.replace(/\s+/g, "_")}_${date}.pdf`)
}

export function exportToCsv(data: any[], filename: string) {
  // Convertir objetos a CSV
  const headers = Object.keys(data[0] || {})
  const csvRows = [
    headers.join(","), // Encabezados
    ...data.map((row) =>
      headers
        .map((header) => {
          // Escapar comas y comillas
          const cell = row[header] !== undefined ? String(row[header]) : ""
          return `"${cell.replace(/"/g, '""')}"`
        })
        .join(","),
    ),
  ]

  const csvContent = csvRows.join("\n")

  // Crear blob y descargar
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const date = format(new Date(), "yyyy-MM-dd")

  link.href = URL.createObjectURL(blob)
  link.download = `${filename}_${date}.csv`
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

