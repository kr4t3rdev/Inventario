import { NextRequest } from "next/server"
import { getDebtExposure } from "@/features/contabilidad/api/exchange-handlers"

export async function GET(request: NextRequest) { return getDebtExposure(request) }
