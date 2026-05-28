/**
 * @description Tipos para la feature de Arqueo de Caja.
 */
import type {
  ArqueoCaja as PrismaArqueoCaja,
} from '@/generated/prisma';

export type ArqueoCaja = PrismaArqueoCaja;

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
