import { NextRequest } from "next/server"
import { getPerformance, headPerformance } from "@/features/contabilidad/api/exchange-handlers"

export async function GET(request: NextRequest) { return getPerformance(request) }
export async function HEAD() { return headPerformance() }
