import { NextRequest } from "next/server"
import { getScenarioById, patchScenarioById, deleteScenarioById } from "@/features/contabilidad/api/exchange-handlers"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return getScenarioById(request, { params }) }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return patchScenarioById(request, { params }) }
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return deleteScenarioById(request, { params }) }
