import { CuentaBancaria, TasaCambio, Moneda } from "../../../app/models/model"

// Cache configuration
export const CACHE_CONFIG = {
  EXCHANGE_RATES_TTL: 5 * 60 * 1000, // 5 minutes
  ACCOUNT_BALANCE_TTL: 2 * 60 * 1000, // 2 minutes
  PENDING_RECONCILIATIONS_TTL: 30 * 1000, // 30 seconds
  REPORTS_TTL: 10 * 60 * 1000, // 10 minutes
}

// Cache keys
export const CACHE_KEYS = {
  EXCHANGE_RATES: "contabilidad:exchange_rates",
  ACCOUNT_BALANCES: "contabilidad:account_balances",
  PENDING_RECONCILIATIONS: "contabilidad:pending_reconciliations",
  FINANCIAL_SUMMARY: "contabilidad:financial_summary",
}

// Utility functions for currency conversion
export const convertCurrency = (
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  exchangeRates: { [key: string]: number }
): number | null => {
  if (fromCurrency === toCurrency) {
    return amount
  }
  
  const rateKey = `${fromCurrency}_${toCurrency}`
  const rate = exchangeRates[rateKey]
  
  if (rate) {
    return amount * rate
  }
  
  // Try inverse rate
  const inverseRateKey = `${toCurrency}_${fromCurrency}`
  const inverseRate = exchangeRates[inverseRateKey]
  
  if (inverseRate) {
    return amount / inverseRate
  }
  
  return null
}

// Calculate total balance in main currency
export const calculateTotalBalanceInMainCurrency = (
  accounts: CuentaBancaria[],
  mainCurrency: string,
  exchangeRates: { [key: string]: number }
): number => {
  return accounts
    .filter(account => account.isActive)
    .reduce((total, account) => {
      const convertedAmount = convertCurrency(
        account.saldo,
        account.moneda,
        mainCurrency,
        exchangeRates
      )
      return total + (convertedAmount || 0)
    }, 0)
}

// Get latest exchange rate for a currency pair
export const getLatestExchangeRate = (
  fromCurrency: string,
  toCurrency: string,
  exchangeRates: TasaCambio[]
): number | null => {
  const relevantRates = exchangeRates
    .filter(rate => 
      rate.monedaOrigenId === fromCurrency && 
      rate.monedaDestino === toCurrency
    )
    .sort((a, b) => 
      new Date(b.fechaVigencia).getTime() - new Date(a.fechaVigencia).getTime()
    )
  
  return relevantRates.length > 0 ? relevantRates[0].tasa : null
}

// Format currency amount
export const formatCurrency = (
  amount: number,
  currency: string,
  currencies: Moneda[]
): string => {
  const currencyData = currencies.find(c => c.codigo === currency)
  const symbol = currencyData?.simbolo || currency
  
  return `${symbol} ${amount.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// Simple currency formatter without currency data lookup
export const formatCurrencySimple = (
  amount: number,
  currency: string
): string => {
  const symbols: Record<string, string> = {
    'CUP': '$',
    'USD': '$',
    'EUR': '€'
  }
  
  const symbol = symbols[currency] || currency
  
  return `${symbol} ${amount.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// Format date for display
export const formatDate = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  if (isNaN(dateObj.getTime())) {
    return 'Fecha inválida'
  }
  
  return dateObj.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Format date for display (short version)
export const formatDateShort = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  if (isNaN(dateObj.getTime())) {
    return 'Fecha inválida'
  }
  
  return dateObj.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

// Validate account balance for operations
export const validateAccountBalance = (
  account: CuentaBancaria,
  operationAmount: number,
  operationType: 'debit' | 'credit'
): { valid: boolean; message?: string } => {
  if (operationType === 'credit') {
    return { valid: true }
  }
  
  if (account.saldo < operationAmount) {
    return {
      valid: false,
      message: `Saldo insuficiente. Disponible: ${formatCurrency(account.saldo, account.moneda, [])}`,
    }
  }
  
  return { valid: true }
}

// Calculate exchange rate impact
export const calculateExchangeRateImpact = (
  amount: number,
  oldRate: number,
  newRate: number,
  fromCurrency: string,
  toCurrency: string
): {
  oldAmount: number
  newAmount: number
  difference: number
  percentageChange: number
} => {
  const oldAmount = amount * oldRate
  const newAmount = amount * newRate
  const difference = newAmount - oldAmount
  const percentageChange = ((newRate - oldRate) / oldRate) * 100
  
  return {
    oldAmount,
    newAmount,
    difference,
    percentageChange,
  }
}

// Group accounts by currency
export const groupAccountsByCurrency = (
  accounts: CuentaBancaria[]
): { [currency: string]: CuentaBancaria[] } => {
  return accounts.reduce((groups, account) => {
    if (!groups[account.moneda]) {
      groups[account.moneda] = []
    }
    groups[account.moneda].push(account)
    return groups
  }, {} as { [currency: string]: CuentaBancaria[] })
}

// Calculate account statistics
export const calculateAccountStatistics = (
  accounts: CuentaBancaria[]
): {
  totalAccounts: number
  activeAccounts: number
  inactiveAccounts: number
  currenciesUsed: string[]
  averageBalance: number
  totalBalance: number
} => {
  const activeAccounts = accounts.filter(a => a.isActive)
  const currenciesUsed = [...new Set(accounts.map(a => a.moneda))]
  const totalBalance = activeAccounts.reduce((sum, a) => sum + a.saldo, 0)
  
  return {
    totalAccounts: accounts.length,
    activeAccounts: activeAccounts.length,
    inactiveAccounts: accounts.length - activeAccounts.length,
    currenciesUsed,
    averageBalance: activeAccounts.length > 0 ? totalBalance / activeAccounts.length : 0,
    totalBalance,
  }
}

// Validate transfer between accounts
export const validateTransfer = (
  fromAccount: CuentaBancaria,
  toAccount: CuentaBancaria,
  amount: number,
  exchangeRate?: number
): { valid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  if (!fromAccount.isActive) {
    errors.push("La cuenta de origen no está activa")
  }
  
  if (!toAccount.isActive) {
    errors.push("La cuenta de destino no está activa")
  }
  
  if (fromAccount.cuentaId === toAccount.cuentaId) {
    errors.push("No se puede transferir a la misma cuenta")
  }
  
  if (amount <= 0) {
    errors.push("El monto debe ser mayor a cero")
  }
  
  if (fromAccount.saldo < amount) {
    errors.push("Saldo insuficiente en la cuenta de origen")
  }
  
  if (fromAccount.moneda !== toAccount.moneda && !exchangeRate) {
    errors.push("Se requiere tasa de cambio para transferencias entre diferentes monedas")
  }
  
  if (exchangeRate && exchangeRate <= 0) {
    errors.push("La tasa de cambio debe ser mayor a cero")
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

// Cache management utilities
export const isCacheExpired = (timestamp: number, ttl: number): boolean => {
  return Date.now() - timestamp > ttl
}

export const createCacheKey = (prefix: string, params: Record<string, any>): string => {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|')
  
  return `${prefix}:${sortedParams}`
}

// Error handling utilities
export const isNetworkError = (error: any): boolean => {
  return error?.status === 'FETCH_ERROR' || 
         error?.name === 'NetworkError' ||
         error?.message?.includes('fetch')
}

export const getErrorMessage = (error: any): string => {
  if (typeof error === 'string') {
    return error
  }
  
  if (error?.data?.message) {
    return error.data.message
  }
  
  if (error?.message) {
    return error.message
  }
  
  if (isNetworkError(error)) {
    return "Error de conexión. Verifique su conexión a internet."
  }
  
  return "Ha ocurrido un error inesperado"
}

// Retry logic for failed operations
export const createRetryConfig = (maxRetries: number = 3, baseDelay: number = 1000) => ({
  maxRetries,
  baseDelay,
  backoffMultiplier: 2,
  maxDelay: 10000,
})

export const calculateRetryDelay = (
  attempt: number,
  config: ReturnType<typeof createRetryConfig>
): number => {
  const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1)
  return Math.min(delay, config.maxDelay)
}