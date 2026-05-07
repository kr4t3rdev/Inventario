import { NextRequest } from "next/server"
import { patchAlertHistoryById, deleteAlertHistoryById } from "@/features/contabilidad/api/exchange-handlers"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return patchAlertHistoryById(request, { params }) }
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return deleteAlertHistoryById(request, { params }) }
