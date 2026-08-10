# AccountingReconciliationApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetAccountingReconciliationExpenses**](AccountingReconciliationApi.md#mobilegetaccountingreconciliationexpenses) | **GET** /accounting/reconciliation/expenses | Consultar conciliación de gastos |
| [**mobileGetAccountingReconciliationExpensesHistory**](AccountingReconciliationApi.md#mobilegetaccountingreconciliationexpenseshistory) | **GET** /accounting/reconciliation/expenses-history | Consultar historial de conciliaciones de gastos |
| [**mobileGetAccountingReconciliationExpensesNestedHistory**](AccountingReconciliationApi.md#mobilegetaccountingreconciliationexpensesnestedhistory) | **GET** /accounting/reconciliation/expenses/history | Consultar historial paginado de conciliaciones de gastos |
| [**mobileGetAccountingReconciliationSales**](AccountingReconciliationApi.md#mobilegetaccountingreconciliationsales) | **GET** /accounting/reconciliation/sales | Consultar conciliación de ventas |
| [**mobileGetAccountingReconciliationSalesHistory**](AccountingReconciliationApi.md#mobilegetaccountingreconciliationsaleshistory) | **GET** /accounting/reconciliation/sales-history | Consultar historial de conciliaciones de ventas |
| [**mobileGetAccountingReconciliationSalesNestedHistory**](AccountingReconciliationApi.md#mobilegetaccountingreconciliationsalesnestedhistory) | **GET** /accounting/reconciliation/sales/history | Consultar historial paginado de conciliaciones de ventas |
| [**mobileGetAccountingReconciliationServices**](AccountingReconciliationApi.md#mobilegetaccountingreconciliationservices) | **GET** /accounting/reconciliation/services | Consultar conciliación de servicios |
| [**mobileGetAccountingReconciliationServicesHistory**](AccountingReconciliationApi.md#mobilegetaccountingreconciliationserviceshistory) | **GET** /accounting/reconciliation/services-history | Consultar historial de conciliaciones de servicios |
| [**mobileGetAccountingReconciliationServicesNestedHistory**](AccountingReconciliationApi.md#mobilegetaccountingreconciliationservicesnestedhistory) | **GET** /accounting/reconciliation/services/history | Consultar historial paginado de conciliaciones de servicios |
| [**mobileGetAccountingReconciliationStats**](AccountingReconciliationApi.md#mobilegetaccountingreconciliationstats) | **GET** /accounting/reconciliation/stats | Consultar panel de conciliaciones |
| [**mobilePostAccountingReconciliationExpenses**](AccountingReconciliationApi.md#mobilepostaccountingreconciliationexpenses) | **POST** /accounting/reconciliation/expenses | Registrar conciliación de gastos |
| [**mobilePostAccountingReconciliationSales**](AccountingReconciliationApi.md#mobilepostaccountingreconciliationsales) | **POST** /accounting/reconciliation/sales | Registrar conciliación de ventas |
| [**mobilePostAccountingReconciliationServices**](AccountingReconciliationApi.md#mobilepostaccountingreconciliationservices) | **POST** /accounting/reconciliation/services | Registrar conciliación de servicios |



## mobileGetAccountingReconciliationExpenses

> GetAccountingReconciliationExpensesResponse mobileGetAccountingReconciliationExpenses(tipoGasto, fechaDesde, fechaHasta, page, limit)

Consultar conciliación de gastos

Lista gastos pendientes de conciliación bancaria. Permite precisar la consulta mediante tipoGasto, fecha inicial, fecha final, página, límite por página.

### Example

```ts
import {
  Configuration,
  AccountingReconciliationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingReconciliationExpensesRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReconciliationApi(config);

  const body = {
    // string | Valor de tipoGasto aceptado por el handler. (optional)
    tipoGasto: tipoGasto_example,
    // Date | Valor de fechaDesde aceptado por el handler. (optional)
    fechaDesde: 2013-10-20T19:20:30+01:00,
    // Date | Valor de fechaHasta aceptado por el handler. (optional)
    fechaHasta: 2013-10-20T19:20:30+01:00,
    // number | Página solicitada, comenzando en 1. (optional)
    page: 56,
    // number | Cantidad máxima de elementos por página. (optional)
    limit: 56,
  } satisfies MobileGetAccountingReconciliationExpensesRequest;

  try {
    const data = await api.mobileGetAccountingReconciliationExpenses(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **tipoGasto** | `string` | Valor de tipoGasto aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **fechaDesde** | `Date` | Valor de fechaDesde aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **fechaHasta** | `Date` | Valor de fechaHasta aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **page** | `number` | Página solicitada, comenzando en 1. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de elementos por página. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingReconciliationExpensesResponse**](GetAccountingReconciliationExpensesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAccountingReconciliationExpensesHistory

> GetAccountingReconciliationExpensesHistoryResponse mobileGetAccountingReconciliationExpensesHistory(tipoGasto, cuentaId, fechaDesde, fechaHasta, periodo, reconciliadoPor, page, limit)

Consultar historial de conciliaciones de gastos

Devuelve el historial completo de conciliaciones de gastos. Permite precisar la consulta mediante tipoGasto, cuenta bancaria, fecha inicial, fecha final, periodo, reconciliadoPor, página, límite por página.

### Example

```ts
import {
  Configuration,
  AccountingReconciliationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingReconciliationExpensesHistoryRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReconciliationApi(config);

  const body = {
    // string | Valor de tipoGasto aceptado por el handler. (optional)
    tipoGasto: tipoGasto_example,
    // string | Identificador de la cuenta bancaria. (optional)
    cuentaId: cuentaId_example,
    // Date | Valor de fechaDesde aceptado por el handler. (optional)
    fechaDesde: 2013-10-20T19:20:30+01:00,
    // Date | Valor de fechaHasta aceptado por el handler. (optional)
    fechaHasta: 2013-10-20T19:20:30+01:00,
    // string | Valor de periodo aceptado por el handler. (optional)
    periodo: periodo_example,
    // string | Valor de reconciliadoPor aceptado por el handler. (optional)
    reconciliadoPor: reconciliadoPor_example,
    // number | Página solicitada, comenzando en 1. (optional)
    page: 56,
    // number | Cantidad máxima de elementos por página. (optional)
    limit: 56,
  } satisfies MobileGetAccountingReconciliationExpensesHistoryRequest;

  try {
    const data = await api.mobileGetAccountingReconciliationExpensesHistory(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **tipoGasto** | `string` | Valor de tipoGasto aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **cuentaId** | `string` | Identificador de la cuenta bancaria. | [Optional] [Defaults to `undefined`] |
| **fechaDesde** | `Date` | Valor de fechaDesde aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **fechaHasta** | `Date` | Valor de fechaHasta aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **periodo** | `string` | Valor de periodo aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **reconciliadoPor** | `string` | Valor de reconciliadoPor aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **page** | `number` | Página solicitada, comenzando en 1. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de elementos por página. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingReconciliationExpensesHistoryResponse**](GetAccountingReconciliationExpensesHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAccountingReconciliationExpensesNestedHistory

> GetAccountingReconciliationExpensesHistoryResponse mobileGetAccountingReconciliationExpensesNestedHistory(tipoGasto, cuentaId, fechaDesde, fechaHasta, periodo, reconciliadoPor, page, limit)

Consultar historial paginado de conciliaciones de gastos

Devuelve conciliaciones de gastos con estadísticas y control de página. Permite precisar la consulta mediante tipoGasto, cuenta bancaria, fecha inicial, fecha final, periodo, reconciliadoPor, página, límite por página.

### Example

```ts
import {
  Configuration,
  AccountingReconciliationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingReconciliationExpensesNestedHistoryRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReconciliationApi(config);

  const body = {
    // string | Valor de tipoGasto aceptado por el handler. (optional)
    tipoGasto: tipoGasto_example,
    // string | Identificador de la cuenta bancaria. (optional)
    cuentaId: cuentaId_example,
    // Date | Valor de fechaDesde aceptado por el handler. (optional)
    fechaDesde: 2013-10-20T19:20:30+01:00,
    // Date | Valor de fechaHasta aceptado por el handler. (optional)
    fechaHasta: 2013-10-20T19:20:30+01:00,
    // string | Valor de periodo aceptado por el handler. (optional)
    periodo: periodo_example,
    // string | Valor de reconciliadoPor aceptado por el handler. (optional)
    reconciliadoPor: reconciliadoPor_example,
    // number | Página solicitada, comenzando en 1. (optional)
    page: 56,
    // number | Cantidad máxima de elementos por página. (optional)
    limit: 56,
  } satisfies MobileGetAccountingReconciliationExpensesNestedHistoryRequest;

  try {
    const data = await api.mobileGetAccountingReconciliationExpensesNestedHistory(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **tipoGasto** | `string` | Valor de tipoGasto aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **cuentaId** | `string` | Identificador de la cuenta bancaria. | [Optional] [Defaults to `undefined`] |
| **fechaDesde** | `Date` | Valor de fechaDesde aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **fechaHasta** | `Date` | Valor de fechaHasta aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **periodo** | `string` | Valor de periodo aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **reconciliadoPor** | `string` | Valor de reconciliadoPor aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **page** | `number` | Página solicitada, comenzando en 1. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de elementos por página. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingReconciliationExpensesHistoryResponse**](GetAccountingReconciliationExpensesHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAccountingReconciliationSales

> GetAccountingReconciliationSalesResponse mobileGetAccountingReconciliationSales(fechaInicio, fechaFin, puntoDeVentaId, page, limit)

Consultar conciliación de ventas

Lista ventas que todavía no tienen conciliación bancaria. Permite precisar la consulta mediante fecha inicial, fecha final, punto de venta, página, límite por página.

### Example

```ts
import {
  Configuration,
  AccountingReconciliationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingReconciliationSalesRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReconciliationApi(config);

  const body = {
    // Date | Inicio inclusivo del período consultado. (optional)
    fechaInicio: 2013-10-20T19:20:30+01:00,
    // Date | Fin inclusivo del período consultado. (optional)
    fechaFin: 2013-10-20T19:20:30+01:00,
    // string | Valor de puntoDeVentaId aceptado por el handler. (optional)
    puntoDeVentaId: puntoDeVentaId_example,
    // number | Página solicitada, comenzando en 1. (optional)
    page: 56,
    // number | Cantidad máxima de elementos por página. (optional)
    limit: 56,
  } satisfies MobileGetAccountingReconciliationSalesRequest;

  try {
    const data = await api.mobileGetAccountingReconciliationSales(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **fechaInicio** | `Date` | Inicio inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **fechaFin** | `Date` | Fin inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **puntoDeVentaId** | `string` | Valor de puntoDeVentaId aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **page** | `number` | Página solicitada, comenzando en 1. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de elementos por página. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingReconciliationSalesResponse**](GetAccountingReconciliationSalesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAccountingReconciliationSalesHistory

> GetAccountingReconciliationSalesHistoryResponse mobileGetAccountingReconciliationSalesHistory(fechaDesde, fechaInicio, fechaHasta, fechaFin, cuentaId)

Consultar historial de conciliaciones de ventas

Devuelve el historial completo de conciliaciones de ventas. Permite precisar la consulta mediante fecha inicial, fecha inicial, fecha final, fecha final, cuenta bancaria.

### Example

```ts
import {
  Configuration,
  AccountingReconciliationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingReconciliationSalesHistoryRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReconciliationApi(config);

  const body = {
    // Date | Valor de fechaDesde aceptado por el handler. (optional)
    fechaDesde: 2013-10-20T19:20:30+01:00,
    // Date | Inicio inclusivo del período consultado. (optional)
    fechaInicio: 2013-10-20T19:20:30+01:00,
    // Date | Valor de fechaHasta aceptado por el handler. (optional)
    fechaHasta: 2013-10-20T19:20:30+01:00,
    // Date | Fin inclusivo del período consultado. (optional)
    fechaFin: 2013-10-20T19:20:30+01:00,
    // string | Identificador de la cuenta bancaria. (optional)
    cuentaId: cuentaId_example,
  } satisfies MobileGetAccountingReconciliationSalesHistoryRequest;

  try {
    const data = await api.mobileGetAccountingReconciliationSalesHistory(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **fechaDesde** | `Date` | Valor de fechaDesde aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **fechaInicio** | `Date` | Inicio inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **fechaHasta** | `Date` | Valor de fechaHasta aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **fechaFin** | `Date` | Fin inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **cuentaId** | `string` | Identificador de la cuenta bancaria. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingReconciliationSalesHistoryResponse**](GetAccountingReconciliationSalesHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAccountingReconciliationSalesNestedHistory

> GetAccountingReconciliationSalesHistoryResponse mobileGetAccountingReconciliationSalesNestedHistory(fechaInicio, fechaFin, cuentaId)

Consultar historial paginado de conciliaciones de ventas

Devuelve conciliaciones de ventas con estadísticas y control de página. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.

### Example

```ts
import {
  Configuration,
  AccountingReconciliationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingReconciliationSalesNestedHistoryRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReconciliationApi(config);

  const body = {
    // Date | Inicio inclusivo del período consultado. (optional)
    fechaInicio: 2013-10-20T19:20:30+01:00,
    // Date | Fin inclusivo del período consultado. (optional)
    fechaFin: 2013-10-20T19:20:30+01:00,
    // string | Identificador de la cuenta bancaria. (optional)
    cuentaId: cuentaId_example,
  } satisfies MobileGetAccountingReconciliationSalesNestedHistoryRequest;

  try {
    const data = await api.mobileGetAccountingReconciliationSalesNestedHistory(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **fechaInicio** | `Date` | Inicio inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **fechaFin** | `Date` | Fin inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **cuentaId** | `string` | Identificador de la cuenta bancaria. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingReconciliationSalesHistoryResponse**](GetAccountingReconciliationSalesHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAccountingReconciliationServices

> GetAccountingReconciliationServicesResponse mobileGetAccountingReconciliationServices(fechaDesde, fechaHasta, page, limit)

Consultar conciliación de servicios

Lista servicios vendidos pendientes de distribuir entre cuentas bancarias. Permite precisar la consulta mediante fecha inicial, fecha final, página, límite por página.

### Example

```ts
import {
  Configuration,
  AccountingReconciliationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingReconciliationServicesRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReconciliationApi(config);

  const body = {
    // Date | Valor de fechaDesde aceptado por el handler. (optional)
    fechaDesde: 2013-10-20T19:20:30+01:00,
    // Date | Valor de fechaHasta aceptado por el handler. (optional)
    fechaHasta: 2013-10-20T19:20:30+01:00,
    // number | Página solicitada, comenzando en 1. (optional)
    page: 56,
    // number | Cantidad máxima de elementos por página. (optional)
    limit: 56,
  } satisfies MobileGetAccountingReconciliationServicesRequest;

  try {
    const data = await api.mobileGetAccountingReconciliationServices(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **fechaDesde** | `Date` | Valor de fechaDesde aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **fechaHasta** | `Date` | Valor de fechaHasta aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **page** | `number` | Página solicitada, comenzando en 1. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de elementos por página. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingReconciliationServicesResponse**](GetAccountingReconciliationServicesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAccountingReconciliationServicesHistory

> GetAccountingReconciliationServicesHistoryResponse mobileGetAccountingReconciliationServicesHistory(fechaDesde, fechaHasta, cuentaId)

Consultar historial de conciliaciones de servicios

Devuelve el historial completo de conciliaciones de servicios. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.

### Example

```ts
import {
  Configuration,
  AccountingReconciliationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingReconciliationServicesHistoryRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReconciliationApi(config);

  const body = {
    // Date | Valor de fechaDesde aceptado por el handler. (optional)
    fechaDesde: 2013-10-20T19:20:30+01:00,
    // Date | Valor de fechaHasta aceptado por el handler. (optional)
    fechaHasta: 2013-10-20T19:20:30+01:00,
    // string | Identificador de la cuenta bancaria. (optional)
    cuentaId: cuentaId_example,
  } satisfies MobileGetAccountingReconciliationServicesHistoryRequest;

  try {
    const data = await api.mobileGetAccountingReconciliationServicesHistory(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **fechaDesde** | `Date` | Valor de fechaDesde aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **fechaHasta** | `Date` | Valor de fechaHasta aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **cuentaId** | `string` | Identificador de la cuenta bancaria. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingReconciliationServicesHistoryResponse**](GetAccountingReconciliationServicesHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAccountingReconciliationServicesNestedHistory

> GetAccountingReconciliationServicesHistoryResponse mobileGetAccountingReconciliationServicesNestedHistory(fechaDesde, fechaHasta, cuentaId)

Consultar historial paginado de conciliaciones de servicios

Devuelve conciliaciones de servicios con estadísticas y control de página. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.

### Example

```ts
import {
  Configuration,
  AccountingReconciliationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingReconciliationServicesNestedHistoryRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReconciliationApi(config);

  const body = {
    // Date | Valor de fechaDesde aceptado por el handler. (optional)
    fechaDesde: 2013-10-20T19:20:30+01:00,
    // Date | Valor de fechaHasta aceptado por el handler. (optional)
    fechaHasta: 2013-10-20T19:20:30+01:00,
    // string | Identificador de la cuenta bancaria. (optional)
    cuentaId: cuentaId_example,
  } satisfies MobileGetAccountingReconciliationServicesNestedHistoryRequest;

  try {
    const data = await api.mobileGetAccountingReconciliationServicesNestedHistory(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **fechaDesde** | `Date` | Valor de fechaDesde aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **fechaHasta** | `Date` | Valor de fechaHasta aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **cuentaId** | `string` | Identificador de la cuenta bancaria. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingReconciliationServicesHistoryResponse**](GetAccountingReconciliationServicesHistoryResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAccountingReconciliationStats

> GetAccountingReconciliationStatsResponse mobileGetAccountingReconciliationStats()

Consultar panel de conciliaciones

Resume pendientes, conciliaciones completadas hoy, eficiencia y actividad reciente por módulo.

### Example

```ts
import {
  Configuration,
  AccountingReconciliationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingReconciliationStatsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReconciliationApi(config);

  try {
    const data = await api.mobileGetAccountingReconciliationStats();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**GetAccountingReconciliationStatsResponse**](GetAccountingReconciliationStatsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobilePostAccountingReconciliationExpenses

> PostAccountingReconciliationExpensesResponse mobilePostAccountingReconciliationExpenses(expenseReconciliationRequest, tipoGasto, fechaDesde, fechaHasta, page, limit)

Registrar conciliación de gastos

Distribuye el importe de un gasto entre una o varias cuentas y registra su pago contable.

### Example

```ts
import {
  Configuration,
  AccountingReconciliationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostAccountingReconciliationExpensesRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReconciliationApi(config);

  const body = {
    // ExpenseReconciliationRequest
    expenseReconciliationRequest: ...,
    // string | Valor de tipoGasto aceptado por el handler. (optional)
    tipoGasto: tipoGasto_example,
    // Date | Valor de fechaDesde aceptado por el handler. (optional)
    fechaDesde: 2013-10-20T19:20:30+01:00,
    // Date | Valor de fechaHasta aceptado por el handler. (optional)
    fechaHasta: 2013-10-20T19:20:30+01:00,
    // number | Página solicitada, comenzando en 1. (optional)
    page: 56,
    // number | Cantidad máxima de elementos por página. (optional)
    limit: 56,
  } satisfies MobilePostAccountingReconciliationExpensesRequest;

  try {
    const data = await api.mobilePostAccountingReconciliationExpenses(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **expenseReconciliationRequest** | [ExpenseReconciliationRequest](ExpenseReconciliationRequest.md) |  | |
| **tipoGasto** | `string` | Valor de tipoGasto aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **fechaDesde** | `Date` | Valor de fechaDesde aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **fechaHasta** | `Date` | Valor de fechaHasta aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **page** | `number` | Página solicitada, comenzando en 1. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de elementos por página. | [Optional] [Defaults to `undefined`] |

### Return type

[**PostAccountingReconciliationExpensesResponse**](PostAccountingReconciliationExpensesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobilePostAccountingReconciliationSales

> PostAccountingReconciliationSalesResponse mobilePostAccountingReconciliationSales(saleReconciliationRequest, fechaInicio, fechaFin, puntoDeVentaId, page, limit)

Registrar conciliación de ventas

Abona una venta en la cuenta y medio de pago indicados, respetando el importe conciliable.

### Example

```ts
import {
  Configuration,
  AccountingReconciliationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostAccountingReconciliationSalesRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReconciliationApi(config);

  const body = {
    // SaleReconciliationRequest
    saleReconciliationRequest: ...,
    // Date | Inicio inclusivo del período consultado. (optional)
    fechaInicio: 2013-10-20T19:20:30+01:00,
    // Date | Fin inclusivo del período consultado. (optional)
    fechaFin: 2013-10-20T19:20:30+01:00,
    // string | Valor de puntoDeVentaId aceptado por el handler. (optional)
    puntoDeVentaId: puntoDeVentaId_example,
    // number | Página solicitada, comenzando en 1. (optional)
    page: 56,
    // number | Cantidad máxima de elementos por página. (optional)
    limit: 56,
  } satisfies MobilePostAccountingReconciliationSalesRequest;

  try {
    const data = await api.mobilePostAccountingReconciliationSales(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **saleReconciliationRequest** | [SaleReconciliationRequest](SaleReconciliationRequest.md) |  | |
| **fechaInicio** | `Date` | Inicio inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **fechaFin** | `Date` | Fin inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **puntoDeVentaId** | `string` | Valor de puntoDeVentaId aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **page** | `number` | Página solicitada, comenzando en 1. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de elementos por página. | [Optional] [Defaults to `undefined`] |

### Return type

[**PostAccountingReconciliationSalesResponse**](PostAccountingReconciliationSalesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobilePostAccountingReconciliationServices

> PostAccountingReconciliationServicesResponse mobilePostAccountingReconciliationServices(serviceReconciliationRequest, fechaDesde, fechaHasta, page, limit)

Registrar conciliación de servicios

Distribuye el total de un servicio entre las cuentas y medios de pago enviados.

### Example

```ts
import {
  Configuration,
  AccountingReconciliationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostAccountingReconciliationServicesRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReconciliationApi(config);

  const body = {
    // ServiceReconciliationRequest
    serviceReconciliationRequest: ...,
    // Date | Valor de fechaDesde aceptado por el handler. (optional)
    fechaDesde: 2013-10-20T19:20:30+01:00,
    // Date | Valor de fechaHasta aceptado por el handler. (optional)
    fechaHasta: 2013-10-20T19:20:30+01:00,
    // number | Página solicitada, comenzando en 1. (optional)
    page: 56,
    // number | Cantidad máxima de elementos por página. (optional)
    limit: 56,
  } satisfies MobilePostAccountingReconciliationServicesRequest;

  try {
    const data = await api.mobilePostAccountingReconciliationServices(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **serviceReconciliationRequest** | [ServiceReconciliationRequest](ServiceReconciliationRequest.md) |  | |
| **fechaDesde** | `Date` | Valor de fechaDesde aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **fechaHasta** | `Date` | Valor de fechaHasta aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **page** | `number` | Página solicitada, comenzando en 1. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de elementos por página. | [Optional] [Defaults to `undefined`] |

### Return type

[**PostAccountingReconciliationServicesResponse**](PostAccountingReconciliationServicesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

