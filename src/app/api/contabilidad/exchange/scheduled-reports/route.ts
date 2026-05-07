import { NextRequest } from "next/server"
import { getScheduledReports, createScheduledReport } from "@/features/contabilidad/api/exchange-handlers"

export async function GET(request: NextRequest) { return getScheduledReports(request) }
export async function POST(request: NextRequest) { return createScheduledReport(request) }
