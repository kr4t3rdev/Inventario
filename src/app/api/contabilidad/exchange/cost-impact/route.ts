import { NextRequest } from "next/server"
import { getCostImpact } from "@/features/contabilidad/api/exchange-handlers"

export async function GET(request: NextRequest) { return getCostImpact(request) }
