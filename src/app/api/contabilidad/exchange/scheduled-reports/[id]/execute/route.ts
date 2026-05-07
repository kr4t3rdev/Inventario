import { NextRequest } from "next/server"
import { executeScheduledReportById } from "@/features/contabilidad/api/exchange-handlers"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return executeScheduledReportById(request, { params }) }
