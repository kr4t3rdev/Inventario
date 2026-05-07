import { NextRequest } from "next/server"
import { getTasas, createTasa } from "@/features/contabilidad/api/exchange-handlers"

export async function GET() { return getTasas() }
export async function POST(request: NextRequest) { return createTasa(request) }
