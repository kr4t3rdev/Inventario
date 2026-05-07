import { NextRequest } from "next/server"
import { simulateScenario } from "@/features/contabilidad/api/exchange-handlers"

export async function POST(request: NextRequest) { return simulateScenario(request) }
