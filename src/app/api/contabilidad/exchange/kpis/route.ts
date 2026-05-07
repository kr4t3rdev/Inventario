import { NextRequest } from "next/server"
import { getKpis } from "@/features/contabilidad/api/exchange-handlers"

export async function GET(request: NextRequest) { return getKpis(request) }
