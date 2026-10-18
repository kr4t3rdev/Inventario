# @tcp/mobile-v1-sdk@1.0.0

A TypeScript SDK client for the localhost API.

## Usage

First, install the SDK from npm.

```bash
npm install @tcp/mobile-v1-sdk --save
```

Next, try it out.


```ts
import {
  Configuration,
  AccountingAdvancesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileDeleteAccountingAdvancesByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingAdvancesApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
  } satisfies MobileDeleteAccountingAdvancesByIdRequest;

  try {
    const data = await api.mobileDeleteAccountingAdvancesById(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```


## Documentation

### API Endpoints

All URIs are relative to */api/mobile/v1*

| Class | Method | HTTP request | Description
| ----- | ------ | ------------ | -------------
*AccountingAdvancesApi* | [**mobileDeleteAccountingAdvancesById**](docs/AccountingAdvancesApi.md#mobiledeleteaccountingadvancesbyid) | **DELETE** /accounting/advances/{id} | Eliminar anticipo
*AccountingAdvancesApi* | [**mobileGetAccountingAdvances**](docs/AccountingAdvancesApi.md#mobilegetaccountingadvances) | **GET** /accounting/advances | Consultar anticipos
*AccountingAdvancesApi* | [**mobileGetAccountingAdvancesAvailable**](docs/AccountingAdvancesApi.md#mobilegetaccountingadvancesavailable) | **GET** /accounting/advances/available | Consultar anticipos disponibles
*AccountingAdvancesApi* | [**mobileGetAccountingAdvancesById**](docs/AccountingAdvancesApi.md#mobilegetaccountingadvancesbyid) | **GET** /accounting/advances/{id} | Consultar anticipo
*AccountingAdvancesApi* | [**mobilePostAccountingAdvances**](docs/AccountingAdvancesApi.md#mobilepostaccountingadvances) | **POST** /accounting/advances | Registrar anticipos
*AccountingAdvancesApi* | [**mobilePostAccountingAdvancesByIdEjecutar**](docs/AccountingAdvancesApi.md#mobilepostaccountingadvancesbyidejecutar) | **POST** /accounting/advances/{id}/ejecutar | Ejecutar anticipo reservado
*AccountingAdvancesApi* | [**mobilePostAccountingAdvancesByIdRevertir**](docs/AccountingAdvancesApi.md#mobilepostaccountingadvancesbyidrevertir) | **POST** /accounting/advances/{id}/revertir | Revertir ejecución de anticipo
*AccountingAdvancesApi* | [**mobilePutAccountingAdvancesById**](docs/AccountingAdvancesApi.md#mobileputaccountingadvancesbyid) | **PUT** /accounting/advances/{id} | Actualizar anticipo
*AccountingBankingApi* | [**mobileGetAccountingBankAccounts**](docs/AccountingBankingApi.md#mobilegetaccountingbankaccounts) | **GET** /accounting/bank-accounts | Consultar cuentas bancarias
*AccountingBankingApi* | [**mobileGetAccountingBankAccountsById**](docs/AccountingBankingApi.md#mobilegetaccountingbankaccountsbyid) | **GET** /accounting/bank-accounts/{id} | Consultar cuentas bancaria
*AccountingBankingApi* | [**mobileGetAccountingBankAccountsByIdNestedHistory**](docs/AccountingBankingApi.md#mobilegetaccountingbankaccountsbyidnestedhistory) | **GET** /accounting/bank-accounts/{id}/history | Consultar historial de cuentas bancarias
*AccountingBankingApi* | [**mobileGetAccountingBankAdjustments**](docs/AccountingBankingApi.md#mobilegetaccountingbankadjustments) | **GET** /accounting/bank-adjustments | Consultar ajustes bancarios
*AccountingBankingApi* | [**mobileGetAccountingBankTransfers**](docs/AccountingBankingApi.md#mobilegetaccountingbanktransfers) | **GET** /accounting/bank-transfers | Consultar transferencias bancarias
*AccountingBankingApi* | [**mobileGetAccountingBankTransfersById**](docs/AccountingBankingApi.md#mobilegetaccountingbanktransfersbyid) | **GET** /accounting/bank-transfers/{id} | Consultar transferencias bancaria
*AccountingBankingApi* | [**mobileGetAccountingBankTransfersByIdComprobante**](docs/AccountingBankingApi.md#mobilegetaccountingbanktransfersbyidcomprobante) | **GET** /accounting/bank-transfers/{id}/comprobante | Descargar comprobante de transferencias bancarias
*AccountingBankingApi* | [**mobilePostAccountingBankAdjustments**](docs/AccountingBankingApi.md#mobilepostaccountingbankadjustments) | **POST** /accounting/bank-adjustments | Registrar ajustes bancarios
*AccountingBankingApi* | [**mobilePostAccountingBankTransfers**](docs/AccountingBankingApi.md#mobilepostaccountingbanktransfers) | **POST** /accounting/bank-transfers | Registrar transferencias bancarias
*AccountingBankingApi* | [**mobilePostAccountingBankTransfersValidate**](docs/AccountingBankingApi.md#mobilepostaccountingbanktransfersvalidate) | **POST** /accounting/bank-transfers/validate | Validar transferencia bancaria
*AccountingCapitalApi* | [**mobileGetAccountingCapitalInjections**](docs/AccountingCapitalApi.md#mobilegetaccountingcapitalinjections) | **GET** /accounting/capital-injections | Consultar inyecciones de capital
*AccountingCapitalApi* | [**mobilePostAccountingCapitalInjections**](docs/AccountingCapitalApi.md#mobilepostaccountingcapitalinjections) | **POST** /accounting/capital-injections | Registrar inyecciones de capital
*AccountingCapitalApi* | [**mobilePostAccountingCapitalInjectionsByIdPayments**](docs/AccountingCapitalApi.md#mobilepostaccountingcapitalinjectionsbyidpayments) | **POST** /accounting/capital-injections/{id}/payments | Registrar pago de inyecciones de capital
*AccountingCashFinancingApi* | [**mobileGetAccountingCashDebts**](docs/AccountingCashFinancingApi.md#mobilegetaccountingcashdebts) | **GET** /accounting/cash-debts | Consultar deudas de efectivo
*AccountingCashFinancingApi* | [**mobileGetAccountingCashDebtsById**](docs/AccountingCashFinancingApi.md#mobilegetaccountingcashdebtsbyid) | **GET** /accounting/cash-debts/{id} | Consultar deudas de efectivo
*AccountingCashFinancingApi* | [**mobileGetAccountingCashDebtsStats**](docs/AccountingCashFinancingApi.md#mobilegetaccountingcashdebtsstats) | **GET** /accounting/cash-debts/stats | Consultar indicadores de deudas de efectivo
*AccountingCashFinancingApi* | [**mobileGetAccountingCashLoans**](docs/AccountingCashFinancingApi.md#mobilegetaccountingcashloans) | **GET** /accounting/cash-loans | Consultar préstamos de efectivo
*AccountingCashFinancingApi* | [**mobileGetAccountingCashLoansById**](docs/AccountingCashFinancingApi.md#mobilegetaccountingcashloansbyid) | **GET** /accounting/cash-loans/{id} | Consultar préstamos de efectivo
*AccountingCashFinancingApi* | [**mobileGetAccountingCashLoansByIdComprobante**](docs/AccountingCashFinancingApi.md#mobilegetaccountingcashloansbyidcomprobante) | **GET** /accounting/cash-loans/{id}/comprobante | Descargar comprobante de préstamos de efectivo
*AccountingCashFinancingApi* | [**mobileGetAccountingCashLoansByIdNestedHistory**](docs/AccountingCashFinancingApi.md#mobilegetaccountingcashloansbyidnestedhistory) | **GET** /accounting/cash-loans/{id}/history | Consultar historial de préstamos de efectivo
*AccountingCashFinancingApi* | [**mobileGetAccountingCashLoansStats**](docs/AccountingCashFinancingApi.md#mobilegetaccountingcashloansstats) | **GET** /accounting/cash-loans/stats | Consultar indicadores de préstamos de efectivo
*AccountingCashFinancingApi* | [**mobilePostAccountingCashDebts**](docs/AccountingCashFinancingApi.md#mobilepostaccountingcashdebts) | **POST** /accounting/cash-debts | Registrar deudas de efectivo
*AccountingCashFinancingApi* | [**mobilePostAccountingCashDebtsByIdPayments**](docs/AccountingCashFinancingApi.md#mobilepostaccountingcashdebtsbyidpayments) | **POST** /accounting/cash-debts/{id}/payments | Registrar pago de deudas de efectivo
*AccountingCashFinancingApi* | [**mobilePostAccountingCashLoans**](docs/AccountingCashFinancingApi.md#mobilepostaccountingcashloans) | **POST** /accounting/cash-loans | Registrar préstamos de efectivo
*AccountingCashFinancingApi* | [**mobilePostAccountingCashLoansByIdPayments**](docs/AccountingCashFinancingApi.md#mobilepostaccountingcashloansbyidpayments) | **POST** /accounting/cash-loans/{id}/payments | Registrar pago de préstamos de efectivo
*AccountingCashFinancingApi* | [**mobilePutAccountingCashDebtsById**](docs/AccountingCashFinancingApi.md#mobileputaccountingcashdebtsbyid) | **PUT** /accounting/cash-debts/{id} | Actualizar deudas de efectivo
*AccountingCashFinancingApi* | [**mobilePutAccountingCashLoansById**](docs/AccountingCashFinancingApi.md#mobileputaccountingcashloansbyid) | **PUT** /accounting/cash-loans/{id} | Actualizar préstamos de efectivo
*AccountingConfigurationApi* | [**mobileDeleteAccountingPaymentTypesById**](docs/AccountingConfigurationApi.md#mobiledeleteaccountingpaymenttypesbyid) | **DELETE** /accounting/payment-types/{id} | Eliminar tipos de pago
*AccountingConfigurationApi* | [**mobileGetAccountingExchangeMonedas**](docs/AccountingConfigurationApi.md#mobilegetaccountingexchangemonedas) | **GET** /accounting/exchange/monedas | Consultar monedas configuradas
*AccountingConfigurationApi* | [**mobileGetAccountingExchangeTasas**](docs/AccountingConfigurationApi.md#mobilegetaccountingexchangetasas) | **GET** /accounting/exchange/tasas | Consultar tasas de cambio
*AccountingConfigurationApi* | [**mobileGetAccountingLogs**](docs/AccountingConfigurationApi.md#mobilegetaccountinglogs) | **GET** /accounting/logs | Consultar eventos de auditoría contable
*AccountingConfigurationApi* | [**mobileGetAccountingPaymentTypes**](docs/AccountingConfigurationApi.md#mobilegetaccountingpaymenttypes) | **GET** /accounting/payment-types | Consultar tipos de pago
*AccountingConfigurationApi* | [**mobileGetAccountingPaymentTypesAvailableAccounts**](docs/AccountingConfigurationApi.md#mobilegetaccountingpaymenttypesavailableaccounts) | **GET** /accounting/payment-types/available-accounts | Consultar cuentas disponibles para tipos de pago
*AccountingConfigurationApi* | [**mobileGetAccountingPaymentTypesById**](docs/AccountingConfigurationApi.md#mobilegetaccountingpaymenttypesbyid) | **GET** /accounting/payment-types/{id} | Consultar tipos de pago
*AccountingConfigurationApi* | [**mobilePutAccountingPaymentTypesById**](docs/AccountingConfigurationApi.md#mobileputaccountingpaymenttypesbyid) | **PUT** /accounting/payment-types/{id} | Actualizar tipos de pago
*AccountingReceivablesAndPayablesApi* | [**mobileGetAccountingAccountsPayable**](docs/AccountingReceivablesAndPayablesApi.md#mobilegetaccountingaccountspayable) | **GET** /accounting/accounts-payable | Consultar cuentas por pagar
*AccountingReceivablesAndPayablesApi* | [**mobileGetAccountingAccountsReceivable**](docs/AccountingReceivablesAndPayablesApi.md#mobilegetaccountingaccountsreceivable) | **GET** /accounting/accounts-receivable | Consultar cuentas por cobrar
*AccountingReceivablesAndPayablesApi* | [**mobileGetAccountingAccountsReceivableMetrics**](docs/AccountingReceivablesAndPayablesApi.md#mobilegetaccountingaccountsreceivablemetrics) | **GET** /accounting/accounts-receivable/metrics | Consultar métricas de cuentas por cobrar
*AccountingReconciliationApi* | [**mobileGetAccountingReconciliationExpenses**](docs/AccountingReconciliationApi.md#mobilegetaccountingreconciliationexpenses) | **GET** /accounting/reconciliation/expenses | Consultar conciliación de gastos
*AccountingReconciliationApi* | [**mobileGetAccountingReconciliationExpensesHistory**](docs/AccountingReconciliationApi.md#mobilegetaccountingreconciliationexpenseshistory) | **GET** /accounting/reconciliation/expenses-history | Consultar historial de conciliaciones de gastos
*AccountingReconciliationApi* | [**mobileGetAccountingReconciliationExpensesNestedHistory**](docs/AccountingReconciliationApi.md#mobilegetaccountingreconciliationexpensesnestedhistory) | **GET** /accounting/reconciliation/expenses/history | Consultar historial paginado de conciliaciones de gastos
*AccountingReconciliationApi* | [**mobileGetAccountingReconciliationSales**](docs/AccountingReconciliationApi.md#mobilegetaccountingreconciliationsales) | **GET** /accounting/reconciliation/sales | Consultar conciliación de ventas
*AccountingReconciliationApi* | [**mobileGetAccountingReconciliationSalesHistory**](docs/AccountingReconciliationApi.md#mobilegetaccountingreconciliationsaleshistory) | **GET** /accounting/reconciliation/sales-history | Consultar historial de conciliaciones de ventas
*AccountingReconciliationApi* | [**mobileGetAccountingReconciliationSalesNestedHistory**](docs/AccountingReconciliationApi.md#mobilegetaccountingreconciliationsalesnestedhistory) | **GET** /accounting/reconciliation/sales/history | Consultar historial paginado de conciliaciones de ventas
*AccountingReconciliationApi* | [**mobileGetAccountingReconciliationServices**](docs/AccountingReconciliationApi.md#mobilegetaccountingreconciliationservices) | **GET** /accounting/reconciliation/services | Consultar conciliación de servicios
*AccountingReconciliationApi* | [**mobileGetAccountingReconciliationServicesHistory**](docs/AccountingReconciliationApi.md#mobilegetaccountingreconciliationserviceshistory) | **GET** /accounting/reconciliation/services-history | Consultar historial de conciliaciones de servicios
*AccountingReconciliationApi* | [**mobileGetAccountingReconciliationServicesNestedHistory**](docs/AccountingReconciliationApi.md#mobilegetaccountingreconciliationservicesnestedhistory) | **GET** /accounting/reconciliation/services/history | Consultar historial paginado de conciliaciones de servicios
*AccountingReconciliationApi* | [**mobileGetAccountingReconciliationStats**](docs/AccountingReconciliationApi.md#mobilegetaccountingreconciliationstats) | **GET** /accounting/reconciliation/stats | Consultar panel de conciliaciones
*AccountingReconciliationApi* | [**mobilePostAccountingReconciliationExpenses**](docs/AccountingReconciliationApi.md#mobilepostaccountingreconciliationexpenses) | **POST** /accounting/reconciliation/expenses | Registrar conciliación de gastos
*AccountingReconciliationApi* | [**mobilePostAccountingReconciliationSales**](docs/AccountingReconciliationApi.md#mobilepostaccountingreconciliationsales) | **POST** /accounting/reconciliation/sales | Registrar conciliación de ventas
*AccountingReconciliationApi* | [**mobilePostAccountingReconciliationServices**](docs/AccountingReconciliationApi.md#mobilepostaccountingreconciliationservices) | **POST** /accounting/reconciliation/services | Registrar conciliación de servicios
*AccountingReportsApi* | [**mobileGetAccountingAdvancesReportsCustomers**](docs/AccountingReportsApi.md#mobilegetaccountingadvancesreportscustomers) | **GET** /accounting/advances/reports/customers | Consultar anticipos de clientes
*AccountingReportsApi* | [**mobileGetAccountingAdvancesReportsProviders**](docs/AccountingReportsApi.md#mobilegetaccountingadvancesreportsproviders) | **GET** /accounting/advances/reports/providers | Consultar anticipos a proveedores
*AccountingReportsApi* | [**mobileGetAccountingAdvancesReportsSummary**](docs/AccountingReportsApi.md#mobilegetaccountingadvancesreportssummary) | **GET** /accounting/advances/reports/summary | Consultar resumen de anticipos
*AccountingReportsApi* | [**mobileGetAccountingReportsClientAccountAnalysis**](docs/AccountingReportsApi.md#mobilegetaccountingreportsclientaccountanalysis) | **GET** /accounting/reports/client-account-analysis | Consultar análisis de cuenta de cliente
*AccountingReportsApi* | [**mobileGetAccountingReportsExchange**](docs/AccountingReportsApi.md#mobilegetaccountingreportsexchange) | **GET** /accounting/reports/exchange | Consultar reporte de cambio de moneda
*AccountingReportsApi* | [**mobileGetAccountingReportsExchangeImpact**](docs/AccountingReportsApi.md#mobilegetaccountingreportsexchangeimpact) | **GET** /accounting/reports/exchange-impact | Consultar impacto de variaciones cambiarias
*AccountingReportsApi* | [**mobileGetAccountingReportsMovements**](docs/AccountingReportsApi.md#mobilegetaccountingreportsmovements) | **GET** /accounting/reports/movements | Consultar movimientos contables
*AccountingReportsApi* | [**mobileGetAccountingReportsOverdueInvoices**](docs/AccountingReportsApi.md#mobilegetaccountingreportsoverdueinvoices) | **GET** /accounting/reports/overdue-invoices | Consultar facturas vencidas
*AccountingReportsApi* | [**mobileGetAccountingReportsSummary**](docs/AccountingReportsApi.md#mobilegetaccountingreportssummary) | **GET** /accounting/reports/summary | Consultar resumen financiero
*AccountingReportsApi* | [**mobileGetAccountingReportsTransfers**](docs/AccountingReportsApi.md#mobilegetaccountingreportstransfers) | **GET** /accounting/reports/transfers | Consultar reporte de transferencias
*AdminApi* | [**mobileActivateAdminLicense**](docs/AdminApi.md#mobileactivateadminlicense) | **POST** /admin/licenses/activate | Activar una licencia
*AdminApi* | [**mobileActivateAdminTenant**](docs/AdminApi.md#mobileactivateadmintenant) | **POST** /admin/tenants/activate | Activar una empresa
*AdminApi* | [**mobileActivateAdminUser**](docs/AdminApi.md#mobileactivateadminuser) | **POST** /admin/users/activate | Activar un usuario
*AdminApi* | [**mobileApproveAdminMembership**](docs/AdminApi.md#mobileapproveadminmembership) | **POST** /admin/memberships/approve | Aprobar solicitud de membresía
*AdminApi* | [**mobileAssignAdminTenantLicense**](docs/AdminApi.md#mobileassignadmintenantlicense) | **POST** /admin/tenants/license/assign | Asignar una licencia a una empresa
*AdminApi* | [**mobileAssignAdminUserTenant**](docs/AdminApi.md#mobileassignadminusertenant) | **POST** /admin/users/assign-tenant | Asignar o cambiar la empresa de un usuario
*AdminApi* | [**mobileChangeAdminUserTenantRole**](docs/AdminApi.md#mobilechangeadminusertenantrole) | **PATCH** /admin/users/change-tenant-role | Cambiar el rol de un usuario dentro de una empresa
*AdminApi* | [**mobileDeactivateAdminLicense**](docs/AdminApi.md#mobiledeactivateadminlicense) | **POST** /admin/licenses/deactivate | Desactivar una licencia
*AdminApi* | [**mobileDeactivateAdminTenant**](docs/AdminApi.md#mobiledeactivateadmintenant) | **POST** /admin/tenants/deactivate | Desactivar una empresa
*AdminApi* | [**mobileDeactivateAdminTenantLicense**](docs/AdminApi.md#mobiledeactivateadmintenantlicense) | **POST** /admin/tenants/license/deactivate | Desactivar la licencia de una empresa
*AdminApi* | [**mobileDeactivateAdminUser**](docs/AdminApi.md#mobiledeactivateadminuser) | **POST** /admin/users/deactivate | Desactivar un usuario
*AdminApi* | [**mobileDeleteAdminLicense**](docs/AdminApi.md#mobiledeleteadminlicense) | **POST** /admin/licenses/delete | Eliminar una licencia
*AdminApi* | [**mobileDeleteAdminTenant**](docs/AdminApi.md#mobiledeleteadmintenant) | **POST** /admin/tenants/delete | Eliminar una empresa
*AdminApi* | [**mobileDeleteAdminUser**](docs/AdminApi.md#mobiledeleteadminuser) | **POST** /admin/users/delete | Eliminar un usuario
*AdminApi* | [**mobileGetAdminActivityLogs**](docs/AdminApi.md#mobilegetadminactivitylogs) | **GET** /admin/activity-logs | Obtener el registro de actividad de los usuarios
*AdminApi* | [**mobileGetAdminHealth**](docs/AdminApi.md#mobilegetadminhealth) | **GET** /admin/health | Consultar salud del sistema
*AdminApi* | [**mobileGetAdminLicenseStats**](docs/AdminApi.md#mobilegetadminlicensestats) | **GET** /admin/licenses/stats | Consultar métricas de licencias
*AdminApi* | [**mobileGetAdminLicenses**](docs/AdminApi.md#mobilegetadminlicenses) | **GET** /admin/licenses | Listar licencias con filtros
*AdminApi* | [**mobileGetAdminPendingMemberships**](docs/AdminApi.md#mobilegetadminpendingmemberships) | **GET** /admin/memberships/pending | Listar solicitudes de membresía pendientes
*AdminApi* | [**mobileGetAdminSessions**](docs/AdminApi.md#mobilegetadminsessions) | **GET** /admin/sessions | Listar las sesiones registradas
*AdminApi* | [**mobileGetAdminTenantDetail**](docs/AdminApi.md#mobilegetadmintenantdetail) | **GET** /admin/tenants/detail | Obtener el detalle de una empresa
*AdminApi* | [**mobileGetAdminTenantLicense**](docs/AdminApi.md#mobilegetadmintenantlicense) | **GET** /admin/tenants/license | Ver las licencias de una empresa
*AdminApi* | [**mobileGetAdminTenantUsers**](docs/AdminApi.md#mobilegetadmintenantusers) | **GET** /admin/tenants/users | Listar los usuarios de una empresa
*AdminApi* | [**mobileGetAdminTenants**](docs/AdminApi.md#mobilegetadmintenants) | **GET** /admin/tenants | Listar empresas de la plataforma
*AdminApi* | [**mobileGetAdminUserDetail**](docs/AdminApi.md#mobilegetadminuserdetail) | **GET** /admin/users/detail | Obtener el detalle de un usuario
*AdminApi* | [**mobileGetAdminUserLoginHistory**](docs/AdminApi.md#mobilegetadminuserloginhistory) | **GET** /admin/users/login-history | Obtener el historial de sesiones de un usuario
*AdminApi* | [**mobileGetAdminUsers**](docs/AdminApi.md#mobilegetadminusers) | **GET** /admin/users | Listar usuarios de la plataforma
*AdminApi* | [**mobileLockAdminUser**](docs/AdminApi.md#mobilelockadminuser) | **POST** /admin/users/lock | Bloquear usuario por 24 horas
*AdminApi* | [**mobileRejectAdminMembership**](docs/AdminApi.md#mobilerejectadminmembership) | **POST** /admin/memberships/reject | Rechazar solicitud de membresía
*AdminApi* | [**mobileRemoveAdminTenantUser**](docs/AdminApi.md#mobileremoveadmintenantuser) | **POST** /admin/tenants/remove-user | Quitar un usuario de una empresa
*AdminApi* | [**mobileRenewAdminLicense**](docs/AdminApi.md#mobilerenewadminlicense) | **POST** /admin/licenses/renew | Renovar una licencia
*AdminApi* | [**mobileResendAdminUserVerification**](docs/AdminApi.md#mobileresendadminuserverification) | **POST** /admin/users/resend-verification | Reenviar el email de verificación
*AdminApi* | [**mobileResetAdminUserPassword**](docs/AdminApi.md#mobileresetadminuserpassword) | **POST** /admin/users/reset-password | Enviar enlace de restablecimiento de contraseña
*AdminApi* | [**mobileRevokeAdminSession**](docs/AdminApi.md#mobilerevokeadminsession) | **POST** /admin/sessions/revoke | Revocar una sesión específica
*AdminApi* | [**mobileRevokeAdminUserSessions**](docs/AdminApi.md#mobilerevokeadminusersessions) | **POST** /admin/users/revoke-sessions | Revocar las sesiones activas de un usuario
*AdminApi* | [**mobileUnlockAdminUser**](docs/AdminApi.md#mobileunlockadminuser) | **POST** /admin/users/unlock | Desbloquear usuario
*AdminApi* | [**mobileUpdateAdminTenant**](docs/AdminApi.md#mobileupdateadmintenant) | **PATCH** /admin/tenants/update | Editar los datos de una empresa
*AdminApi* | [**mobileUpdateAdminTenantLicense**](docs/AdminApi.md#mobileupdateadmintenantlicense) | **PATCH** /admin/tenants/license/update | Actualizar la licencia de una empresa
*AdminApi* | [**mobileUpdateAdminUser**](docs/AdminApi.md#mobileupdateadminuser) | **PATCH** /admin/users/update | Editar nombre, email o rol de un usuario
*AdminApi* | [**mobileVerifyAdminUserEmail**](docs/AdminApi.md#mobileverifyadminuseremail) | **POST** /admin/users/verify-email | Marcar el email como verificado
*AuthApi* | [**mobileGetAuthMe**](docs/AuthApi.md#mobilegetauthme) | **GET** /auth/me | Consultar perfil autenticado
*AuthApi* | [**mobileGetAuthTenants**](docs/AuthApi.md#mobilegetauthtenants) | **GET** /auth/tenants | Listar tenants accesibles
*AuthApi* | [**mobilePostAuthLogin**](docs/AuthApi.md#mobilepostauthlogin) | **POST** /auth/login | Iniciar sesión móvil
*AuthApi* | [**mobilePostAuthLogout**](docs/AuthApi.md#mobilepostauthlogout) | **POST** /auth/logout | Cerrar sesión actual
*AuthApi* | [**mobilePostAuthRefresh**](docs/AuthApi.md#mobilepostauthrefresh) | **POST** /auth/refresh | Renovar tokens de sesión
*AuthApi* | [**mobilePostAuthRegister**](docs/AuthApi.md#mobilepostauthregister) | **POST** /auth/register | Registrar cuenta móvil
*AuthApi* | [**mobilePostAuthTenants**](docs/AuthApi.md#mobilepostauthtenants) | **POST** /auth/tenants | Cambiar tenant activo
*CategoriasApi* | [**mobileGetCategoriaById**](docs/CategoriasApi.md#mobilegetcategoriabyid) | **GET** /categorias/{id} | Detalle de categoría
*CategoriasApi* | [**mobileListCategorias**](docs/CategoriasApi.md#mobilelistcategorias) | **GET** /categorias | Listar categorías
*ClientsApi* | [**mobileDeleteClientsById**](docs/ClientsApi.md#mobiledeleteclientsbyid) | **DELETE** /clients/{id} | Eliminar cliente
*ClientsApi* | [**mobileGetClients**](docs/ClientsApi.md#mobilegetclients) | **GET** /clients | Listar clientes
*ClientsApi* | [**mobileGetClientsById**](docs/ClientsApi.md#mobilegetclientsbyid) | **GET** /clients/{id} | Consultar cliente
*ClientsApi* | [**mobilePostClientsCreate**](docs/ClientsApi.md#mobilepostclientscreate) | **POST** /clients/create | Crear cliente
*ClientsApi* | [**mobilePutClientsById**](docs/ClientsApi.md#mobileputclientsbyid) | **PUT** /clients/{id} | Editar cliente
*ComprasApi* | [**mobileGetComprasById**](docs/ComprasApi.md#mobilegetcomprasbyid) | **GET** /compras/{id} | Detalle de compra
*ComprasApi* | [**mobileListCompras**](docs/ComprasApi.md#mobilelistcompras) | **GET** /compras | Listar compras
*ContratosApi* | [**mobileGetContratosById**](docs/ContratosApi.md#mobilegetcontratosbyid) | **GET** /contratos/{id} | Detalle de contrato
*ContratosApi* | [**mobileListContratos**](docs/ContratosApi.md#mobilelistcontratos) | **GET** /contratos | Listar contratos
*DashboardApi* | [**mobileGetDashboardDailyAverage**](docs/DashboardApi.md#mobilegetdashboarddailyaverage) | **GET** /dashboard/daily-average | Consultar promedio diario de ingresos
*DashboardApi* | [**mobileGetDashboardIncomeExpenses**](docs/DashboardApi.md#mobilegetdashboardincomeexpenses) | **GET** /dashboard/income-expenses | Consultar ingresos vs gastos del panel
*DashboardApi* | [**mobileGetDashboardInventoryValue**](docs/DashboardApi.md#mobilegetdashboardinventoryvalue) | **GET** /dashboard/inventory-value | Consultar valor total del inventario
*DashboardApi* | [**mobileGetDashboardLowStock**](docs/DashboardApi.md#mobilegetdashboardlowstock) | **GET** /dashboard/low-stock | Consultar productos con stock bajo
*DashboardApi* | [**mobileGetDashboardStats**](docs/DashboardApi.md#mobilegetdashboardstats) | **GET** /dashboard/stats | Consultar indicadores del panel principal
*DashboardApi* | [**mobileGetDashboardStockDistribution**](docs/DashboardApi.md#mobilegetdashboardstockdistribution) | **GET** /dashboard/stock-distribution | Consultar distribución de stock
*DashboardApi* | [**mobileGetDashboardTodaySales**](docs/DashboardApi.md#mobilegetdashboardtodaysales) | **GET** /dashboard/today-sales | Consultar ventas de hoy
*DashboardApi* | [**mobileGetDashboardTopProducts**](docs/DashboardApi.md#mobilegetdashboardtopproducts) | **GET** /dashboard/top-products | Consultar productos más vendidos
*DashboardApi* | [**mobileGetDashboardTransfers**](docs/DashboardApi.md#mobilegetdashboardtransfers) | **GET** /dashboard/transfers | Consultar transferencias entre ubicaciones
*EmpleadosApi* | [**mobileGetEmpleadosById**](docs/EmpleadosApi.md#mobilegetempleadosbyid) | **GET** /empleados/{id} | Detalle de empleado
*EmpleadosApi* | [**mobileListEmpleados**](docs/EmpleadosApi.md#mobilelistempleados) | **GET** /empleados | Listar empleados
*FacturasApi* | [**mobileGetFacturasById**](docs/FacturasApi.md#mobilegetfacturasbyid) | **GET** /facturas/{id} | Detalle de factura
*FacturasApi* | [**mobileListFacturas**](docs/FacturasApi.md#mobilelistfacturas) | **GET** /facturas | Listar facturas
*GastosApi* | [**mobileGetGastosById**](docs/GastosApi.md#mobilegetgastosbyid) | **GET** /gastos/{id} | Detalle de gasto
*GastosApi* | [**mobileListGastos**](docs/GastosApi.md#mobilelistgastos) | **GET** /gastos | Listar gastos
*ListasPreciosApi* | [**mobileGetListaPrecioById**](docs/ListasPreciosApi.md#mobilegetlistapreciobyid) | **GET** /listas-precios/{id} | Detalle de lista de precios
*ListasPreciosApi* | [**mobileListListasPrecios**](docs/ListasPreciosApi.md#mobilelistlistasprecios) | **GET** /listas-precios | Listar listas de precios
*MermasApi* | [**mobileGetMermasById**](docs/MermasApi.md#mobilegetmermasbyid) | **GET** /mermas/{id} | Detalle de merma
*MermasApi* | [**mobileListMermas**](docs/MermasApi.md#mobilelistmermas) | **GET** /mermas | Listar mermas
*OfertasApi* | [**mobileGetOfertasById**](docs/OfertasApi.md#mobilegetofertasbyid) | **GET** /ofertas/{id} | Detalle de oferta
*OfertasApi* | [**mobileListOfertas**](docs/OfertasApi.md#mobilelistofertas) | **GET** /ofertas | Listar ofertas
*ProduccinApi* | [**mobileGetProduccionById**](docs/ProduccinApi.md#mobilegetproduccionbyid) | **GET** /produccion/{id} | Detalle de orden de producción
*ProduccinApi* | [**mobileListProduccion**](docs/ProduccinApi.md#mobilelistproduccion) | **GET** /produccion | Listar órdenes de producción
*ProductsApi* | [**mobileGetProducts**](docs/ProductsApi.md#mobilegetproducts) | **GET** /products | Consultar productos
*ProductsApi* | [**mobileGetProductsById**](docs/ProductsApi.md#mobilegetproductsbyid) | **GET** /products/{id} | Consultar producto
*ProductsApi* | [**mobileGetProductsStock**](docs/ProductsApi.md#mobilegetproductsstock) | **GET** /products/stock | Consultar existencias por ubicación
*ProvidersApi* | [**mobileDeleteProvidersById**](docs/ProvidersApi.md#mobiledeleteprovidersbyid) | **DELETE** /providers/{id} | Eliminar proveedor
*ProvidersApi* | [**mobileGetProviders**](docs/ProvidersApi.md#mobilegetproviders) | **GET** /providers | Listar proveedores
*ProvidersApi* | [**mobileGetProvidersById**](docs/ProvidersApi.md#mobilegetprovidersbyid) | **GET** /providers/{id} | Consultar proveedor
*ProvidersApi* | [**mobilePostProvidersCreate**](docs/ProvidersApi.md#mobilepostproviderscreate) | **POST** /providers/create | Crear proveedor
*ProvidersApi* | [**mobilePutProvidersById**](docs/ProvidersApi.md#mobileputprovidersbyid) | **PUT** /providers/{id} | Editar proveedor
*PuntosVentaApi* | [**mobileGetPuntoVentaById**](docs/PuntosVentaApi.md#mobilegetpuntoventabyid) | **GET** /puntos-venta/{id} | Detalle de punto de venta
*PuntosVentaApi* | [**mobileListPuntosVenta**](docs/PuntosVentaApi.md#mobilelistpuntosventa) | **GET** /puntos-venta | Listar puntos de venta
*ReparacionesApi* | [**mobileGetReparacionesById**](docs/ReparacionesApi.md#mobilegetreparacionesbyid) | **GET** /reparaciones/{id} | Detalle de orden de reparación
*ReparacionesApi* | [**mobileListReparaciones**](docs/ReparacionesApi.md#mobilelistreparaciones) | **GET** /reparaciones | Listar órdenes de reparación
*SalesApi* | [**mobileGetSales**](docs/SalesApi.md#mobilegetsales) | **GET** /sales | Consultar ventas
*SalesApi* | [**mobileGetSalesById**](docs/SalesApi.md#mobilegetsalesbyid) | **GET** /sales/{id} | Consultar venta
*SalesApi* | [**mobilePatchSalesByIdUpdate**](docs/SalesApi.md#mobilepatchsalesbyidupdate) | **PATCH** /sales/{id}/update | Actualizar datos de venta
*SalesApi* | [**mobilePostSalesByIdCancel**](docs/SalesApi.md#mobilepostsalesbyidcancel) | **POST** /sales/{id}/cancel | Anular venta
*SalesApi* | [**mobilePostSalesCreate**](docs/SalesApi.md#mobilepostsalescreate) | **POST** /sales/create | Registrar venta
*ServiciosApi* | [**mobileGetServiciosById**](docs/ServiciosApi.md#mobilegetserviciosbyid) | **GET** /servicios/{id} | Detalle de servicio
*ServiciosApi* | [**mobileListServicios**](docs/ServiciosApi.md#mobilelistservicios) | **GET** /servicios | Listar servicios
*TransferenciasApi* | [**mobileGetTransferenciasById**](docs/TransferenciasApi.md#mobilegettransferenciasbyid) | **GET** /transferencias/{id} | Detalle de transferencia
*TransferenciasApi* | [**mobileListTransferencias**](docs/TransferenciasApi.md#mobilelisttransferencias) | **GET** /transferencias | Listar transferencias
*UnitsApi* | [**mobileCreateUnit**](docs/UnitsApi.md#mobilecreateunitoperation) | **POST** /units/create | Crear unidad
*UnitsApi* | [**mobileDeleteUnit**](docs/UnitsApi.md#mobiledeleteunit) | **DELETE** /units/{id} | Eliminar unidad
*UnitsApi* | [**mobileListUnits**](docs/UnitsApi.md#mobilelistunits) | **GET** /units | Listar unidades
*UnitsApi* | [**mobileUpdateUnit**](docs/UnitsApi.md#mobileupdateunitoperation) | **PUT** /units/{id} | Actualizar unidad
*WarehousesApi* | [**mobileDeleteWarehousesById**](docs/WarehousesApi.md#mobiledeletewarehousesbyid) | **DELETE** /warehouses/{id} | Eliminar almacén
*WarehousesApi* | [**mobileGetWarehouses**](docs/WarehousesApi.md#mobilegetwarehouses) | **GET** /warehouses | Listar almacenes
*WarehousesApi* | [**mobileGetWarehousesById**](docs/WarehousesApi.md#mobilegetwarehousesbyid) | **GET** /warehouses/{id} | Consultar almacén
*WarehousesApi* | [**mobilePostWarehousesCreate**](docs/WarehousesApi.md#mobilepostwarehousescreate) | **POST** /warehouses/create | Crear almacén
*WarehousesApi* | [**mobilePutWarehousesById**](docs/WarehousesApi.md#mobileputwarehousesbyid) | **PUT** /warehouses/{id} | Editar almacén


### Models

- [AccountPayable](docs/AccountPayable.md)
- [AccountReceivable](docs/AccountReceivable.md)
- [AccountingAdvancesIdEjecutarPostRequest](docs/AccountingAdvancesIdEjecutarPostRequest.md)
- [AccountingAdvancesIdPutRequest](docs/AccountingAdvancesIdPutRequest.md)
- [AccountingAdvancesIdRevertirPostRequest](docs/AccountingAdvancesIdRevertirPostRequest.md)
- [AccountingAdvancesPostRequest](docs/AccountingAdvancesPostRequest.md)
- [AdminActivityLogItem](docs/AdminActivityLogItem.md)
- [AdminHealthResponse](docs/AdminHealthResponse.md)
- [AdminHealthResponseLicenses](docs/AdminHealthResponseLicenses.md)
- [AdminHealthResponseSessions](docs/AdminHealthResponseSessions.md)
- [AdminHealthResponseTenants](docs/AdminHealthResponseTenants.md)
- [AdminHealthResponseUsers](docs/AdminHealthResponseUsers.md)
- [AdminHealthResponseUsersByRoleInner](docs/AdminHealthResponseUsersByRoleInner.md)
- [AdminHealthResponseUsersComparison](docs/AdminHealthResponseUsersComparison.md)
- [AdminHealthResponseUsersTrendInner](docs/AdminHealthResponseUsersTrendInner.md)
- [AdminLicenciaIdRequest](docs/AdminLicenciaIdRequest.md)
- [AdminLicenseItem](docs/AdminLicenseItem.md)
- [AdminLicenseItemCreatedByUser](docs/AdminLicenseItemCreatedByUser.md)
- [AdminLicenseItemTenant](docs/AdminLicenseItemTenant.md)
- [AdminLicenseManagerItem](docs/AdminLicenseManagerItem.md)
- [AdminLicenseSummary](docs/AdminLicenseSummary.md)
- [AdminPendingUserItem](docs/AdminPendingUserItem.md)
- [AdminRemoveTenantUserRequest](docs/AdminRemoveTenantUserRequest.md)
- [AdminRevokeSessionRequest](docs/AdminRevokeSessionRequest.md)
- [AdminSessionItem](docs/AdminSessionItem.md)
- [AdminSessionItemUser](docs/AdminSessionItemUser.md)
- [AdminTenantDetail](docs/AdminTenantDetail.md)
- [AdminTenantIdRequest](docs/AdminTenantIdRequest.md)
- [AdminTenantItem](docs/AdminTenantItem.md)
- [AdminTenantItemCount](docs/AdminTenantItemCount.md)
- [AdminTenantLicenseItem](docs/AdminTenantLicenseItem.md)
- [AdminTenantLicenseItemPlan](docs/AdminTenantLicenseItemPlan.md)
- [AdminTenantLite](docs/AdminTenantLite.md)
- [AdminTenantUserItem](docs/AdminTenantUserItem.md)
- [AdminUserDetail](docs/AdminUserDetail.md)
- [AdminUserIdRequest](docs/AdminUserIdRequest.md)
- [AdminUserItem](docs/AdminUserItem.md)
- [AdminUserItemSalesAgentBalance](docs/AdminUserItemSalesAgentBalance.md)
- [AdminUserItemSalesAgentProfile](docs/AdminUserItemSalesAgentProfile.md)
- [AdminUserLite](docs/AdminUserLite.md)
- [AdminUserMembership](docs/AdminUserMembership.md)
- [AdminUserMembershipTenant](docs/AdminUserMembershipTenant.md)
- [AdminUserStatus](docs/AdminUserStatus.md)
- [AdminUserSummary](docs/AdminUserSummary.md)
- [Advance](docs/Advance.md)
- [AdvanceWorkflowResult](docs/AdvanceWorkflowResult.md)
- [AjusteBancario](docs/AjusteBancario.md)
- [Almacen](docs/Almacen.md)
- [AlmacenCreateRequest](docs/AlmacenCreateRequest.md)
- [AlmacenDeleteResponse](docs/AlmacenDeleteResponse.md)
- [AlmacenListResponse](docs/AlmacenListResponse.md)
- [AlmacenUpdateRequest](docs/AlmacenUpdateRequest.md)
- [ApiError](docs/ApiError.md)
- [ApproveAdminMembershipRequest](docs/ApproveAdminMembershipRequest.md)
- [AssignAdminTenantLicenseRequest](docs/AssignAdminTenantLicenseRequest.md)
- [AssignAdminUserTenantRequest](docs/AssignAdminUserTenantRequest.md)
- [AuditLog](docs/AuditLog.md)
- [AuthSession](docs/AuthSession.md)
- [AuthenticatedUser](docs/AuthenticatedUser.md)
- [BankAccount](docs/BankAccount.md)
- [BankAccountHistorySummary](docs/BankAccountHistorySummary.md)
- [BankAccountTransaction](docs/BankAccountTransaction.md)
- [BankAdjustment](docs/BankAdjustment.md)
- [BankAdjustmentRequest](docs/BankAdjustmentRequest.md)
- [BankTransfer](docs/BankTransfer.md)
- [BankTransferCreateRequest](docs/BankTransferCreateRequest.md)
- [BankTransferValidationRequest](docs/BankTransferValidationRequest.md)
- [CapitalInjection](docs/CapitalInjection.md)
- [CapitalInjectionCreateRequest](docs/CapitalInjectionCreateRequest.md)
- [CapitalPaymentRequest](docs/CapitalPaymentRequest.md)
- [CashDebt](docs/CashDebt.md)
- [CashDebtCreateRequest](docs/CashDebtCreateRequest.md)
- [CashLoan](docs/CashLoan.md)
- [CashLoanCreateRequest](docs/CashLoanCreateRequest.md)
- [CashOperationUpdateRequest](docs/CashOperationUpdateRequest.md)
- [CashPaymentRequest](docs/CashPaymentRequest.md)
- [Categoria](docs/Categoria.md)
- [ChangeAdminUserTenantRoleRequest](docs/ChangeAdminUserTenantRoleRequest.md)
- [Cliente](docs/Cliente.md)
- [ClienteCreateRequest](docs/ClienteCreateRequest.md)
- [ClienteDeleteResponse](docs/ClienteDeleteResponse.md)
- [ClienteListResponse](docs/ClienteListResponse.md)
- [ClienteUpdateRequest](docs/ClienteUpdateRequest.md)
- [Compra](docs/Compra.md)
- [Contrato](docs/Contrato.md)
- [Currency](docs/Currency.md)
- [DashboardDatosPorMes](docs/DashboardDatosPorMes.md)
- [DashboardDatosPorSemana](docs/DashboardDatosPorSemana.md)
- [DashboardDistribucionStockItem](docs/DashboardDistribucionStockItem.md)
- [DashboardIncomeExpensePoint](docs/DashboardIncomeExpensePoint.md)
- [DashboardIncomeExpenseResponse](docs/DashboardIncomeExpenseResponse.md)
- [DashboardLowStockItem](docs/DashboardLowStockItem.md)
- [DashboardLowStockResponse](docs/DashboardLowStockResponse.md)
- [DashboardProductoMasVendido](docs/DashboardProductoMasVendido.md)
- [DashboardProductoStockBajo](docs/DashboardProductoStockBajo.md)
- [DashboardProductoStockBajoCategoria](docs/DashboardProductoStockBajoCategoria.md)
- [DashboardProductoStockBajoUnidad](docs/DashboardProductoStockBajoUnidad.md)
- [DashboardStockDistributionResponse](docs/DashboardStockDistributionResponse.md)
- [DashboardStockSlice](docs/DashboardStockSlice.md)
- [DashboardTopProduct](docs/DashboardTopProduct.md)
- [DashboardTopProductsResponse](docs/DashboardTopProductsResponse.md)
- [DashboardTransferItem](docs/DashboardTransferItem.md)
- [DashboardTransferenciasStats](docs/DashboardTransferenciasStats.md)
- [DashboardTransfersResponse](docs/DashboardTransfersResponse.md)
- [DashboardValueResponse](docs/DashboardValueResponse.md)
- [DashboardVentasDiarias](docs/DashboardVentasDiarias.md)
- [DeleteAccountingAdvancesIdResponse](docs/DeleteAccountingAdvancesIdResponse.md)
- [DeleteAccountingPaymentTypesIdResponse](docs/DeleteAccountingPaymentTypesIdResponse.md)
- [DeleteUnitResponse](docs/DeleteUnitResponse.md)
- [Empleado](docs/Empleado.md)
- [ExchangeRate](docs/ExchangeRate.md)
- [ExpenseDistributionRequest](docs/ExpenseDistributionRequest.md)
- [ExpenseReconciliationRequest](docs/ExpenseReconciliationRequest.md)
- [Factura](docs/Factura.md)
- [Gasto](docs/Gasto.md)
- [GetAccountingAccountsPayableResponse](docs/GetAccountingAccountsPayableResponse.md)
- [GetAccountingAccountsReceivableMetricsResponse](docs/GetAccountingAccountsReceivableMetricsResponse.md)
- [GetAccountingAccountsReceivableResponse](docs/GetAccountingAccountsReceivableResponse.md)
- [GetAccountingAdvancesAvailableResponse](docs/GetAccountingAdvancesAvailableResponse.md)
- [GetAccountingAdvancesIdResponse](docs/GetAccountingAdvancesIdResponse.md)
- [GetAccountingAdvancesReportsCustomersResponse](docs/GetAccountingAdvancesReportsCustomersResponse.md)
- [GetAccountingAdvancesReportsProvidersResponse](docs/GetAccountingAdvancesReportsProvidersResponse.md)
- [GetAccountingAdvancesReportsSummaryResponse](docs/GetAccountingAdvancesReportsSummaryResponse.md)
- [GetAccountingAdvancesResponse](docs/GetAccountingAdvancesResponse.md)
- [GetAccountingBankAccountsIdHistoryResponse](docs/GetAccountingBankAccountsIdHistoryResponse.md)
- [GetAccountingBankAccountsIdResponse](docs/GetAccountingBankAccountsIdResponse.md)
- [GetAccountingBankAccountsResponse](docs/GetAccountingBankAccountsResponse.md)
- [GetAccountingBankAdjustmentsResponse](docs/GetAccountingBankAdjustmentsResponse.md)
- [GetAccountingBankTransfersIdResponse](docs/GetAccountingBankTransfersIdResponse.md)
- [GetAccountingBankTransfersResponse](docs/GetAccountingBankTransfersResponse.md)
- [GetAccountingCapitalInjectionsResponse](docs/GetAccountingCapitalInjectionsResponse.md)
- [GetAccountingCashDebtsIdResponse](docs/GetAccountingCashDebtsIdResponse.md)
- [GetAccountingCashDebtsResponse](docs/GetAccountingCashDebtsResponse.md)
- [GetAccountingCashDebtsStatsResponse](docs/GetAccountingCashDebtsStatsResponse.md)
- [GetAccountingCashLoansIdHistoryResponse](docs/GetAccountingCashLoansIdHistoryResponse.md)
- [GetAccountingCashLoansIdResponse](docs/GetAccountingCashLoansIdResponse.md)
- [GetAccountingCashLoansResponse](docs/GetAccountingCashLoansResponse.md)
- [GetAccountingCashLoansStatsResponse](docs/GetAccountingCashLoansStatsResponse.md)
- [GetAccountingExchangeMonedasResponse](docs/GetAccountingExchangeMonedasResponse.md)
- [GetAccountingExchangeTasasResponse](docs/GetAccountingExchangeTasasResponse.md)
- [GetAccountingLogsResponse](docs/GetAccountingLogsResponse.md)
- [GetAccountingPaymentTypesAvailableAccountsResponse](docs/GetAccountingPaymentTypesAvailableAccountsResponse.md)
- [GetAccountingPaymentTypesIdResponse](docs/GetAccountingPaymentTypesIdResponse.md)
- [GetAccountingPaymentTypesResponse](docs/GetAccountingPaymentTypesResponse.md)
- [GetAccountingReconciliationExpensesHistoryResponse](docs/GetAccountingReconciliationExpensesHistoryResponse.md)
- [GetAccountingReconciliationExpensesResponse](docs/GetAccountingReconciliationExpensesResponse.md)
- [GetAccountingReconciliationSalesHistoryResponse](docs/GetAccountingReconciliationSalesHistoryResponse.md)
- [GetAccountingReconciliationSalesResponse](docs/GetAccountingReconciliationSalesResponse.md)
- [GetAccountingReconciliationServicesHistoryResponse](docs/GetAccountingReconciliationServicesHistoryResponse.md)
- [GetAccountingReconciliationServicesResponse](docs/GetAccountingReconciliationServicesResponse.md)
- [GetAccountingReconciliationStatsResponse](docs/GetAccountingReconciliationStatsResponse.md)
- [GetAccountingReportsClientAccountAnalysisResponse](docs/GetAccountingReportsClientAccountAnalysisResponse.md)
- [GetAccountingReportsExchangeImpactResponse](docs/GetAccountingReportsExchangeImpactResponse.md)
- [GetAccountingReportsExchangeResponse](docs/GetAccountingReportsExchangeResponse.md)
- [GetAccountingReportsMovementsResponse](docs/GetAccountingReportsMovementsResponse.md)
- [GetAccountingReportsOverdueInvoicesResponse](docs/GetAccountingReportsOverdueInvoicesResponse.md)
- [GetAccountingReportsSummaryResponse](docs/GetAccountingReportsSummaryResponse.md)
- [GetAccountingReportsTransfersResponse](docs/GetAccountingReportsTransfersResponse.md)
- [GetAdminActivityLogsResponse](docs/GetAdminActivityLogsResponse.md)
- [GetAdminLicenseStatsResponse](docs/GetAdminLicenseStatsResponse.md)
- [GetAdminLicensesResponse](docs/GetAdminLicensesResponse.md)
- [GetAdminSessionsResponse](docs/GetAdminSessionsResponse.md)
- [GetAdminTenantDetailResponse](docs/GetAdminTenantDetailResponse.md)
- [GetAdminTenantLicenseResponse](docs/GetAdminTenantLicenseResponse.md)
- [GetAdminTenantUsersResponse](docs/GetAdminTenantUsersResponse.md)
- [GetAdminUserDetailResponse](docs/GetAdminUserDetailResponse.md)
- [GetAdminUserLoginHistoryResponse](docs/GetAdminUserLoginHistoryResponse.md)
- [GetAdminUsersResponse](docs/GetAdminUsersResponse.md)
- [GetCategoriasDetailResponse](docs/GetCategoriasDetailResponse.md)
- [GetCategoriasListResponse](docs/GetCategoriasListResponse.md)
- [GetComprasDetailResponse](docs/GetComprasDetailResponse.md)
- [GetComprasListResponse](docs/GetComprasListResponse.md)
- [GetContratosDetailResponse](docs/GetContratosDetailResponse.md)
- [GetContratosListResponse](docs/GetContratosListResponse.md)
- [GetDashboardStatsResponse](docs/GetDashboardStatsResponse.md)
- [GetEmpleadosDetailResponse](docs/GetEmpleadosDetailResponse.md)
- [GetEmpleadosListResponse](docs/GetEmpleadosListResponse.md)
- [GetFacturasDetailResponse](docs/GetFacturasDetailResponse.md)
- [GetFacturasListResponse](docs/GetFacturasListResponse.md)
- [GetGastosDetailResponse](docs/GetGastosDetailResponse.md)
- [GetGastosListResponse](docs/GetGastosListResponse.md)
- [GetListasPreciosDetailResponse](docs/GetListasPreciosDetailResponse.md)
- [GetListasPreciosListResponse](docs/GetListasPreciosListResponse.md)
- [GetMermasDetailResponse](docs/GetMermasDetailResponse.md)
- [GetMermasListResponse](docs/GetMermasListResponse.md)
- [GetOfertasDetailResponse](docs/GetOfertasDetailResponse.md)
- [GetOfertasListResponse](docs/GetOfertasListResponse.md)
- [GetProduccionDetailResponse](docs/GetProduccionDetailResponse.md)
- [GetProduccionListResponse](docs/GetProduccionListResponse.md)
- [GetProductsIdResponse](docs/GetProductsIdResponse.md)
- [GetProductsResponse](docs/GetProductsResponse.md)
- [GetProductsStockResponse](docs/GetProductsStockResponse.md)
- [GetPuntosVentaDetailResponse](docs/GetPuntosVentaDetailResponse.md)
- [GetPuntosVentaListResponse](docs/GetPuntosVentaListResponse.md)
- [GetReparacionesDetailResponse](docs/GetReparacionesDetailResponse.md)
- [GetReparacionesListResponse](docs/GetReparacionesListResponse.md)
- [GetSalesIdResponse](docs/GetSalesIdResponse.md)
- [GetSalesResponse](docs/GetSalesResponse.md)
- [GetServiciosDetailResponse](docs/GetServiciosDetailResponse.md)
- [GetServiciosListResponse](docs/GetServiciosListResponse.md)
- [GetTransferenciasDetailResponse](docs/GetTransferenciasDetailResponse.md)
- [GetTransferenciasListResponse](docs/GetTransferenciasListResponse.md)
- [GetUnitsDetailResponse](docs/GetUnitsDetailResponse.md)
- [GetUnitsListResponse](docs/GetUnitsListResponse.md)
- [JsonValue](docs/JsonValue.md)
- [ListaPrecio](docs/ListaPrecio.md)
- [ListaPrecioDetail](docs/ListaPrecioDetail.md)
- [LockAdminUserRequest](docs/LockAdminUserRequest.md)
- [LoginRequest](docs/LoginRequest.md)
- [Merma](docs/Merma.md)
- [MobileCreateUnitRequest](docs/MobileCreateUnitRequest.md)
- [MobileUpdateUnitRequest](docs/MobileUpdateUnitRequest.md)
- [Oferta](docs/Oferta.md)
- [OrdenProduccion](docs/OrdenProduccion.md)
- [OrdenReparacion](docs/OrdenReparacion.md)
- [Pagination](docs/Pagination.md)
- [PatchAdminTenantsLicenseUpdateResponse](docs/PatchAdminTenantsLicenseUpdateResponse.md)
- [PatchAdminTenantsUpdateResponse](docs/PatchAdminTenantsUpdateResponse.md)
- [PatchAdminUsersChangeTenantRoleResponse](docs/PatchAdminUsersChangeTenantRoleResponse.md)
- [PatchAdminUsersUpdateResponse](docs/PatchAdminUsersUpdateResponse.md)
- [PatchSalesIdUpdateResponse](docs/PatchSalesIdUpdateResponse.md)
- [PayableAccountSummary](docs/PayableAccountSummary.md)
- [PayablePaymentSummary](docs/PayablePaymentSummary.md)
- [PaymentType](docs/PaymentType.md)
- [PaymentTypeUpdateRequest](docs/PaymentTypeUpdateRequest.md)
- [PendingMembershipItem](docs/PendingMembershipItem.md)
- [PostAccountingAdvancesIdEjecutarResponse](docs/PostAccountingAdvancesIdEjecutarResponse.md)
- [PostAccountingAdvancesIdRevertirResponse](docs/PostAccountingAdvancesIdRevertirResponse.md)
- [PostAccountingAdvancesResponse](docs/PostAccountingAdvancesResponse.md)
- [PostAccountingBankAdjustmentsResponse](docs/PostAccountingBankAdjustmentsResponse.md)
- [PostAccountingBankTransfersResponse](docs/PostAccountingBankTransfersResponse.md)
- [PostAccountingBankTransfersValidateResponse](docs/PostAccountingBankTransfersValidateResponse.md)
- [PostAccountingCapitalInjectionsIdPaymentsResponse](docs/PostAccountingCapitalInjectionsIdPaymentsResponse.md)
- [PostAccountingCapitalInjectionsResponse](docs/PostAccountingCapitalInjectionsResponse.md)
- [PostAccountingCashDebtsIdPaymentsResponse](docs/PostAccountingCashDebtsIdPaymentsResponse.md)
- [PostAccountingCashDebtsResponse](docs/PostAccountingCashDebtsResponse.md)
- [PostAccountingCashLoansIdPaymentsResponse](docs/PostAccountingCashLoansIdPaymentsResponse.md)
- [PostAccountingCashLoansResponse](docs/PostAccountingCashLoansResponse.md)
- [PostAccountingReconciliationExpensesResponse](docs/PostAccountingReconciliationExpensesResponse.md)
- [PostAccountingReconciliationSalesResponse](docs/PostAccountingReconciliationSalesResponse.md)
- [PostAccountingReconciliationServicesResponse](docs/PostAccountingReconciliationServicesResponse.md)
- [PostAdminLicensesActivateResponse](docs/PostAdminLicensesActivateResponse.md)
- [PostAdminLicensesDeactivateResponse](docs/PostAdminLicensesDeactivateResponse.md)
- [PostAdminLicensesDeleteResponse](docs/PostAdminLicensesDeleteResponse.md)
- [PostAdminLicensesRenewResponse](docs/PostAdminLicensesRenewResponse.md)
- [PostAdminMembershipsApproveResponse](docs/PostAdminMembershipsApproveResponse.md)
- [PostAdminMembershipsRejectResponse](docs/PostAdminMembershipsRejectResponse.md)
- [PostAdminSessionsRevokeResponse](docs/PostAdminSessionsRevokeResponse.md)
- [PostAdminTenantsActivateResponse](docs/PostAdminTenantsActivateResponse.md)
- [PostAdminTenantsDeactivateResponse](docs/PostAdminTenantsDeactivateResponse.md)
- [PostAdminTenantsDeleteResponse](docs/PostAdminTenantsDeleteResponse.md)
- [PostAdminTenantsLicenseAssignResponse](docs/PostAdminTenantsLicenseAssignResponse.md)
- [PostAdminTenantsLicenseDeactivateResponse](docs/PostAdminTenantsLicenseDeactivateResponse.md)
- [PostAdminTenantsRemoveUserResponse](docs/PostAdminTenantsRemoveUserResponse.md)
- [PostAdminUsersActivateResponse](docs/PostAdminUsersActivateResponse.md)
- [PostAdminUsersAssignTenantResponse](docs/PostAdminUsersAssignTenantResponse.md)
- [PostAdminUsersDeactivateResponse](docs/PostAdminUsersDeactivateResponse.md)
- [PostAdminUsersDeleteResponse](docs/PostAdminUsersDeleteResponse.md)
- [PostAdminUsersLockResponse](docs/PostAdminUsersLockResponse.md)
- [PostAdminUsersLockResponseUser](docs/PostAdminUsersLockResponseUser.md)
- [PostAdminUsersResendVerificationResponse](docs/PostAdminUsersResendVerificationResponse.md)
- [PostAdminUsersResetPasswordResponse](docs/PostAdminUsersResetPasswordResponse.md)
- [PostAdminUsersRevokeSessionsResponse](docs/PostAdminUsersRevokeSessionsResponse.md)
- [PostAdminUsersVerifyEmailResponse](docs/PostAdminUsersVerifyEmailResponse.md)
- [PostAdminUsersVerifyEmailResponseUser](docs/PostAdminUsersVerifyEmailResponseUser.md)
- [PostSalesCreateResponse](docs/PostSalesCreateResponse.md)
- [PostSalesIdCancelResponse](docs/PostSalesIdCancelResponse.md)
- [PrecioListaItem](docs/PrecioListaItem.md)
- [Product](docs/Product.md)
- [Proveedor](docs/Proveedor.md)
- [ProveedorCreateRequest](docs/ProveedorCreateRequest.md)
- [ProveedorDeleteResponse](docs/ProveedorDeleteResponse.md)
- [ProveedorListResponse](docs/ProveedorListResponse.md)
- [ProveedorUpdateRequest](docs/ProveedorUpdateRequest.md)
- [PuntoVenta](docs/PuntoVenta.md)
- [PutAccountingAdvancesIdResponse](docs/PutAccountingAdvancesIdResponse.md)
- [PutAccountingCashDebtsIdResponse](docs/PutAccountingCashDebtsIdResponse.md)
- [PutAccountingCashLoansIdResponse](docs/PutAccountingCashLoansIdResponse.md)
- [PutAccountingPaymentTypesIdResponse](docs/PutAccountingPaymentTypesIdResponse.md)
- [Reconciliation](docs/Reconciliation.md)
- [ReconciliationActivity](docs/ReconciliationActivity.md)
- [ReconciliationModuleStats](docs/ReconciliationModuleStats.md)
- [ReconciliationModules](docs/ReconciliationModules.md)
- [ReconciliationOverviewStats](docs/ReconciliationOverviewStats.md)
- [RefreshRequest](docs/RefreshRequest.md)
- [RegisterRequest](docs/RegisterRequest.md)
- [RegisterResponse](docs/RegisterResponse.md)
- [RejectAdminMembershipRequest](docs/RejectAdminMembershipRequest.md)
- [RenewAdminLicenseRequest](docs/RenewAdminLicenseRequest.md)
- [ReportFilters](docs/ReportFilters.md)
- [ReportResult](docs/ReportResult.md)
- [ReportStatistics](docs/ReportStatistics.md)
- [ReportTotals](docs/ReportTotals.md)
- [Sale](docs/Sale.md)
- [SaleCancelRequest](docs/SaleCancelRequest.md)
- [SaleCreateRequest](docs/SaleCreateRequest.md)
- [SaleItem](docs/SaleItem.md)
- [SaleItemRequest](docs/SaleItemRequest.md)
- [SaleReconciliationRequest](docs/SaleReconciliationRequest.md)
- [SaleUpdateRequest](docs/SaleUpdateRequest.md)
- [ServiceDistributionRequest](docs/ServiceDistributionRequest.md)
- [ServiceReconciliationRequest](docs/ServiceReconciliationRequest.md)
- [Servicio](docs/Servicio.md)
- [SuccessResponse](docs/SuccessResponse.md)
- [SwitchTenantRequest](docs/SwitchTenantRequest.md)
- [SwitchTenantResponse](docs/SwitchTenantResponse.md)
- [TenantListResponse](docs/TenantListResponse.md)
- [TenantSummary](docs/TenantSummary.md)
- [Token](docs/Token.md)
- [TokenPair](docs/TokenPair.md)
- [Transferencia](docs/Transferencia.md)
- [Unit](docs/Unit.md)
- [UnlockAdminUserRequest](docs/UnlockAdminUserRequest.md)
- [UpdateAdminTenantLicenseRequest](docs/UpdateAdminTenantLicenseRequest.md)
- [UpdateAdminTenantRequest](docs/UpdateAdminTenantRequest.md)
- [UpdateAdminUserRequest](docs/UpdateAdminUserRequest.md)

### Authorization


Authentication schemes defined for the API:
<a id="bearerAuth"></a>
#### bearerAuth


- **Type**: HTTP Bearer Token authentication (JWT)

## About

This TypeScript SDK client supports the [Fetch API](https://fetch.spec.whatwg.org/)
and is automatically generated by the
[OpenAPI Generator](https://openapi-generator.tech) project:

- API version: `1.0.0`
- Package version: `1.0.0`
- Generator version: `7.17.0`
- Build package: `org.openapitools.codegen.languages.TypeScriptFetchClientCodegen`

The generated npm module supports the following:

- Environments
  * Node.js
  * Webpack
  * Browserify
- Language levels
  * ES5 - you must have a Promises/A+ library installed
  * ES6
- Module systems
  * CommonJS
  * ES6 module system


## Development

### Building

To build the TypeScript source code, you need to have Node.js and npm installed.
After cloning the repository, navigate to the project directory and run:

```bash
npm install
npm run build
```

### Publishing

Once you've built the package, you can publish it to npm:

```bash
npm publish
```

## License

[]()
