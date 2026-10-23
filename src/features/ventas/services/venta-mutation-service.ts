import { Prisma } from '@/generated/prisma';
import type { Venta } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import { hasPermission, requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { registrarMovimiento } from '@/features/inventario/movimientos';
import { allocateFifoForSale, getCostoFifoVentaValorado } from '@/lib/services/fifo-allocation';
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine';
import { buildEventoCostoVenta } from '@/features/contabilidad-formal/lib/event-builders';
import { createVentaSchema } from '@/features/ventas/schemas';
import {
	fingerprintVentaCreatePayload,
	hashVentaCreateKey,
	isVentaCreateReceiptUniqueViolation,
	reviveVentaCreateResponse,
	snapshotVentaCreateResponse,
} from '@/features/ventas/services/venta-create-idempotency';
import { applyFacturacionCobroWorkflow } from '@/features/ventas/services/facturacion-workflow';
import { resolvePrecioVenta, type PrecioVentaFuente } from '@/features/ventas/services/precio-venta-resolver';
import { resolverTurnoDentroDeTx } from '@/features/turnos-pos/services/turno-tx';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { VENTA_SELECT } from '@/features/ventas/services/venta-read-service';
import { VentaLifecycleService } from '@/features/ventas/services/venta-lifecycle-service';
import { validarCobro } from '@/features/ventas/services/pos-vuelto-calcu';
import {
  auditarCreditoOverride,
  validarCreditoOrigen,
  type CreditoOverrideDecision,
} from '@/features/ventas/services/credito-override';
import { conReintentosCredito } from '@/features/ventas/services/credito-retry';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import type { AnularVentaInput, CreateVentaInput } from '@/features/ventas/schemas';

/** Detalle de un precio aplicado distinto al resuelto (permiso ventas.precio.override). */
type PriceOverrideDetalle = {
  productoId: string;
  nombre: string;
  precioEsperado: number;
  precioAplicado: number;
  fuente: PrecioVentaFuente;
};

type VentaCatalogReader = Pick<Prisma.TransactionClient, 'puntoDeVenta' | 'cliente' | 'producto'>;
type ParsedCreateVentaInput = ReturnType<typeof createVentaSchema.parse>;
type VentaCatalogValidation = {
	itemsData: { productoId: string; cantidad: number; precioUnitario: number; total: number }[];
	overrides: PriceOverrideDetalle[];
	subtotalVenta: number;
	cargoTransporte: number;
	totalVenta: number;
	totalCantidad: number;
	cambioDerivado: number | null;
};

/**
 * @description Resolves tenant-scoped catalog prices and validates sale totals/cash.
 * @param {VentaCatalogReader} reader - Prisma root client or active transaction client.
 * @param {ParsedCreateVentaInput} parsed - Validated and normalized request payload.
 * @param {string} tenantId - Authenticated tenant identifier.
 * @param {AuthenticatedUser} user - Authenticated actor used for price overrides.
 * @returns {Promise<VentaCatalogValidation>} Verified sale totals and persisted line data.
 */
async function validarCatalogoVenta(
	reader: VentaCatalogReader,
	parsed: ParsedCreateVentaInput,
	tenantId: string,
	user: AuthenticatedUser,
): Promise<VentaCatalogValidation> {
	const puntoVenta = await reader.puntoDeVenta.findFirst({
		where: { pvId: parsed.puntoDeVentaId, tenantId },
		select: { pvId: true, listaPrecioId: true },
	});
	if (!puntoVenta) throw new ActionError('Punto de venta no encontrado', 'NOT_FOUND');

	let clienteListaId: string | null = null;
	if (parsed.clienteId) {
		const cliente = await reader.cliente.findFirst({
			where: { clienteId: parsed.clienteId, tenantId },
			select: { listaPrecioId: true },
		});
		if (!cliente) throw new ActionError('Cliente no encontrado', 'NOT_FOUND');
		clienteListaId = cliente.listaPrecioId;
	}
	const productoIds = [...new Set(parsed.items.map((item) => item.productoId))];
	const productos = await reader.producto.findMany({
		where: { id: { in: productoIds }, tenantId },
		select: {
			id: true,
			nombre: true,
			precioVenta: true,
			precios: { select: { listaPrecioId: true, precio: true } },
		},
	});
	const productoPrecioMap = new Map(productos.map((product) => [product.id, product]));
	const puedeOverridePrecio = hasPermission(user, 'ventas.precio.override');
	const overrides: PriceOverrideDetalle[] = [];
	const itemsData = parsed.items.map((item) => {
		const producto = productoPrecioMap.get(item.productoId);
		if (!producto) {
			throw new ActionError(`Producto con ID ${item.productoId} no encontrado`, 'NOT_FOUND');
		}
		const { precio, fuente } = resolvePrecioVenta({
			precioBase: producto.precioVenta,
			precios: producto.precios,
			pvListaId: puntoVenta.listaPrecioId,
			clienteListaId,
		});
		if (precio !== item.precioUnitario) {
			if (!puedeOverridePrecio) {
				throw new ActionError(
					`El precio de "${producto.nombre}" no coincide con el vigente (${precio}). Recarga los productos e inténtalo de nuevo.`,
					'PRICE_MISMATCH',
				);
			}
			overrides.push({
				productoId: producto.id,
				nombre: producto.nombre,
				precioEsperado: precio,
				precioAplicado: item.precioUnitario,
				fuente,
			});
		}
		return {
			productoId: item.productoId,
			cantidad: item.cantidad,
			precioUnitario: item.precioUnitario,
			total: item.cantidad * item.precioUnitario,
		};
	});
	const subtotalVenta = itemsData.reduce((sum, item) => sum + item.total, 0);
	const cargoTransporte = parsed.cargoTransporte ?? 0;
	const totalVenta = subtotalVenta - (parsed.descuento ?? 0) + cargoTransporte;
	const totalCantidad = itemsData.reduce((sum, item) => sum + item.cantidad, 0);
	const cobro = validarCobro({
		metodoPago: parsed.metodoPago ?? null,
		montoEfectivo: parsed.montoEfectivo ?? 0,
		montoRecibidoEfectivo: parsed.montoRecibidoEfectivo ?? null,
	});
	if (!cobro.ok) {
		throw new ActionError(
			'El efectivo recibido no alcanza la porción en efectivo de la venta.',
			'RECIBIDO_INSUFICIENTE',
		);
	}
	const cambioDerivado = parsed.modoPedido ? null : cobro.cambio;
	if (parsed.cambioDevuelto != null && parsed.cambioDevuelto !== cambioDerivado) {
		throw new ActionError(
			'El cambio declarado no coincide con el efectivo recibido y la porción cobrada.',
			'CAMBIO_INCONSISTENTE',
		);
	}
	return {
		itemsData,
		overrides,
		subtotalVenta,
		cargoTransporte,
		totalVenta,
		totalCantidad,
		cambioDerivado,
	};
}

/**
 * @description Descuenta el stock por item, registra el kardex de salida y
 * aplica las allocations FIFO (efectos de la entrega de una venta).
 * @param {Prisma.TransactionClient} tx - Cliente transaccional de Prisma.
 * @param {object} params - Datos de la entrega: tenant, venta, punto de venta
 * (o almacén por item), líneas y usuario que ejecuta.
 * @returns {Promise<void>} No devuelve valor; aborta la transacción si el
 * stock es insuficiente o el registro está inconsistente.
 */
async function aplicarEfectosInventario(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    ventaId: string;
    puntoDeVentaId?: string | null;
    itemsData: { productoId: string; cantidad: number; precioUnitario: number; total: number }[];
    userId: string;
  },
) {
  const { tenantId, ventaId, puntoDeVentaId, itemsData, userId } = params;
  for (const [itemIdx, item] of itemsData.entries()) {
    const producto = await tx.producto.findUnique({
      where: { id: item.productoId },
      select: {
        id: true,
        nombre: true,
        stock: true,
        precioCosto: true,
        almacenId: true,
        tenantId: true,
      },
    });

    if (!producto) {
      throw new ActionError(`Producto con ID ${item.productoId} no encontrado`, 'NOT_FOUND');
    }

    if (puntoDeVentaId) {
      const stockPV = await tx.stockUbicacion.findUnique({
        where: {
          productoId_tipoUbicacion_ubicacionId: {
            productoId: item.productoId,
            tipoUbicacion: 'punto_venta',
            ubicacionId: puntoDeVentaId,
          },
        },
        select: { cantidadDisponible: true },
      });

      if (stockPV === null) {
        throw new ActionError(
          `El producto "${producto.nombre}" no tiene registro de stock en este punto de venta. Complete el backfill de StockUbicacion antes de vender.`,
          'STOCK_INCONSISTENTE',
        );
      }

      if (stockPV.cantidadDisponible < item.cantidad) {
        throw new ActionError(
          `Stock insuficiente en el punto de venta. Disponible: ${stockPV.cantidadDisponible}, solicitado: ${item.cantidad}`,
          'STOCK_INSUFICIENTE',
        );
      }
    } else if (producto.almacenId) {
      const stockAlmacen = await tx.stockUbicacion.findUnique({
        where: {
          productoId_tipoUbicacion_ubicacionId: {
            productoId: item.productoId,
            tipoUbicacion: 'almacen',
            ubicacionId: producto.almacenId,
          },
        },
        select: { cantidadDisponible: true },
      });

      if (stockAlmacen === null) {
        throw new ActionError(
          `El producto "${producto.nombre}" no tiene registro de stock en su almacén. Complete el backfill de StockUbicacion antes de vender.`,
          'STOCK_INCONSISTENTE',
        );
      }

      if (stockAlmacen.cantidadDisponible < item.cantidad) {
        throw new ActionError(
          `Stock insuficiente en el almacén. Disponible: ${stockAlmacen.cantidadDisponible}, solicitado: ${item.cantidad}`,
          'STOCK_INSUFICIENTE',
        );
      }
    }

    if (puntoDeVentaId) {
      await upsertStockUbicacion(tx, {
        tenantId: producto.tenantId,
        productoId: item.productoId,
        tipoUbicacion: 'punto_venta',
        ubicacionId: puntoDeVentaId,
        modo: 'increment',
        delta: -item.cantidad,
      });
      await registrarMovimiento(tx, {
        tenantId,
        productoId: item.productoId,
        tipoOrigen: 'VENTA',
        origenId: ventaId,
        tipoUbicacion: 'punto_venta',
        ubicacionId: puntoDeVentaId,
        cantidad: -item.cantidad,
        costoUnitario: producto.precioCosto,
        secuencia: `ITEM-${itemIdx}`,
        creadoPorId: userId,
      });
    } else if (producto.almacenId) {
      await upsertStockUbicacion(tx, {
        productoId: item.productoId,
        tipoUbicacion: 'almacen',
        ubicacionId: producto.almacenId,
        modo: 'increment',
        delta: -item.cantidad,
      });
      await registrarMovimiento(tx, {
        tenantId,
        productoId: item.productoId,
        tipoOrigen: 'VENTA',
        origenId: ventaId,
        tipoUbicacion: 'almacen',
        ubicacionId: producto.almacenId,
        cantidad: -item.cantidad,
        costoUnitario: producto.precioCosto,
        secuencia: `ITEM-${itemIdx}`,
        creadoPorId: userId,
      });
    }
  }

  await allocateFifoForSale(tx, tenantId, ventaId);
}

/**
 * @description Shared sales mutation service for web and mobile adapters.
 */
export const VentaMutationService = {
  /**
   * @description Creates a sale with its items and stock effects.
   */
  async create({
    input,
    user,
  }: {
    input: CreateVentaInput;
    user: AuthenticatedUser;
  }): Promise<Venta> {
    requireFeature(user, 'ventas-pos', 'realizar ventas');
    requirePermission(user, 'ventas.venta.registrar', 'registrar ventas');
    const parsed = createVentaSchema.parse(input);
    const tenantId = requireTenant(user);
    const hasFacturacion = user.planFeatures?.facturacion === true;
    const esPedido = parsed.modoPedido === true;
    const { idempotencyKey, ...payload } = parsed;
    const keyHash = idempotencyKey ? hashVentaCreateKey(idempotencyKey) : null;
    const payloadFingerprint = idempotencyKey
      ? fingerprintVentaCreatePayload(payload)
      : null;

    if (parsed.clienteId && !hasFacturacion) {
      throw new ActionError(
        'Tu plan no incluye facturación. Para vincular clientes a ventas, actualiza tu plan.',
        'FEATURE_NOT_AVAILABLE',
      );
    }

    // ventas-factura: gate específico para ventas que generan factura
    if (parsed.clienteId) {
      requireFeature(user, 'ventas-factura', 'generar factura desde ventas');
    }

    // 3.2.c.iii: el turno se resuelve DENTRO de la transacción (ver abajo) para
    // que un turno AUTO no persista huérfano si la venta se rechaza.
    const catalogWithoutKey = idempotencyKey
      ? null
      : await validarCatalogoVenta(prisma, parsed, tenantId, user);

    // Reserve the compound tenant+key receipt before catalog/credit validation.
    // The uncommitted reservation and sale effects become visible atomically.
    return conReintentosCredito<Venta>(() =>
      prisma.$transaction(async (tx) => {
      if (keyHash && payloadFingerprint) {
        await tx.ventaCreateIdempotency.create({
          data: {
            tenantId,
            keyHash,
            payloadFingerprint,
            ventaId: null,
            responseSnapshot: Prisma.DbNull,
          },
        });
      }

      const catalog = idempotencyKey
        ? await validarCatalogoVenta(tx, parsed, tenantId, user)
        : catalogWithoutKey;
      if (!catalog) throw new Error('Missing validated product sale catalog');
      const {
        itemsData,
        overrides,
        subtotalVenta,
        cargoTransporte,
        totalVenta,
        totalCantidad,
        cambioDerivado,
      } = catalog;

      let creditoDecision: CreditoOverrideDecision | null = null;
      let montoCreditoAuditado = 0;
      // Porción cobrada hoy (efectivo+tarjeta+transferencia): en MIXTO con
      // vencimiento se concilia hoy y la CxC queda por el remanente.
      const cobradoContado = (parsed.montoEfectivo ?? 0)
        + (parsed.montoTarjeta ?? 0)
        + (parsed.montoTransferencia ?? 0);
      if (parsed.clienteId && !esPedido) {
        const tipoVencimiento = parsed.tipoVencimiento ??
          (parsed.fechaVencimiento ? 'fecha' : null);
        const creaCxC = tipoVencimiento === 'fecha' || tipoVencimiento === 'plazo';
        const creditoDeclarado = parsed.montoCredito ?? 0;
        // Con vencimiento, la CxC que creará el workflow es el remanente tras
        // lo cobrado hoy (regla aprobada: MIXTO consume sólo deuda pendiente).
        const montoCreditoRequerido = creaCxC
          ? Math.max(Math.max(totalVenta, 0) - cobradoContado, 0)
          : creditoDeclarado || (parsed.metodoPago === 'CREDITO' ? Math.max(totalVenta, 0) : 0);
        const requiereCupo = montoCreditoRequerido > 0 || parsed.metodoPago === 'CREDITO';

        if (requiereCupo && montoCreditoRequerido > 0) {
          montoCreditoAuditado = montoCreditoRequerido;
          creditoDecision = await validarCreditoOrigen({
            tx,
            user,
            tenantId,
            clienteId: parsed.clienteId,
            moneda: 'CUP',
            montoNuevo: montoCreditoRequerido,
            permiso: 'ventas.venta.credito-override',
            solicitarCreditoOverride: parsed.solicitarCreditoOverride,
            motivoCreditoOverride: parsed.motivoCreditoOverride,
          });
        }
      }

      // 3.2.c.iii: turno resuelto dentro de la tx; un AUTO creado aquí se
      // deshace con el rollback si la venta se rechaza más adelante.
      let turnoId: string | null = parsed.turnoId ?? null;
      if (!turnoId) {
        turnoId = await resolverTurnoDentroDeTx(tx, {
          tenantId,
          puntoDeVentaId: parsed.puntoDeVentaId,
          empleadoId: parsed.empleadoId,
        });
      }

      let serie: any = null;
      let numeroConsecutivo = 0;
      let numeroFactura = '';

      if (hasFacturacion && !esPedido) {
        serie = await tx.serieFacturacion.findFirst({
          where: { tenantId, esPorDefecto: true },
        });

        if (!serie) {
          serie = await tx.serieFacturacion.findFirst({
            where: { tenantId },
            orderBy: { createdAt: 'asc' },
          });
        }

        if (!serie) {
          serie = await tx.serieFacturacion.create({
            data: {
              tenantId,
              prefijo: 'FV',
              descripcion: 'Facturas de Venta',
              consecutivo: 1,
              esPorDefecto: true,
            },
          });
        }

        const updatedSerie = await tx.serieFacturacion.update({
          where: { serieId: serie.serieId },
          data: { consecutivo: { increment: 1 } },
        });

        numeroConsecutivo = updatedSerie.consecutivo - 1;
        numeroFactura = `${serie.prefijo}-${String(numeroConsecutivo).padStart(6, '0')}`;
      }

      const venta = await tx.venta.create({
        data: {
          tenantId,
          puntoDeVentaId: parsed.puntoDeVentaId,
          clienteId: parsed.clienteId ?? null,
          empleadoId: parsed.empleadoId ?? null,
          turnoId,
          // PVE: el pedido nace sin pago; el cobro se define al facturar.
          estado: esPedido
            ? 'PEDIDO'
            : hasFacturacion && parsed.clienteId
              ? 'FACTURADA'
              : 'ENTREGADA',
          metodoPago: esPedido ? null : (parsed.metodoPago ?? null),
          montoEfectivo: esPedido ? null : (parsed.montoEfectivo ?? null),
          montoTarjeta: esPedido ? null : (parsed.montoTarjeta ?? null),
          montoTransferencia: esPedido ? null : (parsed.montoTransferencia ?? null),
          montoCredito: esPedido ? null : (parsed.montoCredito ?? null),
          // VC: vuelto documentado — el servidor deriva el cambio desde el
          // recibido (única fuente de verdad; el cliente no lo impone).
          montoRecibidoEfectivo: esPedido
            ? null
            : (parsed.montoRecibidoEfectivo ?? null),
          cambioDevuelto: esPedido ? null : cambioDerivado,
          descuento: parsed.descuento ?? 0,
          observaciones: parsed.observaciones ?? null,
          total: Math.max(totalVenta, 0),
          cantidad: totalCantidad,
          esVentaUnica: true,
          items: {
            create: itemsData,
          },
        },
      });

      if (creditoDecision && parsed.clienteId) {
        await auditarCreditoOverride({
          tx,
          user,
          decision: creditoDecision,
          tenantId,
          clienteId: parsed.clienteId,
          origen: 'VENTA_PRODUCTOS',
          origenId: venta.ventaId,
          montoNuevo: montoCreditoAuditado,
        });
      }

      if (overrides.length > 0) {
        await AuditLogService.logStrict(
          {
            accion: 'EXECUTE',
            entidad: 'VENTA',
            entidadId: venta.ventaId,
            usuarioId: user.userId,
            detalles: {
              tipo: 'PRICE_OVERRIDE',
              items: overrides,
            },
          },
          tx,
        );
      }

      if (!esPedido) {
        await aplicarEfectosInventario(tx, {
          tenantId,
          ventaId: venta.ventaId,
          puntoDeVentaId: parsed.puntoDeVentaId,
          itemsData,
          userId: user.userId,
        });

		// El modo off conserva el flujo legacy sin exigir valoración formal de FIFO.
		const modoFormal = process.env.CONTABILIDAD_FORMAL_MODE;
		if (modoFormal === 'shadow' || modoFormal === 'enforce') {
			try {
				const costoFifo = await getCostoFifoVentaValorado(tx, tenantId, venta.ventaId);
				if (costoFifo?.montoFuncional.gt(0)) {
              await postEvento(
                tx,
                { tenantId, userId: user.userId },
                buildEventoCostoVenta({
                  ventaId: venta.ventaId,
                  costoFifo: costoFifo.montoFuncional,
                  monedaFuncional: costoFifo.monedaFuncional,
                }),
              );
				}
			} catch (error) {
            if (
              modoFormal !== 'shadow' ||
              !(error instanceof ActionError) ||
              error.code !== 'FX_INSUFICIENTE'
            ) {
              throw error;
				}
				await postEvento(
					tx,
					{ tenantId, userId: user.userId },
					buildEventoCostoVenta({
						ventaId: venta.ventaId,
						costoFifo: null,
						monedaFuncional: null,
					}),
				);
			}
		}
      }

      if (hasFacturacion && parsed.clienteId && serie) {
        const factura = await tx.factura.create({
          data: {
            tenantId,
            serieId: serie.serieId,
            numeroConsecutivo,
            numeroFactura,
            tipoDocumento: 'FACTURA',
            ventaId: venta.ventaId,
            clienteId: parsed.clienteId,
            subtotal: subtotalVenta,
            descuento: parsed.descuento ?? 0,
            cargoTransporte,
            total: Math.max(totalVenta, 0),
            estado: 'PENDIENTE',
            creadoPor: user.userId || 'sistema',
            fechaVencimiento: parsed.fechaVencimiento ? new Date(parsed.fechaVencimiento) : null,
            cuentaBancariaId: parsed.cuentaBancariaId || null,
          },
        });

        if (parsed.tipoVencimiento || parsed.fechaVencimiento) {
          await applyFacturacionCobroWorkflow(tx, {
            ventaId: venta.ventaId,
            facturaId: factura.idFactura,
            clienteId: parsed.clienteId,
            montoTotal: Math.max(totalVenta, 0),
            usuarioId: user.userId || 'sistema',
            tenantId,
            observaciones: parsed.observaciones,
            tipoVencimiento: parsed.tipoVencimiento || undefined,
            fechaVencimiento: parsed.fechaVencimiento || undefined,
            cuentaBancariaId: parsed.cuentaBancariaId || undefined,
            // Porción cobrada hoy (MIXTO): concilia hoy, CxC por el remanente.
            montoCobradoContado: cobradoContado,
          });
        }
      }

      if (keyHash && payloadFingerprint) {
        await tx.ventaCreateIdempotency.update({
          where: { tenantId_keyHash: { tenantId, keyHash } },
          data: {
            ventaId: venta.ventaId,
            responseSnapshot: snapshotVentaCreateResponse(venta),
          },
        });
      }

      return venta;
      }, { maxWait: 5_000, timeout: 30_000 }).catch(async (error) => {
        if (!keyHash || !payloadFingerprint || !isVentaCreateReceiptUniqueViolation(error)) {
          throw error;
        }
        const receipt = await prisma.ventaCreateIdempotency.findUnique({
          where: { tenantId_keyHash: { tenantId, keyHash } },
        });
        if (!receipt) throw error;
        if (receipt.payloadFingerprint !== payloadFingerprint) {
          throw new ActionError(
            'La clave de idempotencia ya se utilizó con otro contenido.',
            'IDEMPOTENCY_KEY_REUSED',
          );
        }
        if (!receipt.responseSnapshot) {
          throw new ActionError(
            'La solicitud de venta todavía no tiene un resultado reproducible.',
            'IDEMPOTENCY_RECEIPT_INCOMPLETE',
          );
        }
        return reviveVentaCreateResponse(receipt.responseSnapshot);
      }),
    );
  },

  /**
   * @description Updates the basic mutable fields of a sale.
   */
  async update({
    input,
    user,
  }: {
    input: { ventaId: string } & Partial<{ observaciones: string; descuento: number }>;
    user: AuthenticatedUser;
  }) {
    requireFeature(user, 'ventas-pos', 'editar ventas');
    requirePermission(user, 'ventas.venta.editar', 'editar ventas');
    const { ventaId, ...data } = input;
    const tenantId = requireTenant(user);
    const existing = await prisma.venta.findFirst({
      where: { ventaId, tenantId, deletedAt: null },
      select: { ventaId: true },
    });

    if (!existing) {
      throw new ActionError('Venta no encontrada', 'NOT_FOUND');
    }

    return prisma.venta.update({
      where: { ventaId },
      data,
      select: VENTA_SELECT,
    });
  },

  /**
   * @description Anula una venta aplicando la reversión según su estado del ciclo
   * de vida (PEDIDO sin efectos; ENTREGADA/FACTURADA con reversión completa).
   * Delega en VentaLifecycleService.anularVentaPorEstado (PVE).
   */
  async cancel({
    input,
    user,
  }: {
    input: AnularVentaInput;
    user: AuthenticatedUser;
  }) {
    return VentaLifecycleService.anularVentaPorEstado({
      ventaId: input.ventaId,
      motivo: input.motivo,
      user,
    });
  },
};
