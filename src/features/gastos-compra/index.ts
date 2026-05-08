// Server Actions (nuevo)
export { getGastosCompraAction, getGastoCompraStatsAction, getGastoCompraByIdAction } from './actions';
export { gastoCompraApi, useGetGastosCompraQuery, useGetGastoCompraByIdQuery, useCreateGastoCompraMutation, useGetGastoCompraStatsQuery, useGetGastoCompraStatsByProveedorQuery, useGetGastoCompraStatsByProductoQuery, useGetGastoCompraStatsByPeriodoQuery, useExportGastosCompraQuery, useLazyExportGastosCompraQuery } from './api/gastoCompraApi'
export type { GastosCompra } from './types'
