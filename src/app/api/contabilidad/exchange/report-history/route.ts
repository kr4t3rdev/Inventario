import { NextRequest } from "next/server"
import { getReportHistory, createReportHistory } from "@/features/contabilidad/api/exchange-handlers"

export async function GET(request: NextRequest) { return getReportHistory(request) }
export async function POST(request: NextRequest) { return createReportHistory(request) }
