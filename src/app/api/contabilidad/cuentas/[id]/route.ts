import { NextRequest, NextResponse } from "next/server";
import { getCuentaByIdHandler, updateCuentaHandler, deleteCuentaHandler } from "@/features/contabilidad/api/handlers";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getCuentaByIdHandler(req, id);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return updateCuentaHandler(request, id);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return deleteCuentaHandler(request, id);
}
