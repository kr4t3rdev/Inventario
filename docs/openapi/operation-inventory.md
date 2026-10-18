# Inventario de operaciones mobile v1 (OpenAPI)

Generado: 2026-10-18T06:50:46.965Z. Fuente: `docs/openapi/mobile-v1.json` + rutas en `src/app/api/mobile/v1`.
Artefacto de la Fase 0 del plan de reconciliación OpenAPI. Regenerar con `pnpm run openapi:inventory`.

## Resumen

- Operaciones reales: 180
- Operaciones documentadas: 180
- Sin documentar: 0
- Documentadas sin implementación: 0
- operationId duplicados: 0
- Anomalías de exportación: 0

## Matriz por operación

| Operación | operationId | Request | Respuestas | Auth | Tenant | Permiso | Servicios de ruta | Consumidores móvil |
|---|---|---|---|---|---|---|---|---|
| DELETE /accounting/advances/{id} | mobileDeleteAccountingAdvancesById | (sin body) | 200, 401, 404, 500 | bearer | sí | — | — | accounting-advances-api.ts |
| DELETE /accounting/payment-types/{id} | mobileDeleteAccountingPaymentTypesById | (sin body) | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | payment-types-api.ts |
| DELETE /clients/{id} | mobileDeleteClientsById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | clients-api.ts |
| DELETE /providers/{id} | mobileDeleteProvidersById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | providers-api.ts |
| DELETE /units/{id} | mobileDeleteUnit | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| DELETE /warehouses/{id} | mobileDeleteWarehousesById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | warehouses-api.ts |
| GET /accounting/accounts-payable | mobileGetAccountingAccountsPayable | (sin body) | 200, 401, 500 | bearer | — | — | AccountingAccountsService | receivables-payables-api.ts |
| GET /accounting/accounts-receivable | mobileGetAccountingAccountsReceivable | (sin body) | 200, 401, 403, 500 | bearer | — | sí | AccountingAccountsService | receivables-payables-api.ts |
| GET /accounting/accounts-receivable/metrics | mobileGetAccountingAccountsReceivableMetrics | (sin body) | 200, 401, 403, 500 | bearer | — | sí | AccountingAccountsService | receivables-payables-api.ts |
| GET /accounting/advances | mobileGetAccountingAdvances | (sin body) | 200, 401, 500 | bearer | sí | — | — | accounting-advances-api.ts |
| GET /accounting/advances/available | mobileGetAccountingAdvancesAvailable | (sin body) | 200, 400, 401, 500 | bearer | sí | — | — | accounting-advances-api.ts |
| GET /accounting/advances/reports/customers | mobileGetAccountingAdvancesReportsCustomers | (sin body) | 200, 401, 500 | bearer | — | — | AccountingReportsService | — |
| GET /accounting/advances/reports/providers | mobileGetAccountingAdvancesReportsProviders | (sin body) | 200, 401, 500 | bearer | — | — | AccountingReportsService | — |
| GET /accounting/advances/reports/summary | mobileGetAccountingAdvancesReportsSummary | (sin body) | 200, 401, 500 | bearer | — | — | AccountingReportsService | — |
| GET /accounting/advances/{id} | mobileGetAccountingAdvancesById | (sin body) | 200, 401, 404, 500 | bearer | sí | — | — | accounting-advances-api.ts |
| GET /accounting/bank-accounts | mobileGetAccountingBankAccounts | (sin body) | 200, 401, 403, 500 | bearer | — | sí | BankAccountReadService | accounting-api.ts |
| GET /accounting/bank-accounts/{id} | mobileGetAccountingBankAccountsById | (sin body) | 200, 401, 403, 500 | bearer | — | sí | BankAccountReadService | accounting-api.ts |
| GET /accounting/bank-accounts/{id}/history | mobileGetAccountingBankAccountsByIdNestedHistory | (sin body) | 200, 401, 403, 404, 500 | bearer | — | sí | BankAccountReadService | accounting-api.ts |
| GET /accounting/bank-adjustments | mobileGetAccountingBankAdjustments | (sin body) | 200, 401, 500 | bearer | — | — | AccountingOperationsMutationService, AccountingOperationsReadService | accounting-api.ts |
| GET /accounting/bank-transfers | mobileGetAccountingBankTransfers | (sin body) | 200, 401, 500 | bearer | — | — | AccountingOperationsMutationService, AccountingOperationsReadService | accounting-api.ts |
| GET /accounting/bank-transfers/{id} | mobileGetAccountingBankTransfersById | (sin body) | 200, 401, 500 | bearer | — | — | AccountingOperationsReadService | accounting-api.ts |
| GET /accounting/bank-transfers/{id}/comprobante | mobileGetAccountingBankTransfersByIdComprobante | (sin body) | 200, 401, 404, 500 | bearer | — | — | AccountingOperationsReadService | accounting-api.ts |
| GET /accounting/capital-injections | mobileGetAccountingCapitalInjections | (sin body) | 200, 401, 403, 500 | bearer | — | sí | AccountingOperationsMutationService, AccountingOperationsReadService | capital-api.ts |
| GET /accounting/cash-debts | mobileGetAccountingCashDebts | (sin body) | 200, 401, 500 | bearer | sí | sí | AccountingCashOperationsMutationService, AccountingCashOperationsService | cash-financing-api.ts |
| GET /accounting/cash-debts/stats | mobileGetAccountingCashDebtsStats | (sin body) | 200, 401, 500 | bearer | — | — | AccountingCashOperationsService | cash-financing-api.ts |
| GET /accounting/cash-debts/{id} | mobileGetAccountingCashDebtsById | (sin body) | 200, 401, 500 | bearer | — | — | AccountingCashOperationsMutationService, AccountingCashOperationsService | cash-financing-api.ts |
| GET /accounting/cash-loans | mobileGetAccountingCashLoans | (sin body) | 200, 401, 500 | bearer | — | — | AccountingCashOperationsMutationService, AccountingCashOperationsService | cash-financing-api.ts |
| GET /accounting/cash-loans/stats | mobileGetAccountingCashLoansStats | (sin body) | 200, 401, 500 | bearer | — | — | AccountingCashOperationsService | cash-financing-api.ts |
| GET /accounting/cash-loans/{id} | mobileGetAccountingCashLoansById | (sin body) | 200, 401, 500 | bearer | — | — | AccountingCashOperationsMutationService, AccountingCashOperationsService | cash-financing-api.ts |
| GET /accounting/cash-loans/{id}/comprobante | mobileGetAccountingCashLoansByIdComprobante | (sin body) | 200, 401, 404, 500 | bearer | — | — | AccountingCashOperationsService | cash-financing-api.ts |
| GET /accounting/cash-loans/{id}/history | mobileGetAccountingCashLoansByIdNestedHistory | (sin body) | 200, 401, 500 | bearer | — | — | AccountingCashOperationsService | cash-financing-api.ts |
| GET /accounting/exchange/monedas | mobileGetAccountingExchangeMonedas | (sin body) | 200, 401, 500 | bearer | — | — | — | exchange-api.ts |
| GET /accounting/exchange/tasas | mobileGetAccountingExchangeTasas | (sin body) | 200, 401, 500 | bearer | — | — | — | exchange-api.ts |
| GET /accounting/logs | mobileGetAccountingLogs | (sin body) | 200, 401, 500 | bearer | — | — | AccountingAuditLogsService | accounting-logs-api.ts |
| GET /accounting/payment-types | mobileGetAccountingPaymentTypes | (sin body) | 200, 401, 403, 500 | bearer | — | — | AccountingConfigReadService | payment-types-api.ts |
| GET /accounting/payment-types/available-accounts | mobileGetAccountingPaymentTypesAvailableAccounts | (sin body) | 200, 401, 403, 500 | bearer | — | — | AccountingConfigReadService | payment-types-api.ts |
| GET /accounting/payment-types/{id} | mobileGetAccountingPaymentTypesById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | payment-types-api.ts |
| GET /accounting/reconciliation/expenses | mobileGetAccountingReconciliationExpenses | (sin body) | 200, 401, 500 | bearer | — | — | AccountingReconciliationService | reconciliation-api.ts |
| GET /accounting/reconciliation/expenses-history | mobileGetAccountingReconciliationExpensesHistory | (sin body) | 200, 401, 500 | bearer | — | — | AccountingReconciliationService | reconciliation-api.ts |
| GET /accounting/reconciliation/expenses/history | mobileGetAccountingReconciliationExpensesNestedHistory | (sin body) | 200, 401, 500 | bearer | — | — | AccountingReconciliationService | — |
| GET /accounting/reconciliation/sales | mobileGetAccountingReconciliationSales | (sin body) | 200, 401, 500 | bearer | — | — | AccountingReconciliationService | reconciliation-api.ts |
| GET /accounting/reconciliation/sales-history | mobileGetAccountingReconciliationSalesHistory | (sin body) | 200, 401, 500 | bearer | — | — | AccountingReconciliationService | reconciliation-api.ts |
| GET /accounting/reconciliation/sales/history | mobileGetAccountingReconciliationSalesNestedHistory | (sin body) | 200, 401, 500 | bearer | — | — | AccountingReconciliationService | — |
| GET /accounting/reconciliation/services | mobileGetAccountingReconciliationServices | (sin body) | 200, 401, 500 | bearer | — | sí | AccountingReconciliationService | reconciliation-api.ts |
| GET /accounting/reconciliation/services-history | mobileGetAccountingReconciliationServicesHistory | (sin body) | 200, 401, 500 | bearer | — | — | AccountingReconciliationService | reconciliation-api.ts |
| GET /accounting/reconciliation/services/history | mobileGetAccountingReconciliationServicesNestedHistory | (sin body) | 200, 401, 500 | bearer | — | — | AccountingReconciliationService | — |
| GET /accounting/reconciliation/stats | mobileGetAccountingReconciliationStats | (sin body) | 200, 401, 500 | bearer | sí | — | — | reconciliation-api.ts |
| GET /accounting/reports/client-account-analysis | mobileGetAccountingReportsClientAccountAnalysis | (sin body) | 200, 400, 401, 403, 500 | bearer | — | — | AccountingReportsService | — |
| GET /accounting/reports/exchange | mobileGetAccountingReportsExchange | (sin body) | 200, 401, 500 | bearer | — | — | AccountingReportsService | accounting-reports-api.ts |
| GET /accounting/reports/exchange-impact | mobileGetAccountingReportsExchangeImpact | (sin body) | 200, 401, 500 | bearer | — | — | AccountingReportsService | accounting-reports-api.ts |
| GET /accounting/reports/movements | mobileGetAccountingReportsMovements | (sin body) | 200, 401, 500 | bearer | sí | — | AccountingReportsService | accounting-reports-api.ts |
| GET /accounting/reports/overdue-invoices | mobileGetAccountingReportsOverdueInvoices | (sin body) | 200, 401, 403, 500 | bearer | — | sí | AccountingReportsService | accounting-reports-api.ts |
| GET /accounting/reports/summary | mobileGetAccountingReportsSummary | (sin body) | 200, 401, 500 | bearer | sí | — | AccountingReportsService | accounting-reports-api.ts |
| GET /accounting/reports/transfers | mobileGetAccountingReportsTransfers | (sin body) | 200, 401, 500 | bearer | — | — | AccountingReportsService | accounting-reports-api.ts |
| GET /admin/activity-logs | mobileGetAdminActivityLogs | (sin body) | 200, 400, 401, 403, 500 | bearer | — | — | — | — |
| GET /admin/health | mobileGetAdminHealth | (sin body) | 200, 401, 403, 500 | bearer | — | — | — | admin-api.ts |
| GET /admin/licenses | mobileGetAdminLicenses | (sin body) | 200, 400, 401, 403, 500 | bearer | — | — | — | admin-api.ts, licenses-api.ts |
| GET /admin/licenses/stats | mobileGetAdminLicenseStats | (sin body) | 200, 400, 401, 403, 500 | bearer | — | — | — | admin-api.ts |
| GET /admin/memberships/pending | mobileGetAdminPendingMemberships | (sin body) | 200, 401, 403, 500 | bearer | — | — | — | admin-api.ts |
| GET /admin/sessions | mobileGetAdminSessions | (sin body) | 200, 401, 403, 500 | bearer | — | — | — | — |
| GET /admin/tenants | mobileGetAdminTenants | (sin body) | 200, 401, 403, 500 | bearer | — | — | — | admin-api.ts |
| GET /admin/tenants/detail | mobileGetAdminTenantDetail | (sin body) | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /admin/tenants/license | mobileGetAdminTenantLicense | (sin body) | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /admin/tenants/users | mobileGetAdminTenantUsers | (sin body) | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /admin/users | mobileGetAdminUsers | (sin body) | 200, 401, 403, 500 | bearer | — | — | — | admin-api.ts, users-api.ts |
| GET /admin/users/detail | mobileGetAdminUserDetail | (sin body) | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /admin/users/login-history | mobileGetAdminUserLoginHistory | (sin body) | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /auth/me | mobileGetAuthMe | (sin body) | 200, 401, 500 | bearer | — | — | AuthService | — |
| GET /auth/tenants | mobileGetAuthTenants | (sin body) | 200, 401, 500 | bearer | — | — | AuthService | — |
| GET /categorias | mobileListCategorias | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /categorias/{id} | mobileGetCategoriaById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /clients | mobileGetClients | (sin body) | 200, 401, 403, 500 | bearer | — | — | — | clients-api.ts |
| GET /clients/{id} | mobileGetClientsById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | clients-api.ts |
| GET /compras | mobileListCompras | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /compras/{id} | mobileGetComprasById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /contratos | mobileListContratos | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /contratos/{id} | mobileGetContratosById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /dashboard/daily-average | mobileGetDashboardDailyAverage | (sin body) | 200, 401, 403, 500 | bearer | — | — | — | — |
| GET /dashboard/income-expenses | mobileGetDashboardIncomeExpenses | (sin body) | 200, 401, 403, 500 | bearer | — | — | — | — |
| GET /dashboard/inventory-value | mobileGetDashboardInventoryValue | (sin body) | 200, 401, 403, 500 | bearer | — | — | — | — |
| GET /dashboard/low-stock | mobileGetDashboardLowStock | (sin body) | 200, 401, 403, 500 | bearer | — | — | — | — |
| GET /dashboard/stats | mobileGetDashboardStats | (sin body) | 200, 401, 403, 500 | bearer | — | — | — | business-api.ts, dashboard-api.ts |
| GET /dashboard/stock-distribution | mobileGetDashboardStockDistribution | (sin body) | 200, 401, 403, 500 | bearer | — | — | — | — |
| GET /dashboard/today-sales | mobileGetDashboardTodaySales | (sin body) | 200, 401, 403, 500 | bearer | — | — | — | — |
| GET /dashboard/top-products | mobileGetDashboardTopProducts | (sin body) | 200, 401, 403, 500 | bearer | — | — | — | — |
| GET /dashboard/transfers | mobileGetDashboardTransfers | (sin body) | 200, 401, 403, 500 | bearer | — | — | — | — |
| GET /empleados | mobileListEmpleados | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /empleados/{id} | mobileGetEmpleadosById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /facturas | mobileListFacturas | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /facturas/{id} | mobileGetFacturasById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /gastos | mobileListGastos | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /gastos/{id} | mobileGetGastosById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /listas-precios | mobileListListasPrecios | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /listas-precios/{id} | mobileGetListaPrecioById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /mermas | mobileListMermas | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /mermas/{id} | mobileGetMermasById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /ofertas | mobileListOfertas | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /ofertas/{id} | mobileGetOfertasById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /produccion | mobileListProduccion | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /produccion/{id} | mobileGetProduccionById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /products | mobileGetProducts | (sin body) | 200, 401, 403, 500 | bearer | — | — | ProductoService | business-api.ts, products-api.ts |
| GET /products/stock | mobileGetProductsStock | (sin body) | 200, 400, 401, 403, 500 | bearer | — | — | ProductoService | business-api.ts, products-api.ts |
| GET /products/{id} | mobileGetProductsById | (sin body) | 200, 401, 403, 500 | bearer | — | — | ProductoService | products-api.ts |
| GET /providers | mobileGetProviders | (sin body) | 200, 401, 403, 500 | bearer | — | — | — | providers-api.ts |
| GET /providers/{id} | mobileGetProvidersById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | providers-api.ts |
| GET /puntos-venta | mobileListPuntosVenta | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /puntos-venta/{id} | mobileGetPuntoVentaById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /reparaciones | mobileListReparaciones | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /reparaciones/{id} | mobileGetReparacionesById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /sales | mobileGetSales | (sin body) | 200, 401, 403, 500 | bearer | — | — | VentaReadService | sales-api.ts |
| GET /sales/{id} | mobileGetSalesById | (sin body) | 200, 401, 403, 500 | bearer | — | — | VentaReadService | sales-api.ts |
| GET /servicios | mobileListServicios | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /servicios/{id} | mobileGetServiciosById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /transferencias | mobileListTransferencias | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /transferencias/{id} | mobileGetTransferenciasById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /units | mobileListUnits | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| GET /warehouses | mobileGetWarehouses | (sin body) | 200, 401, 403, 500 | bearer | — | — | — | warehouses-api.ts |
| GET /warehouses/{id} | mobileGetWarehousesById | (sin body) | 200, 401, 403, 404, 500 | bearer | — | — | — | warehouses-api.ts |
| PATCH /admin/tenants/license/update | mobileUpdateAdminTenantLicense | UpdateAdminTenantLicenseRequest | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | — |
| PATCH /admin/tenants/update | mobileUpdateAdminTenant | UpdateAdminTenantRequest | 200, 400, 401, 403, 404, 409, 500 | bearer | — | — | — | — |
| PATCH /admin/users/change-tenant-role | mobileChangeAdminUserTenantRole | ChangeAdminUserTenantRoleRequest | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | — |
| PATCH /admin/users/update | mobileUpdateAdminUser | UpdateAdminUserRequest | 200, 400, 401, 403, 404, 409, 500 | bearer | — | — | — | — |
| PATCH /sales/{id}/update | mobilePatchSalesByIdUpdate | SaleUpdateRequest | 200, 401, 500 | bearer | — | — | VentaMutationService | sales-api.ts |
| POST /accounting/advances | mobilePostAccountingAdvances | AccountingAdvancesPostRequest | 200, 201, 400, 401, 500 | bearer | sí | — | — | accounting-advances-api.ts |
| POST /accounting/advances/{id}/ejecutar | mobilePostAccountingAdvancesByIdEjecutar | AccountingAdvancesIdEjecutarPostRequest | 200, 400, 401, 404, 409, 500 | bearer | — | — | — | accounting-advances-api.ts |
| POST /accounting/advances/{id}/revertir | mobilePostAccountingAdvancesByIdRevertir | AccountingAdvancesIdRevertirPostRequest | 200, 400, 401, 404, 500 | bearer | — | — | — | accounting-advances-api.ts |
| POST /accounting/bank-adjustments | mobilePostAccountingBankAdjustments | BankAdjustmentRequest | 200, 400, 401, 500 | bearer | — | — | AccountingOperationsMutationService, AccountingOperationsReadService | accounting-api.ts |
| POST /accounting/bank-transfers | mobilePostAccountingBankTransfers | BankTransferCreateRequest | 200, 400, 401, 500 | bearer | — | — | AccountingOperationsMutationService, AccountingOperationsReadService | accounting-api.ts |
| POST /accounting/bank-transfers/validate | mobilePostAccountingBankTransfersValidate | BankTransferValidationRequest | 200, 401, 500 | bearer | — | — | AccountingOperationsMutationService | accounting-api.ts |
| POST /accounting/capital-injections | mobilePostAccountingCapitalInjections | CapitalInjectionCreateRequest | 200, 400, 401, 500 | bearer | — | sí | AccountingOperationsMutationService, AccountingOperationsReadService | capital-api.ts |
| POST /accounting/capital-injections/{id}/payments | mobilePostAccountingCapitalInjectionsByIdPayments | CapitalPaymentRequest | 200, 400, 401, 500 | bearer | — | sí | AccountingOperationsMutationService | capital-api.ts |
| POST /accounting/cash-debts | mobilePostAccountingCashDebts | CashDebtCreateRequest | 200, 400, 401, 500 | bearer | sí | sí | AccountingCashOperationsMutationService, AccountingCashOperationsService | cash-financing-api.ts |
| POST /accounting/cash-debts/{id}/payments | mobilePostAccountingCashDebtsByIdPayments | CashPaymentRequest | 200, 400, 401, 500 | bearer | — | sí | AccountingCashOperationsMutationService | cash-financing-api.ts |
| POST /accounting/cash-loans | mobilePostAccountingCashLoans | CashLoanCreateRequest | 200, 400, 401, 500 | bearer | — | — | AccountingCashOperationsMutationService, AccountingCashOperationsService | cash-financing-api.ts |
| POST /accounting/cash-loans/{id}/payments | mobilePostAccountingCashLoansByIdPayments | CashPaymentRequest | 200, 400, 401, 500 | bearer | — | sí | AccountingCashOperationsMutationService | cash-financing-api.ts |
| POST /accounting/reconciliation/expenses | mobilePostAccountingReconciliationExpenses | ExpenseReconciliationRequest | 200, 400, 401, 500 | bearer | — | — | AccountingReconciliationService | reconciliation-api.ts |
| POST /accounting/reconciliation/sales | mobilePostAccountingReconciliationSales | SaleReconciliationRequest | 200, 400, 401, 500 | bearer | — | — | AccountingReconciliationService | reconciliation-api.ts |
| POST /accounting/reconciliation/services | mobilePostAccountingReconciliationServices | ServiceReconciliationRequest | 200, 400, 401, 500 | bearer | — | sí | AccountingReconciliationService | reconciliation-api.ts |
| POST /admin/licenses/activate | mobileActivateAdminLicense | AdminLicenciaIdRequest | 200, 400, 401, 403, 404, 409, 500 | bearer | — | — | — | — |
| POST /admin/licenses/deactivate | mobileDeactivateAdminLicense | AdminLicenciaIdRequest | 200, 400, 401, 403, 404, 409, 500 | bearer | — | — | — | — |
| POST /admin/licenses/delete | mobileDeleteAdminLicense | AdminLicenciaIdRequest | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | — |
| POST /admin/licenses/renew | mobileRenewAdminLicense | RenewAdminLicenseRequest | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | — |
| POST /admin/memberships/approve | mobileApproveAdminMembership | ApproveAdminMembershipRequest | 200, 400, 401, 403, 404, 409, 500 | bearer | — | — | — | admin-api.ts |
| POST /admin/memberships/reject | mobileRejectAdminMembership | RejectAdminMembershipRequest | 200, 401, 403, 404, 500 | bearer | — | — | — | admin-api.ts |
| POST /admin/sessions/revoke | mobileRevokeAdminSession | AdminRevokeSessionRequest | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | — |
| POST /admin/tenants/activate | mobileActivateAdminTenant | AdminTenantIdRequest | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | — |
| POST /admin/tenants/deactivate | mobileDeactivateAdminTenant | AdminTenantIdRequest | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | — |
| POST /admin/tenants/delete | mobileDeleteAdminTenant | AdminTenantIdRequest | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | — |
| POST /admin/tenants/license/assign | mobileAssignAdminTenantLicense | AssignAdminTenantLicenseRequest | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | — |
| POST /admin/tenants/license/deactivate | mobileDeactivateAdminTenantLicense | AdminLicenciaIdRequest | 200, 400, 401, 403, 404, 409, 500 | bearer | — | — | — | — |
| POST /admin/tenants/remove-user | mobileRemoveAdminTenantUser | AdminRemoveTenantUserRequest | 200, 400, 401, 403, 404, 409, 500 | bearer | — | — | — | — |
| POST /admin/users/activate | mobileActivateAdminUser | AdminUserIdRequest | 200, 400, 401, 403, 404, 409, 500 | bearer | — | — | — | — |
| POST /admin/users/assign-tenant | mobileAssignAdminUserTenant | AssignAdminUserTenantRequest | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | — |
| POST /admin/users/deactivate | mobileDeactivateAdminUser | AdminUserIdRequest | 200, 400, 401, 403, 404, 409, 500 | bearer | — | — | — | — |
| POST /admin/users/delete | mobileDeleteAdminUser | AdminUserIdRequest | 200, 400, 401, 403, 404, 409, 500 | bearer | — | — | — | — |
| POST /admin/users/lock | mobileLockAdminUser | LockAdminUserRequest | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | admin-api.ts |
| POST /admin/users/resend-verification | mobileResendAdminUserVerification | AdminUserIdRequest | 200, 400, 401, 403, 404, 409, 500 | bearer | — | — | — | — |
| POST /admin/users/reset-password | mobileResetAdminUserPassword | AdminUserIdRequest | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | — |
| POST /admin/users/revoke-sessions | mobileRevokeAdminUserSessions | AdminUserIdRequest | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | — |
| POST /admin/users/unlock | mobileUnlockAdminUser | UnlockAdminUserRequest | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | admin-api.ts |
| POST /admin/users/verify-email | mobileVerifyAdminUserEmail | AdminUserIdRequest | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | — |
| POST /auth/login | mobilePostAuthLogin | LoginRequest | 200, 400, 401, 500 | public | — | — | AuthService | sdk-client.ts |
| POST /auth/logout | mobilePostAuthLogout | (sin body) | 200, 401, 500 | bearer | — | — | AuthService | sdk-client.ts |
| POST /auth/refresh | mobilePostAuthRefresh | RefreshRequest | 200, 400, 401, 403, 500 | public | — | — | AuthService | sdk-client.ts |
| POST /auth/register | mobilePostAuthRegister | RegisterRequest | 201, 400, 409, 429, 500, 503 | public | — | — | — | sdk-client.ts |
| POST /auth/tenants | mobilePostAuthTenants | SwitchTenantRequest | 200, 400, 401, 403, 500 | bearer | — | — | AuthService | sdk-client.ts |
| POST /clients/create | mobilePostClientsCreate | ClienteCreateRequest | 200, 400, 401, 403, 500 | bearer | — | — | — | clients-api.ts |
| POST /providers/create | mobilePostProvidersCreate | ProveedorCreateRequest | 200, 400, 401, 403, 500 | bearer | — | — | — | providers-api.ts |
| POST /sales/create | mobilePostSalesCreate | SaleCreateRequest | 200, 401, 500 | bearer | — | — | VentaMutationService | sales-api.ts |
| POST /sales/{id}/cancel | mobilePostSalesByIdCancel | SaleCancelRequest | 200, 401, 500 | bearer | — | — | VentaMutationService | sales-api.ts |
| POST /units/create | mobileCreateUnit | (inline) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| POST /warehouses/create | mobilePostWarehousesCreate | AlmacenCreateRequest | 200, 400, 401, 403, 500 | bearer | — | — | — | warehouses-api.ts |
| PUT /accounting/advances/{id} | mobilePutAccountingAdvancesById | AccountingAdvancesIdPutRequest | 200, 400, 401, 404, 500 | bearer | sí | — | — | accounting-advances-api.ts |
| PUT /accounting/cash-debts/{id} | mobilePutAccountingCashDebtsById | CashOperationUpdateRequest | 200, 400, 401, 500 | bearer | — | — | AccountingCashOperationsMutationService, AccountingCashOperationsService | cash-financing-api.ts |
| PUT /accounting/cash-loans/{id} | mobilePutAccountingCashLoansById | CashOperationUpdateRequest | 200, 400, 401, 500 | bearer | — | — | AccountingCashOperationsMutationService, AccountingCashOperationsService | cash-financing-api.ts |
| PUT /accounting/payment-types/{id} | mobilePutAccountingPaymentTypesById | PaymentTypeUpdateRequest | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | payment-types-api.ts |
| PUT /clients/{id} | mobilePutClientsById | ClienteUpdateRequest | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | clients-api.ts |
| PUT /providers/{id} | mobilePutProvidersById | ProveedorUpdateRequest | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | providers-api.ts |
| PUT /units/{id} | mobileUpdateUnit | (inline) | 200, 401, 403, 404, 500 | bearer | — | — | — | — |
| PUT /warehouses/{id} | mobilePutWarehousesById | AlmacenUpdateRequest | 200, 400, 401, 403, 404, 500 | bearer | — | — | — | warehouses-api.ts |
