import { NextRequest } from "next/server"
import { getScheduledReportById, patchScheduledReportById, deleteScheduledReportById } from "@/features/contabilidad/api/exchange-handlers"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return getScheduledReportById(request, { params }) }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return patchScheduledReportById(request, { params }) }
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return deleteScheduledReportById(request, { params }) }
