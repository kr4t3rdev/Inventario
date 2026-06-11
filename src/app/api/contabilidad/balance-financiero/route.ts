import { type NextRequest } from "next/server"
import { withAuthGet, type AuthenticatedUser } from "@/lib/auth-middleware"
import { getBalanceFinanciero } from "@/features/contabilidad/api/exchange-handlers"

export const GET = withAuthGet(async (request: NextRequest, _context: unknown, user: AuthenticatedUser) =>
	getBalanceFinanciero(request, user),
)
