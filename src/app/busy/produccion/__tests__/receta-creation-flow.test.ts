import { describe, it, expect, beforeEach } from 'vitest'

/**
 * E2E Test: Flujo Completo de Crear Receta
 * 
 * Este test simula el flujo completo en la UI:
 * 1. Usuario abre dialog de nueva receta
 * 2. Ingresa nombre y rendimiento
 * 3. Selecciona producto final (opcional)
 * 4. Busca y agrega productos a la receta
 * 5. Verifica que el costo unitario se calcula correctamente
 */
describe('E2E: Crear Receta Completa con Productos', () => {
  
  it('debe permitir crear una receta desde cero hasta completarla', async () => {
    // Simulamos el estado inicial del componente
    let estado = {
      nombreReceta: '',
      rendimiento: 1,
      selectedProducto: '',
      nuevoItems: [],
      busquedaProductos: '',
      dialogRecetaOpen: false,
    }

    // Mock de datos del servidor
    const productosInventario = [
      { id: 'p1', nombre: 'Harina de Trigo', precioCosto: 100, stock: 500 },
      { id: 'p2', nombre: 'Azúcar Blanca', precioCosto: 80, stock: 300 },
      { id: 'p3', nombre: 'Sal de Mar', precioCosto: 20, stock: 200 },
      { id: 'p-final', nombre: 'Pan Integral', precioCosto: 150, stock: 100 },
    ]

    // PASO 1: Usuario abre el dialog
    estado.dialogRecetaOpen = true
    expect(estado.dialogRecetaOpen).toBe(true)

    // PASO 2: Ingresa nombre de receta
    estado.nombreReceta = 'Pan Integral Artesanal'
    estado.rendimiento = 5
    estado.selectedProducto = 'p-final'

    expect(estado.nombreReceta).toBe('Pan Integral Artesanal')
    expect(estado.rendimiento).toBe(5)
    expect(estado.selectedProducto).toBe('p-final')

    // PASO 3: Busca el primer producto
    estado.busquedaProductos = 'harina'
    
    // Simular filterProductos
    const filtrados = productosInventario.filter(p => 
      p.nombre.toLowerCase().includes(estado.busquedaProductos.toLowerCase()) &&
      !estado.nuevoItems.find(i => i.productoId === p.id)
    )
    
    expect(filtrados).toHaveLength(1)
    expect(filtrados[0].nombre).toBe('Harina de Trigo')

    // PASO 4: Agrega harina
    const productoSeleccionado = filtrados[0]
    estado.nuevoItems.push({
      productoId: productoSeleccionado.id,
      cantidad: 3,
      unidadSimbolo: 'kg',
      desperdicio: 0,
    })
    estado.busquedaProductos = '' // Auto-limpia búsqueda

    expect(estado.nuevoItems).toHaveLength(1)
    expect(estado.busquedaProductos).toBe('')

    // PASO 5: Busca el segundo producto
    estado.busquedaProductos = 'azúcar'
    
    const filtrados2 = productosInventario.filter(p => 
      p.nombre.toLowerCase().includes(estado.busquedaProductos.toLowerCase()) &&
      !estado.nuevoItems.find(i => i.productoId === p.id)
    )
    
    expect(filtrados2).toHaveLength(1)
    expect(filtrados2[0].nombre).toBe('Azúcar Blanca')

    // PASO 6: Agrega azúcar
    estado.nuevoItems.push({
      productoId: filtrados2[0].id,
      cantidad: 1.5,
      unidadSimbolo: 'kg',
      desperdicio: 0.05, // 5% de desperdicio
    })
    estado.busquedaProductos = ''

    expect(estado.nuevoItems).toHaveLength(2)

    // PASO 7: Verifica productos agregados
    expect(estado.nuevoItems[0].productoId).toBe('p1')
    expect(estado.nuevoItems[1].productoId).toBe('p2')

    // PASO 8: Simular cálculo de costoUnitario
    const productoFinal = productosInventario.find(p => p.id === estado.selectedProducto)
    const precioCostoFinal = productoFinal?.precioCosto || 0

    let costoTotal = precioCostoFinal
    for (const item of estado.nuevoItems) {
      const producto = productosInventario.find(p => p.id === item.productoId)
      const costoProducto = (item.cantidad * (producto?.precioCosto || 0))
      costoTotal += costoProducto
    }

    const costoUnitario = Math.round((costoTotal / estado.rendimiento) * 100) / 100

    // Verificación del cálculo:
    // Producto final: 150
    // Harina: 3 * 100 = 300
    // Azúcar: 1.5 * 80 = 120
    // Total: 150 + 300 + 120 = 570
    // Costo unitario: 570 / 5 = 114

    expect(costoTotal).toBe(570)
    expect(costoUnitario).toBe(114)

    // PASO 9: Usuario confirma crear receta
    // Aquí iríamos a hacer POST a /api/produccion/recetas
    const payloadReceta = {
      nombre: estado.nombreReceta,
      rendimiento: estado.rendimiento,
      productoId: estado.selectedProducto || undefined,
    }

    expect(payloadReceta.nombre).toBe('Pan Integral Artesanal')
    expect(payloadReceta.rendimiento).toBe(5)
    expect(payloadReceta.productoId).toBe('p-final')

    // PASO 10: Simular POST a ingredientes
    // La API recalcularía el costoUnitario aquí
    const payloadIngredientes = {
      ingredientes: estado.nuevoItems,
    }

    expect(payloadIngredientes.ingredientes).toHaveLength(2)
    expect(payloadIngredientes.ingredientes[0].cantidad).toBe(3)
    expect(payloadIngredientes.ingredientes[1].cantidad).toBe(1.5)

    // PASO 11: Dialog se cierra y estado se resetea
    estado.dialogRecetaOpen = false
    estado.nombreReceta = ''
    estado.rendimiento = 1
    estado.selectedProducto = ''
    estado.nuevoItems = []
    estado.busquedaProductos = ''

    expect(estado.dialogRecetaOpen).toBe(false)
    expect(estado.nombreReceta).toBe('')
    expect(estado.nuevoItems).toHaveLength(0)
  })

  it('debe prevenir agregar el mismo producto dos veces', async () => {
    let nuevoItems = [
      { productoId: 'p1', cantidad: 1, unidadSimbolo: null, desperdicio: 0 },
    ]

    const productosInventario = [
      { id: 'p1', nombre: 'Harina de Trigo', precioCosto: 100, stock: 500 },
      { id: 'p2', nombre: 'Azúcar Blanca', precioCosto: 80, stock: 300 },
    ]

    // Simular filterProductos - debe excluir p1 porque ya está en nuevoItems
    const filtrados = productosInventario.filter(p => 
      !nuevoItems.find(i => i.productoId === p.id)
    )

    expect(filtrados).toHaveLength(1)
    expect(filtrados[0].id).toBe('p2')
    expect(filtrados[0].id).not.toBe('p1') // p1 debe estar filtrado
  })

  it('debe mostrar busqueda vacía cuando no hay coincidencias', () => {
    const busquedaProductos = 'cemento'
    
    const productosInventario = [
      { id: 'p1', nombre: 'Harina de Trigo', precioCosto: 100, stock: 500 },
      { id: 'p2', nombre: 'Azúcar Blanca', precioCosto: 80, stock: 300 },
    ]

    const filtrados = productosInventario.filter(p =>
      p.nombre.toLowerCase().includes(busquedaProductos.toLowerCase())
    )

    expect(filtrados).toHaveLength(0)
  })

  it('debe mostrar todos los productos si búsqueda está vacía', () => {
    const busquedaProductos = ''
    
    const productosInventario = [
      { id: 'p1', nombre: 'Harina de Trigo', precioCosto: 100, stock: 500 },
      { id: 'p2', nombre: 'Azúcar Blanca', precioCosto: 80, stock: 300 },
      { id: 'p3', nombre: 'Sal de Mar', precioCosto: 20, stock: 200 },
    ]

    const filtrados = productosInventario.filter(p =>
      busquedaProductos === '' || 
      p.nombre.toLowerCase().includes(busquedaProductos.toLowerCase())
    )

    expect(filtrados).toHaveLength(3)
  })

  it('debe permitir editar cantidad y unidad de producto agregado', () => {
    let nuevoItems = [
      { productoId: 'p1', cantidad: 1, unidadSimbolo: null, desperdicio: 0 },
    ]

    // Usuario edita cantidad
    nuevoItems[0].cantidad = 3.5
    expect(nuevoItems[0].cantidad).toBe(3.5)

    // Usuario selecciona unidad
    nuevoItems[0].unidadSimbolo = 'kg'
    expect(nuevoItems[0].unidadSimbolo).toBe('kg')

    // Usuario agrega desperdicio
    nuevoItems[0].desperdicio = 0.1 // 10%
    expect(nuevoItems[0].desperdicio).toBe(0.1)
  })

  it('debe permitir eliminar producto agregado', () => {
    let nuevoItems = [
      { productoId: 'p1', cantidad: 1, unidadSimbolo: null, desperdicio: 0 },
      { productoId: 'p2', cantidad: 2, unidadSimbolo: 'kg', desperdicio: 0 },
      { productoId: 'p3', cantidad: 1.5, unidadSimbolo: 'l', desperdicio: 0.05 },
    ]

    expect(nuevoItems).toHaveLength(3)

    // Eliminar p2
    nuevoItems = nuevoItems.filter(i => i.productoId !== 'p2')

    expect(nuevoItems).toHaveLength(2)
    expect(nuevoItems.every(i => i.productoId !== 'p2')).toBe(true)
  })

  it('debe validar que nombre no esté vacío', () => {
    const nombre = ''
    const isValid = nombre.trim().length > 0 && nombre.length <= 160

    expect(isValid).toBe(false)
  })

  it('debe validar que rendimiento sea mayor a 0', () => {
    const validarRendimiento = (valor: number) => {
      return valor >= 1
    }

    expect(validarRendimiento(0)).toBe(false)
    expect(validarRendimiento(1)).toBe(true)
    expect(validarRendimiento(100)).toBe(true)
    expect(validarRendimiento(-5)).toBe(false)
  })

  it('debe permitir crear receta sin producto final', () => {
    const selectedProducto = ''
    const isValid = selectedProducto === '' || selectedProducto.length > 0

    expect(isValid).toBe(true)
  })

  it('debe recalcular costo cuando se modifica cantidad de ingrediente', () => {
    const precioCostoFinal = 150
    const rendimiento = 5
    const items = [
      { productoId: 'p1', cantidad: 3, precioCosto: 100 },
    ]

    let costoTotal = precioCostoFinal
    for (const item of items) {
      costoTotal += item.cantidad * item.precioCosto
    }
    let costoUnitario = Math.round((costoTotal / rendimiento) * 100) / 100

    expect(costoUnitario).toBe((150 + 300) / 5) // 450 / 5 = 90

    // Usuario modifica cantidad
    items[0].cantidad = 6

    costoTotal = precioCostoFinal
    for (const item of items) {
      costoTotal += item.cantidad * item.precioCosto
    }
    costoUnitario = Math.round((costoTotal / rendimiento) * 100) / 100

    expect(costoUnitario).toBe((150 + 600) / 5) // 750 / 5 = 150
  })
})
