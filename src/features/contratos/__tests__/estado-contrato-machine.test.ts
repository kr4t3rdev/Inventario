/**
 * @description Tests unitarios de la máquina de estados de contratos (CTF-1).
 *              Núcleo puro: sin Prisma, sin tenant; tabla completa de transiciones
 *              del design §1.1 (openspec/changes/contratos-fase-2).
 */
import { describe, it, expect } from 'vitest';
import {
  ESTADOS_BULK,
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

describe('menú masivo de la UI (B-1)', () => {
  it('todo estado no terminal tiene al menos una opción válida en el menú derivado', () => {
    // B-1: el menú de la UI se deriva de ESTADOS_BULK; ningún estado no
    // terminal puede quedar atrapado (BORRADOR llegó a quedarlo con el menú
    // fijo anterior).
    for (const desde of ESTADOS_BULK) {
      if (ESTADOS_TERMINALES.includes(desde)) continue;
      const opcionesValidas = ESTADOS_BULK.filter((hacia) => puedeTransicionar(desde, hacia));
      expect(opcionesValidas.length, `el estado ${desde} quedaría atrapado con el menú derivado`).toBeGreaterThan(0);
    }
  });

  it('el menú incluye PENDIENTE_APROBACION para avanzar borradores', () => {
    expect(ESTADOS_BULK).toContain('PENDIENTE_APROBACION');
    expect(puedeTransicionar('BORRADOR', 'PENDIENTE_APROBACION')).toBe(true);
  });
});
