import { NextRequest } from "next/server"
import { toggleScheduledReportById } from "@/features/contabilidad/api/exchange-handlers"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return toggleScheduledReportById(request, { params }) }
