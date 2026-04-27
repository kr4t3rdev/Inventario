import {
  generarEventoSeed,
  generarLineasDoblePartida,
  type EventoContableSeed,
  type OrigenTipo,
} from '@/lib/services/evento-contable-service';
import { enriquecerEventoConCuentas } from '@/lib/services/evento-contable-mapping-service';
import { resolvePeriodosFromFecha } from '@/lib/services/periodo-resolver-service';

interface RegistrarEventoParams {
  origenTipo: OrigenTipo;
  origenId: string;
  monto: number;
  montoConvertido?: number;
  moneda?: string;
  fechaOperacion?: Date;
  descripcion?: string;
  metadataJson?: Record<string, unknown>;
  usuarioId: string;
}

/**
 * @description Registra un evento contable de forma no-bloqueante. Si el runtime Prisma aún no soporta
 * el modelo EventoContable, no interrumpe la operación principal.
 * @param {RegistrarEventoParams} params - Datos del evento a registrar.
 * @returns {Promise<boolean>} true si se registró, false si se degradó silenciosamente.
 */
export async function registrarEventoContable(params: RegistrarEventoParams): Promise<boolean> {
  try {
    const { default: prisma } = await import('@/lib/prisma');
    const client = prisma as unknown as Record<string, unknown>;
    const eventoContable = client.eventoContable as
      | { create: (args: Record<string, unknown>) => Promise<unknown> }
      | undefined;

    if (!eventoContable?.create) {
      return false;
    }

    const seed = generarEventoSeed(enriquecerEventoConCuentas({
      fechaOperacion: params.fechaOperacion ?? new Date(),
      origenTipo: params.origenTipo,
      origenId: params.origenId,
      monto: params.monto,
      montoConvertido: params.montoConvertido,
      moneda: params.moneda,
      descripcion: params.descripcion,
      metadataJson: params.metadataJson,
    } as EventoContableSeed));

    const resolved = await resolvePeriodosFromFecha(seed.fechaOperacion);

    const lineas = generarLineasDoblePartida(seed, (seed as Record<string, string>).cuentaContraria ?? 'RESULTADO_ACUMULADO');

    const totalDebito = lineas.reduce((s, l) => s + l.debito, 0);
    const totalCredito = lineas.reduce((s, l) => s + l.credito, 0);

    if (Math.abs(totalDebito - totalCredito) > 0.01) {
      console.warn(
        `[EventoContable] Asiento desbalanceado para ${params.origenTipo}/${params.origenId}: debito=${totalDebito} credito=${totalCredito}. Evento no persistido.`
      );
      return false;
    }

    const lineasData = lineas.map((l) => ({
      cuenta: l.cuenta,
      descripcion: l.descripcion ?? null,
      debito: l.debito,
      credito: l.credito,
      moneda: l.moneda ?? seed.moneda ?? 'CUP',
    }));

    await eventoContable.create({
      data: {
        fechaOperacion: seed.fechaOperacion,
        origenTipo: seed.origenTipo,
        origenId: seed.origenId,
        criterio: seed.criterio,
        naturaleza: seed.naturaleza,
        monto: seed.monto,
        montoConvertido: seed.montoConvertido ?? null,
        moneda: seed.moneda ?? 'CUP',
        periodoDiarioId: resolved.periodoDiarioId,
        periodoMensualId: resolved.periodoMensualId,
        periodoAnualId: resolved.periodoAnualId,
        estado: 'CONFIRMADO',
        descripcion: seed.descripcion ?? null,
        metadataJson: seed.metadataJson ?? null,
        lineas: {
          create: lineasData,
        },
      } as Record<string, unknown>,
    });

    return true;
  } catch (error) {
    console.warn(
      `[EventoContable] No se pudo persistir evento para ${params.origenTipo}/${params.origenId}:`,
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}