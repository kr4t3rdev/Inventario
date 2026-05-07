import { NextRequest } from "next/server"
import { getTasasHistorial } from "@/features/contabilidad/api/exchange-handlers"

export async function GET(request: NextRequest) { return getTasasHistorial(request) }
