import { createSelector } from "@reduxjs/toolkit"
import { RootState } from "../store"
import {
  calculateTotalBalanceInMainCurrency,
  convertCurrency,
  groupAccountsByCurrency,
  calculateAccountStatistics,
  getLatestExchangeRate,
} from "../utils/contabilidadUtils"

// Re-export basic selectors from slice
export {
  selectContabilidadState,
  selectCuentasBancarias,
  selectMonedas,
  selectTasasCambio,
  selectTiposPago,
  selectSelectedCuentaId,
  selectSelectedMoneda,
  selectFiltros,
  selectLoading,
  selectError,
  selectLastError,
  selectMonedaPrincipal,
  selectTasasActuales,
  selectCuentasActivas,
  selectCuentasPorMoneda,
  selectSaldoTotalPorMoneda,
  selectSelectedCuenta,
  selectMonedasActivas,
  selectMonedaPrincipalData,
  selectTasaCambioActual,
  selectPendingReconciliationsCount,
  selectCuentaBalance,
  selectTotalBalanceInMainCurrency,
  selectRecentTransfers,
  selectAccountsRequiringAttention,
} from "../slices/contabilidadSlice"

// Enhanced selectors with complex business logic

// Dashboard overview selector
export const selectDashboardOverview = createSelector(
  [
    (state: RootState) => state.contabilidad.cuentasBancarias,
    (state: RootState) => state.contabilidad.monedas,
    (state: RootState) => state.contabilidad.tasasActuales,
    (state: RootState) => state.contabilidad.monedaPrincipal,
    (state: RootState) => state.contabilidad.ventasPendientes,
    (state: RootState) => state.contabilidad.serviciosPendientes,
    (state: RootState) => state.contabilidad.gastosPendientes,
    (state: RootState) => state.contabilidad.resumenFinanciero,
  ],
  (cuentas, monedas, tasasActuales, monedaPrincipal, ventasPendientes, serviciosPendientes, gastosPendientes, resumenFinanciero) => {
    const cuentasActivas = cuentas.filter(c => c.isActive)
    const accountStats = calculateAccountStatistics(cuentasActivas)
    const totalBalanceInMainCurrency = calculateTotalBalanceInMainCurrency(
      cuentasActivas,
      monedaPrincipal,
      tasasActuales
    )
    
    const pendingCounts = {
      ventas: ventasPendientes.filter(v => !v.reconciliada).length,
      servicios: serviciosPendientes.filter(s => !s.reconciliada).length,
      gastos: gastosPendientes.filter(g => !g.reconciliado).length,
    }
    
    const accountsByStatus = {
      active: cuentasActivas.length,
      inactive: cuentas.length - cuentasActivas.length,
      withNegativeBalance: cuentasActivas.filter(c => c.saldo < 0).length,
      withLowBalance: cuentasActivas.filter(c => c.saldo > 0 && c.saldo < 1000).length,
    }
    
    return {
      accountStats,
      totalBalanceInMainCurrency,
      pendingReconciliations: {
        ...pendingCounts,
        total: pendingCounts.ventas + pendingCounts.servicios + pendingCounts.gastos,
      },
      accountsByStatus,
      currenciesInUse: accountStats.currenciesUsed.length,
      resumenFinanciero,
      lastUpdated: new Date().toISOString(),
    }
  }
)

// Exchange rates with metadata
export const selectExchangeRatesWithMetadata = createSelector(
  [
    (state: RootState) => state.contabilidad.tasasCambio,
    (state: RootState) => state.contabilidad.tasasActuales,
    (state: RootState) => state.contabilidad.monedas,
    (state: RootState) => state.contabilidad.monedaPrincipal,
  ],
  (tasasHistoricas, tasasActuales, monedas, monedaPrincipal) => {
    const monedasSecundarias = monedas.filter(m => m.codigo !== monedaPrincipal && m.isActive)
    
    return monedasSecundarias.map(moneda => {
      const tasaActual = tasasActuales[`${moneda.codigo}_${monedaPrincipal}`] ||
                        getLatestExchangeRate(moneda.codigo, monedaPrincipal, tasasHistoricas)
      
      const tasasRecientes = tasasHistoricas
        .filter(t => t.monedaOrigenId === moneda.codigo && t.monedaDestino === monedaPrincipal)
        .sort((a, b) => new Date(b.fechaVigencia).getTime() - new Date(a.fechaVigencia).getTime())
        .slice(0, 5)
      
      const tendencia = tasasRecientes.length >= 2 ? 
        (tasasRecientes[0].tasa > tasasRecientes[1].tasa ? 'up' : 
         tasasRecientes[0].tasa < tasasRecientes[1].tasa ? 'down' : 'stable') : 'unknown'
      
      return {
        moneda,
        tasaActual,
        tasasRecientes,
        tendencia,
        ultimaActualizacion: tasasRecientes[0]?.fechaVigencia || null,
        variacionPorcentual: tasasRecientes.length >= 2 ? 
          ((tasasRecientes[0].tasa - tasasRecientes[1].tasa) / tasasRecientes[1].tasa) * 100 : 0,
      }
    })
  }
)

// Accounts with computed balances in multiple currencies
export const selectAccountsWithComputedBalances = createSelector(
  [
    (state: RootState) => state.contabilidad.cuentasBancarias,
    (state: RootState) => state.contabilidad.tasasActuales,
    (state: RootState) => state.contabilidad.monedaPrincipal,
    (state: RootState) => state.contabilidad.monedas,
  ],
  (cuentas, tasasActuales, monedaPrincipal, monedas) => {
    return cuentas.map(cuenta => {
      const monedaData = monedas.find(m => m.codigo === cuenta.moneda)
      
      // Calculate balance in main currency
      const saldoEnMonedaPrincipal = convertCurrency(
        cuenta.saldo,
        cuenta.moneda,
        monedaPrincipal,
        tasasActuales
      )
      
      // Calculate balances in other active currencies
      const saldosEnOtrasMonedas = monedas
        .filter(m => m.isActive && m.codigo !== cuenta.moneda)
        .reduce((acc, moneda) => {
          const saldoConvertido = convertCurrency(
            cuenta.saldo,
            cuenta.moneda,
            moneda.codigo,
            tasasActuales
          )
          if (saldoConvertido !== null) {
            acc[moneda.codigo] = saldoConvertido
          }
          return acc
        }, {} as { [currency: string]: number })
      
      return {
        ...cuenta,
        monedaData,
        saldoEnMonedaPrincipal,
        saldosEnOtrasMonedas,
        status: cuenta.saldo < 0 ? 'negative' : 
                cuenta.saldo < 1000 ? 'low' : 'normal',
      }
    })
  }
)

// Reconciliation summary with trends
export const selectReconciliationSummary = createSelector(
  [
    (state: RootState) => state.contabilidad.ventasPendientes,
    (state: RootState) => state.contabilidad.serviciosPendientes,
    (state: RootState) => state.contabilidad.gastosPendientes,
    (state: RootState) => state.contabilidad.reconciliacionesVentas,
    (state: RootState) => state.contabilidad.reconciliacionesServicios,
    (state: RootState) => state.contabilidad.reconciliacionesGastos,
  ],
  (ventasPendientes, serviciosPendientes, gastosPendientes, 
   reconciliacionesVentas, reconciliacionesServicios, reconciliacionesGastos) => {
    
    const today = new Date()
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    // Pending items
    const pending = {
      ventas: ventasPendientes.filter(v => !v.reconciliada).length,
      servicios: serviciosPendientes.filter(s => !s.reconciliada).length,
      gastos: gastosPendientes.filter(g => !g.reconciliado).length,
    }
    
    // Recent reconciliations (last 7 days)
    const recentReconciliations = {
      ventas: reconciliacionesVentas.filter(r => 
        new Date(r.fechaReconciliacion) >= lastWeek
      ).length,
      servicios: reconciliacionesServicios.filter(r => 
        new Date(r.fechaReconciliacion) >= lastWeek
      ).length,
      gastos: reconciliacionesGastos.filter(r => 
        new Date(r.fechaReconciliacion) >= lastWeek
      ).length,
    }
    
    // Total amounts pending reconciliation
    const pendingAmounts = {
      ventas: ventasPendientes
        .filter(v => !v.reconciliada)
        .reduce((sum, v) => sum + v.montoTotal, 0),
      servicios: serviciosPendientes
        .filter(s => !s.reconciliada)
        .reduce((sum, s) => sum + (s as any).servicio?.precio || 0, 0),
      gastos: gastosPendientes
        .filter(g => !g.reconciliado)
        .reduce((sum, g) => sum + g.monto, 0),
    }
    
    return {
      pending: {
        ...pending,
        total: pending.ventas + pending.servicios + pending.gastos,
      },
      recentReconciliations: {
        ...recentReconciliations,
        total: recentReconciliations.ventas + recentReconciliations.servicios + recentReconciliations.gastos,
      },
      pendingAmounts: {
        ...pendingAmounts,
        total: pendingAmounts.ventas + pendingAmounts.servicios + pendingAmounts.gastos,
      },
      efficiency: {
        ventasRate: ventasPendientes.length > 0 ? 
          (recentReconciliations.ventas / (recentReconciliations.ventas + pending.ventas)) * 100 : 100,
        serviciosRate: serviciosPendientes.length > 0 ? 
          (recentReconciliations.servicios / (recentReconciliations.servicios + pending.servicios)) * 100 : 100,
        gastosRate: gastosPendientes.length > 0 ? 
          (recentReconciliations.gastos / (recentReconciliations.gastos + pending.gastos)) * 100 : 100,
      },
    }
  }
)

// Transfer analysis
export const selectTransferAnalysis = createSelector(
  [
    (state: RootState) => state.contabilidad.transferencias,
    (state: RootState) => state.contabilidad.cuentasBancarias,
  ],
  (transferencias, cuentas) => {
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recentTransfers = transferencias.filter(t => 
      new Date(t.fechaTransferencia) >= last30Days
    )
    
    // Most active accounts
    const accountActivity = cuentas.map(cuenta => {
      const asOrigin = recentTransfers.filter(t => t.cuentaOrigenId === cuenta.cuentaId).length
      const asDestination = recentTransfers.filter(t => t.cuentaDestinoId === cuenta.cuentaId).length
      
      return {
        cuenta,
        transfersAsOrigin: asOrigin,
        transfersAsDestination: asDestination,
        totalTransfers: asOrigin + asDestination,
      }
    }).sort((a, b) => b.totalTransfers - a.totalTransfers)
    
    // Currency conversion analysis
    const crossCurrencyTransfers = recentTransfers.filter(t => 
      t.monedaOrigen !== t.monedaDestino
    )
    
    const totalVolume = recentTransfers.reduce((sum, t) => sum + t.montoOrigen, 0)
    const crossCurrencyVolume = crossCurrencyTransfers.reduce((sum, t) => sum + t.montoOrigen, 0)
    
    return {
      totalTransfers: recentTransfers.length,
      totalVolume,
      crossCurrencyTransfers: crossCurrencyTransfers.length,
      crossCurrencyVolume,
      crossCurrencyPercentage: recentTransfers.length > 0 ? 
        (crossCurrencyTransfers.length / recentTransfers.length) * 100 : 0,
      mostActiveAccounts: accountActivity.slice(0, 5),
      averageTransferAmount: recentTransfers.length > 0 ? 
        totalVolume / recentTransfers.length : 0,
      comprobantesGenerated: recentTransfers.filter(t => t.comprobanteGenerado).length,
    }
  }
)

// Financial health indicators
export const selectFinancialHealthIndicators = createSelector(
  [
    (state: RootState) => state.contabilidad.cuentasBancarias,
    (state: RootState) => state.contabilidad.tasasActuales,
    (state: RootState) => state.contabilidad.monedaPrincipal,
    (state: RootState) => state.contabilidad.resumenFinanciero,
  ],
  (cuentas, tasasActuales, monedaPrincipal, resumenFinanciero) => {
    const cuentasActivas = cuentas.filter(c => c.isActive)
    const totalBalance = calculateTotalBalanceInMainCurrency(
      cuentasActivas,
      monedaPrincipal,
      tasasActuales
    )
    
    // Risk indicators
    const negativeBalanceAccounts = cuentasActivas.filter(c => c.saldo < 0)
    const lowBalanceAccounts = cuentasActivas.filter(c => c.saldo > 0 && c.saldo < 1000)
    
    // Diversification
    const currencyDistribution = groupAccountsByCurrency(cuentasActivas)
    const currencyCount = Object.keys(currencyDistribution).length
    
    // Concentration risk (percentage of total balance in largest account)
    const largestAccountBalance = Math.max(...cuentasActivas.map(c => 
      convertCurrency(c.saldo, c.moneda, monedaPrincipal, tasasActuales) || 0
    ))
    const concentrationRisk = totalBalance > 0 ? (largestAccountBalance / totalBalance) * 100 : 0
    
    return {
      totalBalance,
      accountCount: cuentasActivas.length,
      currencyDiversification: currencyCount,
      riskIndicators: {
        negativeBalanceCount: negativeBalanceAccounts.length,
        lowBalanceCount: lowBalanceAccounts.length,
        concentrationRisk,
        riskLevel: concentrationRisk > 70 ? 'high' : 
                  concentrationRisk > 50 ? 'medium' : 'low',
      },
      liquidity: {
        totalLiquidAssets: totalBalance,
        averageAccountBalance: cuentasActivas.length > 0 ? totalBalance / cuentasActivas.length : 0,
        liquidityRatio: resumenFinanciero ?
          (totalBalance / (resumenFinanciero.resumenPorMoneda.reduce((sum, r) => sum + r.totalEgresos, 0) || 1)) : 0,
      },
      healthScore: calculateHealthScore(
        negativeBalanceAccounts.length,
        lowBalanceAccounts.length,
        concentrationRisk,
        currencyCount,
        cuentasActivas.length
      ),
    }
  }
)

// Helper function to calculate financial health score
const calculateHealthScore = (
  negativeAccounts: number,
  lowBalanceAccounts: number,
  concentrationRisk: number,
  currencyDiversification: number,
  totalAccounts: number
): number => {
  let score = 100
  
  // Penalize negative balances
  score -= negativeAccounts * 15
  
  // Penalize low balances
  score -= lowBalanceAccounts * 5
  
  // Penalize high concentration risk
  if (concentrationRisk > 70) score -= 20
  else if (concentrationRisk > 50) score -= 10
  
  // Reward currency diversification
  if (currencyDiversification > 1) score += 5
  if (currencyDiversification > 2) score += 5
  
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, score))
}