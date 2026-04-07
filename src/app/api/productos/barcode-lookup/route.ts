import { NextRequest, NextResponse } from 'next/server';

import { withAuthGet } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

/**
 * @description Valida que el código tenga el formato correcto (13 dígitos o 11 para código interno)
 * @param {string} code - El código a validar
 * @returns {boolean} True si el formato es válido
 */
function isValidBarcodeFormat(code: string): boolean {
  // Remove whitespace
  const cleanCode = code.trim();

  // Check if it's a valid 13-digit EAN or 11-digit internal code
  return /^\d{13}$/.test(cleanCode) || /^\d{11}$/.test(cleanCode);
}

/**
 * @description GET /api/productos/barcode-lookup - Busca un producto por código de barras (EAN-13 o código interno)
 * @param {NextRequest} request - La solicitud HTTP
 * @returns {Promise<NextResponse>} Respuesta JSON con el producto encontrado o { found: false }
 */
async function GET(request: NextRequest) {
  return withAuthGet(async () => {
    try {
      // Get code from query parameters
      const { searchParams } = new URL(request.url);
      const code = searchParams.get('code');

      // Validate that code is provided
      if (!code) {
        return NextResponse.json(
          { error: 'El parámetro "code" es requerido' },
          { status: 400 }
        );
      }

      // Validate barcode format
      if (!isValidBarcodeFormat(code)) {
        return NextResponse.json(
          { error: 'Formato de código inválido. Debe ser 13 dígitos (EAN-13) o 11 dígitos (código interno)' },
          { status: 400 }
        );
      }

      const cleanCode = code.trim();

      // Try to find product by codigoNegocio first (fast path - indexed)
      let producto = await prisma.producto.findUnique({
        where: { codigoNegocio: cleanCode },
        select: {
          id: true,
          nombre: true,
          codigoNegocio: true,
          proveedorCodigo: true,
          precioCosto: true,
          precioVenta: true,
          stock: true,
          categoriaId: true,
          stockMinimo: true,
        },
      });

      // If not found, try codigoInterno (fallback)
      if (!producto && /^\d{11}$/.test(cleanCode)) {
        // Search by internal code
        producto = await prisma.producto.findFirst({
          where: {
            proveedorCodigo: cleanCode,
          },
          select: {
            id: true,
            nombre: true,
            codigoNegocio: true,
            proveedorCodigo: true,
            precioCosto: true,
            precioVenta: true,
            stock: true,
            categoriaId: true,
            stockMinimo: true,
          },
        });
      }

      // Return result
      if (producto) {
        return NextResponse.json(
          {
            found: true,
            product: producto,
          },
          { status: 200 }
        );
      } else {
        return NextResponse.json(
          {
            found: false,
          },
          { status: 200 }
        );
      }
    } catch (error) {
      console.error('[barcode-lookup] Error:', error);
      return NextResponse.json(
        { error: 'Error interno del servidor' },
        { status: 500 }
      );
    }
  })(request);
}

export { GET };
