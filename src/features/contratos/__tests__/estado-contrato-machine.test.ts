/**
 * @description Tests unitarios de la máquina de estados de contratos (CTF-1).
 *              Núcleo puro: sin Prisma, sin tenant; tabla completa de transiciones
 *              del design §1.1 (openspec/changes/contratos-fase-2).
 */
import { describe, it, expect } from 'vitest';
import {
  TRANSICIONES_VALIDAS,
  ESTADOS_TERMINALES,
  puedeTransicionar,
  assertTransicionValida,
} from '../lib/estado-contrato-machine';
import { ActionError } from '@/lib/server-actions';

type Estado =
  | 'BORRADOR'
  | 'PENDIENTE_APROBACION'
  | 'APROBADO'
  | 'RECHAZADO'
  | 'ACTIVO'
  | 'FINALIZADO'
  | 'ANULADO';

const TODOS: Estado[] = [
  'BORRADOR',
  'PENDIENTE_APROBACION',
  'APROBADO',
  'RECHAZADO',
  'ACTIVO',
  'FINALIZADO',
  'ANULADO',
];

const VALIDAS: Array<[Estado, Estado]> = [
  ['BORRADOR', 'PENDIENTE_APROBACION'],
  ['BORRADOR', 'ANULADO'],
  ['PENDIENTE_APROBACION', 'APROBADO'],
  ['PENDIENTE_APROBACION', 'RECHAZADO'],
  ['PENDIENTE_APROBACION', 'ANULADO'],
  ['RECHAZADO', 'BORRADOR'],
  ['RECHAZADO', 'ANULADO'],
  ['APROBADO', 'ACTIVO'],
  ['APROBADO', 'ANULADO'],
  ['ACTIVO', 'FINALIZADO'],
  ['ACTIVO', 'ANULADO'],
];

describe('máquina de estados de contratos', () => {
  it('declara exactamente la tabla de transiciones del design §1.1', () => {
    expect(TRANSICIONES_VALIDAS).toEqual({
      BORRADOR: ['PENDIENTE_APROBACION', 'ANULADO'],
      PENDIENTE_APROBACION: ['APROBADO', 'RECHAZADO', 'ANULADO'],
      RECHAZADO: ['BORRADOR', 'ANULADO'],
      APROBADO: ['ACTIVO', 'ANULADO'],
      ACTIVO: ['FINALIZADO', 'ANULADO'],
      FINALIZADO: [],
      ANULADO: [],
    });
  });

  it('marca FINALIZADO y ANULADO como estados terminales', () => {
    expect(ESTADOS_TERMINALES).toEqual(['FINALIZADO', 'ANULADO']);
  });

  it.each(VALIDAS)('permite la transición %s → %s', (desde, hacia) => {
    expect(puedeTransicionar(desde, hacia)).toBe(true);
    expect(() => assertTransicionValida(desde, hacia)).not.toThrow();
  });

  it.each(TODOS)('no permite la auto-transición de %s', (estado) => {
    expect(puedeTransicionar(estado, estado)).toBe(false);
    expect(() => assertTransicionValida(estado, estado)).toThrow(ActionError);
  });

  it('no permite ninguna transición saliente de un estado terminal', () => {
    for (const desde of ['FINALIZADO', 'ANULADO'] as Estado[]) {
      for (const hacia of TODOS) {
        if (hacia === desde) continue;
        expect(puedeTransicionar(desde, hacia), `${desde} → ${hacia}`).toBe(false);
      }
    }
  });

  it('rechaza una transición inválida con ActionError y código TRANSICION_INVALIDA', () => {
    let capturado: unknown;
    try {
      assertTransicionValida('BORRADOR', 'ACTIVO');
    } catch (error) {
      capturado = error;
    }
    expect(capturado).toBeInstanceOf(ActionError);
    const error = capturado as ActionError;
    expect(error.code).toBe('TRANSICION_INVALIDA');
    expect(error.message).toContain('BORRADOR');
    expect(error.message).toContain('ACTIVO');
  });

  it.each([
    ['BORRADOR', 'ACTIVO'],
    ['BORRADOR', 'APROBADO'],
    ['RECHAZADO', 'ACTIVO'],
    ['ACTIVO', 'BORRADOR'],
    ['ACTIVO', 'PENDIENTE_APROBACION'],
    ['PENDIENTE_APROBACION', 'FINALIZADO'],
    ['APROBADO', 'RECHAZADO'],
    ['APROBADO', 'BORRADOR'],
  ] as Array<[Estado, Estado]>)('bloquea la transición inválida %s → %s', (desde, hacia) => {
    expect(puedeTransicionar(desde, hacia)).toBe(false);
    expect(() => assertTransicionValida(desde, hacia)).toThrow(ActionError);
  });
});
