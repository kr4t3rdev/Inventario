import { NextRequest } from "next/server"
import { getMonedas, createMoneda } from "@/features/contabilidad/api/exchange-handlers"

export async function GET() { return getMonedas() }
export async function POST(request: NextRequest) { return createMoneda(request) }
