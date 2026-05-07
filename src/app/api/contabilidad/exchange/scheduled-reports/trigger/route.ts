import { NextRequest } from "next/server"
import { triggerScheduledReports } from "@/features/contabilidad/api/exchange-handlers"

export async function POST(request: NextRequest) { return triggerScheduledReports(request) }
