import { NextRequest } from "next/server"
import { convertCurrency } from "@/features/contabilidad/api/exchange-handlers"

export async function POST(request: NextRequest) { return convertCurrency(request) }
