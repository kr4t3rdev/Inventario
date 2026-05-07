import { NextRequest } from "next/server"
import { exportData, getExportStatus } from "@/features/contabilidad/api/exchange-handlers"

export async function POST(request: NextRequest) { return exportData(request) }
export async function GET() { return getExportStatus() }
