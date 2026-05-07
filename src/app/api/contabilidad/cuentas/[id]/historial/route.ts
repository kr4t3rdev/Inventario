import { NextRequest, NextResponse } from "next/server"
import { getCuentaHistorialHandler } from "@/features/contabilidad/api/handlers"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return getCuentaHistorialHandler(request, { params })
}
