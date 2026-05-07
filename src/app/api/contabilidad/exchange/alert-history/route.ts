import { NextRequest } from "next/server"
import { getAlertHistory, createAlertHistory } from "@/features/contabilidad/api/exchange-handlers"

export async function GET(request: NextRequest) { return getAlertHistory(request) }
export async function POST(request: NextRequest) { return createAlertHistory(request) }
