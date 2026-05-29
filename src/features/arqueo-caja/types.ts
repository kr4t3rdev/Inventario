/**
 * @description Tipos para la feature de Arqueo de Caja.
 */
import type {
  ArqueoCaja as PrismaArqueoCaja,
  TurnoPuntoVenta as PrismaTurnoPuntoVenta,
} from '@/generated/prisma';

export type ArqueoCaja = PrismaArqueoCaja;

export type TurnoPuntoVentaWithRelations = PrismaTurnoPuntoVenta & {
  puntoDeVenta: { pvId: string; nombre: string } | null;
  empleado: { empleadoId: string; nombre: string; apellido: string } | null;
};

export type ArqueoCajaWithRelations = PrismaArqueoCaja & {
  turno: TurnoPuntoVentaWithRelations | null;
};

export interface EsperadosArqueo {
  esperadoEfectivoCup: number
  esperadoEfectivoUsd: number
  esperadoTarjeta: number
  esperadoTransferencia: number
  esperadoCredito: number
  fondoInicialCup: number
  fondoInicialUsd: number
  ventasEfectivoCup: number
  ventasEfectivoUsd: number
}
