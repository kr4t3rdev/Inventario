import { NextResponse, type NextRequest } from 'next/server';

import { type AuthenticatedUser, withAuthGet } from '@/lib/auth-middleware';
import { requireFeature } from '@/lib/services/tenant-scope';
import { getFormalFinancialReport } from '@/features/contabilidad-formal/services/formal-financial-report-service';
import { formalReportToCsv } from '@/features/contabilidad-formal/services/formal-report-csv';

/** Feature de licencia que habilita la contabilidad formal. */
const FEATURE = 'contabilidad-formal';

/**
 * @description Exporta el reporte contable formal de un período en CSV.
 *
 * El exportador solo publica el reporte cuando la cobertura está acreditada:
 * si el reporte no está disponible responde con la causa y no incluye
 * importes parciales.
 *
 * @param {NextRequest} request - Solicitud con el parámetro `periodoId`.
 * @param {unknown} _context - Contexto de la ruta, no utilizado.
 * @param {AuthenticatedUser} user - Usuario autenticado con su tenant.
 * @returns {Promise<Response>} Archivo CSV o error con la causa.
 */
export const GET = withAuthGet(
	async (request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
		if (!user.tenantId) {
			return NextResponse.json(
				{ error: 'Selecciona una empresa para consultar el reporte formal' },
				{ status: 403 },
			);
		}

		try {
			requireFeature(user, FEATURE, 'consultar el reporte contable formal');
		} catch {
			return NextResponse.json(
				{ error: 'Tu plan actual no incluye el reporte contable formal', code: 'FEATURE_NOT_AVAILABLE' },
				{ status: 403 },
			);
		}

		const periodoId = request.nextUrl.searchParams.get('periodoId')?.trim();
		if (!periodoId) {
			return NextResponse.json(
				{ error: 'Indica el período contable del reporte formal', code: 'PERIODO_REQUERIDO' },
				{ status: 400 },
			);
		}

		try {
			const reporte = await getFormalFinancialReport({ tenantId: user.tenantId, periodoId });
			if (reporte.status !== 'AVAILABLE') {
				return NextResponse.json(
					{ status: 'UNAVAILABLE', reason: reporte.reason, periodoId: reporte.periodoId },
					{ status: 409 },
				);
			}

			return new NextResponse(formalReportToCsv(reporte), {
				headers: {
					'Content-Type': 'text/csv; charset=utf-8',
					'Content-Disposition': `attachment; filename="reporte-formal-${reporte.periodoId}.csv"`,
				},
			});
		} catch (error) {
			console.error('Error al exportar el reporte contable formal:', error);
			return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
		}
	},
);
