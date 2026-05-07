import { NextRequest } from "next/server"
import { getPaymentEfficiency } from "@/features/contabilidad/api/exchange-handlers"

export async function GET(request: NextRequest) { return getPaymentEfficiency(request) }
