/**
 * @description Tests del envoltorio de reintentos de transacción del cupo
 * (tarea 4.4.b.5.c): reintenta la transacción completa ante conflictos de
 * serialización (P2034) o deadlock de PostgreSQL (40P01) con jitter, y falla
 * cerrado con CREDITO_CONFLICTO al agotar los intentos. Errores de dominio
 * (CREDITO_EXCEDIDO, etc.) se propagan sin reintento.
 */
import { describe, expect, it, vi } from 'vitest';
import { conReintentosCredito, esConflictoTransaccional } from '@/features/ventas/services/credito-retry';
import { ActionError } from '@/lib/server-actions';

/** Error con shape Prisma P2034. */
function errorP2034(): { code: string; message: string; clientVersion: string } {
  return {
    code: 'P2034',
    message: 'Transaction conflict or write conflict',
    clientVersion: 'test',
  };
}

/** Error con causa de deadlock PostgreSQL 40P01. */
function errorDeadlock(): Error {
  const error = new Error('Server error: deadlock detected');
  (error as unknown as { cause?: { code?: string } }).cause = { code: '40P01' };
  return error;
}

describe('conReintentosCredito: transacción completa con retries', () => {
  it('reintenta P2034 y confirma cuando un intento posterior tiene éxito', async () => {
    let intentos = 0;
    const resultado = await conReintentosCredito(async () => {
      intentos += 1;
      if (intentos < 3) throw errorP2034();
      return 'ok';
    });

    expect(resultado).toBe('ok');
    expect(intentos).toBe(3);
  });

  it('reintenta deadlock de PostgreSQL (causa 40P01) igual que P2034', async () => {
    let intentos = 0;
    const resultado = await conReintentosCredito(async () => {
      intentos += 1;
      if (intentos === 1) throw errorDeadlock();
      return 'recuperado';
    });

    expect(resultado).toBe('recuperado');
    expect(intentos).toBe(2);
  });

  it('falla cerrado con CREDITO_CONFLICTO al agotar los intentos', async () => {
    let intentos = 0;
    await expect(
      conReintentosCredito(async () => {
        intentos += 1;
        throw errorP2034();
      }),
    ).rejects.toMatchObject({ code: 'CREDITO_CONFLICTO' });
    expect(intentos).toBe(3);
  });

  it('propaga errores de dominio sin gastar reintentos', async () => {
    let intentos = 0;
    const operacion = async () => {
      intentos += 1;
      throw new ActionError('La operación supera el límite', 'CREDITO_EXCEDIDO');
    };

    await expect(conReintentosCredito(operacion))
      .rejects.toMatchObject({ code: 'CREDITO_EXCEDIDO' });
    expect(intentos).toBe(1);
  });

  it('esConflictoTransaccional discrimina P2034, 40P01 y mensaje de deadlock', () => {
    expect(esConflictoTransaccional(errorP2034() as never)).toBe(true);
    expect(esConflictoTransaccional(errorDeadlock() as never)).toBe(true);
    expect(esConflictoTransaccional(new Error('deadlock detected in session'))).toBe(true);
    expect(esConflictoTransaccional(new ActionError('otro', 'VALIDATION_ERROR'))).toBe(false);
  });

  it('el jitter no bloquea: los reintentos aplican backoff corto', async () => {
    const timers = vi.spyOn(globalThis, 'setTimeout');
    let intentos = 0;
    await conReintentosCredito(async () => {
      intentos += 1;
      if (intentos < 2) throw errorP2034();
      return 'ok';
    }, { maxIntentos: 2 });

    expect(intentos).toBe(2);
    // Un solo backoff entre el primer y el segundo intento.
    expect(timers).toHaveBeenCalledTimes(1);
    timers.mockRestore();
  });
});
