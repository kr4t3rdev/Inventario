/**
 * @description Tests unitarios para el wrapper withAction() de Server Actions.
 * Sigue TDD estricto: RED → GREEN → REFACTOR.
 *
 * Escenarios cubiertos:
 * 1. Éxito: action completa → { success: true, data }
 * 2. No auth: getCurrentUser retorna null → AUTH_REQUIRED
 * 3. ZodError: validation errors → VALIDATION_ERROR con field errors
 * 4. PrismaClientKnownRequestError: errores de BD → mensaje y código
 * 5. PrismaClientValidatonError: error de validación de Prisma
 * 6. Error genérico: error desconocido → INTERNAL_ERROR
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ZodError, z } from 'zod';
import { Prisma } from '@/generated/prisma';

// Mockeamos getCurrentUser ANTES de importar withAction
vi.mock('@/lib/server-actions/get-current-user');

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { withAction } from '@/lib/server-actions/with-action';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// ─── Helpers ───────────────────────────────────────────────

const mockUser: AuthenticatedUser = {
  userId: 'user-test-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-test-1',
  tenantRole: 'admin',
};

/** Crea un ZodError con field errors específicos para testing */
function makeZodError(): ZodError {
  try {
    z.object({
      nombre: z.string().min(3, 'Mínimo 3 caracteres'),
      precio: z.number().positive('Debe ser positivo'),
    }).parse({ nombre: 'AB', precio: -5 });
    throw new Error('Zod debería haber lanzado');
  } catch (e) {
    return e as ZodError;
  }
}

/** Crea un PrismaClientKnownRequestError para testing */
function makePrismaKnownError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError(
    `Prisma error: ${code}`,
    {
      code,
      clientVersion: '5.0.0',
      meta,
      batchRequestIdx: undefined,
    }
  );
}

// ─── Tests ─────────────────────────────────────────────────

describe('withAction()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Éxito ──────────────────────────────────────

  describe('cuando la acción tiene éxito', () => {
    it('retorna { success: true, data } con el resultado de la acción', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const wrapped = withAction(async (input: string, user) => {
        return { mensaje: input, userId: user.userId };
      });

      const result = await wrapped('hola');

      expect(result).toEqual({
        success: true,
        data: { mensaje: 'hola', userId: 'user-test-1' },
      });
    });

    it('llama a getCurrentUser y pasa el usuario a la acción interna', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      let capturedUser: AuthenticatedUser | undefined;
      const wrapped = withAction(async (_input: void, user) => {
        capturedUser = user;
        return 'ok';
      });

      await wrapped();

      expect(getCurrentUser).toHaveBeenCalledTimes(1);
      expect(capturedUser).toEqual(mockUser);
    });
  });

  // ─── No auth ───────────────────────────────────

  describe('cuando no hay usuario autenticado', () => {
    it('retorna { success: false, error: AUTH_REQUIRED }', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const wrapped = withAction(async () => 'no debería ejecutarse');

      const result = await wrapped(undefined);

      expect(result).toEqual({
        success: false,
        error: {
          message: 'Unauthorized',
          code: 'AUTH_REQUIRED',
        },
      });
    });

    it('NO ejecuta la acción interna si no hay usuario', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const innerAction = vi.fn().mockResolvedValue('nope');
      const wrapped = withAction(innerAction);

      await wrapped(undefined);

      expect(innerAction).not.toHaveBeenCalled();
    });
  });

  // ─── ZodError ──────────────────────────────────

  describe('cuando la acción interna lanza ZodError', () => {
    it('retorna { success: false, error: VALIDATION_ERROR con details }', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const wrapped = withAction(async () => {
        throw makeZodError();
      });

      const result = await wrapped(undefined);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('VALIDATION_ERROR');
      expect(result.error!.message).toBeDefined();
      expect(result.error!.details).toBeDefined();
      // Debe contener los field errors de Zod
      expect(result.error!.details).toHaveProperty('nombre');
      expect(result.error!.details).toHaveProperty('precio');
    });

    it('NO deja propagar el ZodError como excepción', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const wrapped = withAction(async () => {
        throw makeZodError();
      });

      // No debe lanzar excepción
      await expect(wrapped(undefined)).resolves.toBeDefined();
    });
  });

  // ─── PrismaClientKnownRequestError ─────────────

  describe('cuando la acción interna lanza PrismaClientKnownRequestError', () => {
    it('retorna mensaje amigable para error P2002 (unique constraint)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const wrapped = withAction(async () => {
        throw makePrismaKnownError('P2002', { target: ['nombre'] });
      });

      const result = await wrapped(undefined);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('P2002');
      expect(result.error!.message).toContain('Ya existe');
    });

    it('retorna mensaje amigable para error P2025 (record not found)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const wrapped = withAction(async () => {
        throw makePrismaKnownError('P2025');
      });

      const result = await wrapped(undefined);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('P2025');
      expect(result.error!.message).toContain('no fue encontrado');
    });

    it('retorna mensaje genérico para códigos desconocidos', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const wrapped = withAction(async () => {
        throw makePrismaKnownError('P9999');
      });

      const result = await wrapped(undefined);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('P9999');
      expect(result.error!.message).toBeDefined();
    });
  });

  // ─── PrismaClientValidationError ───────────────

  describe('cuando la acción interna lanza PrismaClientValidationError', () => {
    it('retorna error de validación de base de datos con código específico', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      // PrismaClientValidationError constructor: (message, clientVersion)
      const wrapped = withAction(async () => {
        throw new Prisma.PrismaClientValidationError(
          'Invalid value for field "precio": expected number, got string',
          '5.0.0'
        );
      });

      const result = await wrapped(undefined);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('PRISMA_VALIDATION_ERROR');
      expect(result.error!.message).toContain('validación');
    });
  });

  // ─── Error genérico ────────────────────────────

  describe('cuando la acción interna lanza un error desconocido', () => {
    it('retorna { success: false, error: INTERNAL_ERROR }', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const wrapped = withAction(async () => {
        throw new Error('Algo explotó inesperadamente');
      });

      const result = await wrapped(undefined);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('INTERNAL_ERROR');
      expect(result.error!.message).toBeDefined();
    });

    it('NO expone el mensaje del error original al cliente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const wrapped = withAction(async () => {
        throw new Error('SECRETO: password=12345');
      });

      const result = await wrapped(undefined);

      expect(result.error!.message).not.toContain('SECRETO');
      expect(result.error!.message).not.toContain('12345');
    });
  });

  // ─── Tipos genéricos ───────────────────────────

  describe('con tipado genérico', () => {
    it('preserva el tipo de input y output correctamente', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      interface CrearInput {
        nombre: string;
        precio: number;
      }
      interface CrearOutput {
        id: string;
        nombre: string;
      }

      const wrapped = withAction(async (input: CrearInput, _user) => {
        const output: CrearOutput = {
          id: '123',
          nombre: input.nombre,
        };
        return output;
      });

      const result = await wrapped({ nombre: 'Test', precio: 100 });

      if (result.success) {
        // TypeScript debe inferir que data es CrearOutput
        const data: CrearOutput = result.data;
        expect(data.nombre).toBe('Test');
      }
    });
  });
});
