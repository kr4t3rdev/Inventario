import { NextRequest } from "next/server"
import { getScenarios, createScenario } from "@/features/contabilidad/api/exchange-handlers"

export async function GET(request: NextRequest) { return getScenarios(request) }
export async function POST(request: NextRequest) { return createScenario(request) }
