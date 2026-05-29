import { NextRequest, NextResponse } from "next/server";
import { verificarStockBajo } from "@/lib/verificar-stock";

// Forzar ejecución dinámica (no cachear respuesta de cron)
export const dynamic = "force-dynamic";

/**
 * @description Endpoint para verificar stock bajo y sin stock.
 * Diseñado para ser llamado por un scheduler/cron (cualquier método HTTP).
 *
 * Seguridad: requiere API key en header `x-api-key` o query param `apiKey`.
 * La key se configura via env `CRON_API_KEY`.
 *
 * GET /api/inventario/verificar-stock?apiKey=xxx&tenantId=xxx&dryRun=true
 */
export async function GET(request: NextRequest) {
	return handleVerificarStock(request);
}

export async function POST(request: NextRequest) {
	return handleVerificarStock(request);
}

async function handleVerificarStock(
	request: NextRequest,
): Promise<NextResponse> {
	const cronApiKey = process.env.CRON_API_KEY;
	const url = new URL(request.url);
	const apiKey =
		url.searchParams.get("apiKey") || request.headers.get("x-api-key");

	// Validar API key si está configurada
	if (cronApiKey && apiKey !== cronApiKey) {
		return NextResponse.json({ error: "No autorizado" }, { status: 401 });
	}

	try {
		const tenantId = url.searchParams.get("tenantId") || undefined;
		const dryRun = url.searchParams.get("dryRun") === "true";

		const resultado = await verificarStockBajo({ tenantId, dryRun });

		return NextResponse.json({
			success: true,
			...resultado,
			mensaje: dryRun
				? `Dry run: ${resultado.productosStockBajo} bajo stock, ${resultado.productosSinStock} sin stock`
				: `Verificación completada: ${resultado.productosStockBajo} bajo stock, ${resultado.productosSinStock} sin stock, ${resultado.notificacionesCreadas} notificaciones`,
		});
	} catch (error) {
		console.error("[api/verificar-stock] Error:", error);
		return NextResponse.json(
			{ error: "Error interno del servidor" },
			{ status: 500 },
		);
	}
}
