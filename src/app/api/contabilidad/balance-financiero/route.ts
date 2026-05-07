import { type NextRequest } from "next/server"
import { withAuthGet } from "@/lib/auth-middleware"
import { getBalanceFinanciero } from "@/features/contabilidad/api/exchange-handlers"

export const GET = withAuthGet(async (request: NextRequest) => getBalanceFinanciero(request))
