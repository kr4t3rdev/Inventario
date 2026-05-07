import { NextRequest, NextResponse } from "next/server";
import { getCuentasHandler, createCuentaHandler } from "@/features/contabilidad/api/handlers";

export async function GET() {
  return getCuentasHandler();
}

export async function POST(request: NextRequest) {
  return createCuentaHandler(request);
}
