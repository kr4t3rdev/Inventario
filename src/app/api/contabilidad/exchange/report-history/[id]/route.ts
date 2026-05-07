import { NextRequest } from "next/server"
import { getReportHistoryById, deleteReportHistoryById } from "@/features/contabilidad/api/exchange-handlers"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return getReportHistoryById(request, { params }) }
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return deleteReportHistoryById(request, { params }) }
