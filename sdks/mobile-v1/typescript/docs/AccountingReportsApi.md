# AccountingReportsApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetAccountingAdvancesReportsCustomers**](AccountingReportsApi.md#mobilegetaccountingadvancesreportscustomers) | **GET** /accounting/advances/reports/customers | Consultar anticipos de clientes |
| [**mobileGetAccountingAdvancesReportsProviders**](AccountingReportsApi.md#mobilegetaccountingadvancesreportsproviders) | **GET** /accounting/advances/reports/providers | Consultar anticipos a proveedores |
| [**mobileGetAccountingAdvancesReportsSummary**](AccountingReportsApi.md#mobilegetaccountingadvancesreportssummary) | **GET** /accounting/advances/reports/summary | Consultar resumen de anticipos |
| [**mobileGetAccountingReportsClientAccountAnalysis**](AccountingReportsApi.md#mobilegetaccountingreportsclientaccountanalysis) | **GET** /accounting/reports/client-account-analysis | Consultar análisis de cuenta de cliente |
| [**mobileGetAccountingReportsExchange**](AccountingReportsApi.md#mobilegetaccountingreportsexchange) | **GET** /accounting/reports/exchange | Consultar reporte de cambio de moneda |
| [**mobileGetAccountingReportsExchangeImpact**](AccountingReportsApi.md#mobilegetaccountingreportsexchangeimpact) | **GET** /accounting/reports/exchange-impact | Consultar impacto de variaciones cambiarias |
| [**mobileGetAccountingReportsMovements**](AccountingReportsApi.md#mobilegetaccountingreportsmovements) | **GET** /accounting/reports/movements | Consultar movimientos contables |
| [**mobileGetAccountingReportsOverdueInvoices**](AccountingReportsApi.md#mobilegetaccountingreportsoverdueinvoices) | **GET** /accounting/reports/overdue-invoices | Consultar facturas vencidas |
| [**mobileGetAccountingReportsSummary**](AccountingReportsApi.md#mobilegetaccountingreportssummary) | **GET** /accounting/reports/summary | Consultar resumen financiero |
| [**mobileGetAccountingReportsTransfers**](AccountingReportsApi.md#mobilegetaccountingreportstransfers) | **GET** /accounting/reports/transfers | Consultar reporte de transferencias |



## mobileGetAccountingAdvancesReportsCustomers

> GetAccountingAdvancesReportsCustomersResponse mobileGetAccountingAdvancesReportsCustomers(clienteId, fechaInicio, fechaFin)

Consultar anticipos de clientes

Agrupa los anticipos recibidos de clientes para el período consultado. Permite precisar la consulta mediante cliente, fecha inicial, fecha final.

### Example

```ts
import {
  Configuration,
  AccountingReportsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingAdvancesReportsCustomersRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReportsApi(config);

  const body = {
    // string | Identificador del cliente. (optional)
    clienteId: clienteId_example,
    // Date | Inicio inclusivo del período consultado. (optional)
    fechaInicio: 2013-10-20T19:20:30+01:00,
    // Date | Fin inclusivo del período consultado. (optional)
    fechaFin: 2013-10-20T19:20:30+01:00,
  } satisfies MobileGetAccountingAdvancesReportsCustomersRequest;

  try {
    const data = await api.mobileGetAccountingAdvancesReportsCustomers(body);
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
| **clienteId** | `string` | Identificador del cliente. | [Optional] [Defaults to `undefined`] |
| **fechaInicio** | `Date` | Inicio inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **fechaFin** | `Date` | Fin inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingAdvancesReportsCustomersResponse**](GetAccountingAdvancesReportsCustomersResponse.md)

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


## mobileGetAccountingAdvancesReportsProviders

> GetAccountingAdvancesReportsProvidersResponse mobileGetAccountingAdvancesReportsProviders(proveedorId, fechaInicio, fechaFin)

Consultar anticipos a proveedores

Agrupa los anticipos entregados a proveedores para el período consultado. Permite precisar la consulta mediante proveedor, fecha inicial, fecha final.

### Example

```ts
import {
  Configuration,
  AccountingReportsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingAdvancesReportsProvidersRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReportsApi(config);

  const body = {
    // string | Identificador del proveedor. (optional)
    proveedorId: proveedorId_example,
    // Date | Inicio inclusivo del período consultado. (optional)
    fechaInicio: 2013-10-20T19:20:30+01:00,
    // Date | Fin inclusivo del período consultado. (optional)
    fechaFin: 2013-10-20T19:20:30+01:00,
  } satisfies MobileGetAccountingAdvancesReportsProvidersRequest;

  try {
    const data = await api.mobileGetAccountingAdvancesReportsProviders(body);
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
| **proveedorId** | `string` | Identificador del proveedor. | [Optional] [Defaults to `undefined`] |
| **fechaInicio** | `Date` | Inicio inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **fechaFin** | `Date` | Fin inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingAdvancesReportsProvidersResponse**](GetAccountingAdvancesReportsProvidersResponse.md)

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


## mobileGetAccountingAdvancesReportsSummary

> GetAccountingAdvancesReportsSummaryResponse mobileGetAccountingAdvancesReportsSummary(tipo, fechaInicio, fechaFin)

Consultar resumen de anticipos

Resume importes y estados de anticipos de pago y cobro. Permite precisar la consulta mediante tipo, fecha inicial, fecha final.

### Example

```ts
import {
  Configuration,
  AccountingReportsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingAdvancesReportsSummaryRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReportsApi(config);

  const body = {
    // string | Tipo de registro solicitado. (optional)
    tipo: tipo_example,
    // Date | Inicio inclusivo del período consultado. (optional)
    fechaInicio: 2013-10-20T19:20:30+01:00,
    // Date | Fin inclusivo del período consultado. (optional)
    fechaFin: 2013-10-20T19:20:30+01:00,
  } satisfies MobileGetAccountingAdvancesReportsSummaryRequest;

  try {
    const data = await api.mobileGetAccountingAdvancesReportsSummary(body);
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
| **tipo** | `string` | Tipo de registro solicitado. | [Optional] [Defaults to `undefined`] |
| **fechaInicio** | `Date` | Inicio inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **fechaFin** | `Date` | Fin inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingAdvancesReportsSummaryResponse**](GetAccountingAdvancesReportsSummaryResponse.md)

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


## mobileGetAccountingReportsClientAccountAnalysis

> GetAccountingReportsClientAccountAnalysisResponse mobileGetAccountingReportsClientAccountAnalysis(clienteId)

Consultar análisis de cuenta de cliente

Analiza deuda, pagos, vencimientos y actividad de una cuenta de cliente. Permite precisar la consulta mediante cliente.

### Example

```ts
import {
  Configuration,
  AccountingReportsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingReportsClientAccountAnalysisRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReportsApi(config);

  const body = {
    // string | Identificador del cliente. (optional)
    clienteId: clienteId_example,
  } satisfies MobileGetAccountingReportsClientAccountAnalysisRequest;

  try {
    const data = await api.mobileGetAccountingReportsClientAccountAnalysis(body);
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
| **clienteId** | `string` | Identificador del cliente. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingReportsClientAccountAnalysisResponse**](GetAccountingReportsClientAccountAnalysisResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAccountingReportsExchange

> GetAccountingReportsExchangeResponse mobileGetAccountingReportsExchange(fechaInicio, fechaFin, monedaOrigen, monedaDestino, _export)

Consultar reporte de cambio de moneda

Reúne tasas y conversiones monetarias para evaluar operaciones de cambio. Permite precisar la consulta mediante fecha inicial, fecha final, monedaOrigen, monedaDestino, formato de exportación.

### Example

```ts
import {
  Configuration,
  AccountingReportsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingReportsExchangeRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReportsApi(config);

  const body = {
    // Date | Inicio inclusivo del período consultado. (optional)
    fechaInicio: 2013-10-20T19:20:30+01:00,
    // Date | Fin inclusivo del período consultado. (optional)
    fechaFin: 2013-10-20T19:20:30+01:00,
    // string | Valor de monedaOrigen aceptado por el handler. (optional)
    monedaOrigen: monedaOrigen_example,
    // string | Valor de monedaDestino aceptado por el handler. (optional)
    monedaDestino: monedaDestino_example,
    // string | Valor de export aceptado por el handler. (optional)
    _export: _export_example,
  } satisfies MobileGetAccountingReportsExchangeRequest;

  try {
    const data = await api.mobileGetAccountingReportsExchange(body);
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
| **monedaOrigen** | `string` | Valor de monedaOrigen aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **monedaDestino** | `string` | Valor de monedaDestino aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **_export** | `string` | Valor de export aceptado por el handler. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingReportsExchangeResponse**](GetAccountingReportsExchangeResponse.md)

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


## mobileGetAccountingReportsExchangeImpact

> GetAccountingReportsExchangeImpactResponse mobileGetAccountingReportsExchangeImpact(fechaInicio, fechaFin, monedaBase, tipoAnalisis)

Consultar impacto de variaciones cambiarias

Calcula el efecto de las tasas aplicadas sobre movimientos y saldos convertidos. Permite precisar la consulta mediante fecha inicial, fecha final, monedaBase, tipoAnalisis.

### Example

```ts
import {
  Configuration,
  AccountingReportsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingReportsExchangeImpactRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReportsApi(config);

  const body = {
    // Date | Inicio inclusivo del período consultado. (optional)
    fechaInicio: 2013-10-20T19:20:30+01:00,
    // Date | Fin inclusivo del período consultado. (optional)
    fechaFin: 2013-10-20T19:20:30+01:00,
    // string | Valor de monedaBase aceptado por el handler. (optional)
    monedaBase: monedaBase_example,
    // string | Valor de tipoAnalisis aceptado por el handler. (optional)
    tipoAnalisis: tipoAnalisis_example,
  } satisfies MobileGetAccountingReportsExchangeImpactRequest;

  try {
    const data = await api.mobileGetAccountingReportsExchangeImpact(body);
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
| **monedaBase** | `string` | Valor de monedaBase aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **tipoAnalisis** | `string` | Valor de tipoAnalisis aceptado por el handler. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingReportsExchangeImpactResponse**](GetAccountingReportsExchangeImpactResponse.md)

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


## mobileGetAccountingReportsMovements

> GetAccountingReportsMovementsResponse mobileGetAccountingReportsMovements(busqueda, fechaInicio, fechaFin, cuentaId, tipoMovimiento, moneda, page, limit, formato)

Consultar movimientos contables

Lista entradas y salidas contables y puede devolver su exportación CSV. Permite precisar la consulta mediante texto libre, fecha inicial, fecha final, cuenta bancaria, tipo de movimiento, moneda, página, límite por página, formato de exportación.

### Example

```ts
import {
  Configuration,
  AccountingReportsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingReportsMovementsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReportsApi(config);

  const body = {
    // string | Valor de busqueda aceptado por el handler. (optional)
    busqueda: busqueda_example,
    // Date | Inicio inclusivo del período consultado. (optional)
    fechaInicio: 2013-10-20T19:20:30+01:00,
    // Date | Fin inclusivo del período consultado. (optional)
    fechaFin: 2013-10-20T19:20:30+01:00,
    // string | Identificador de la cuenta bancaria. (optional)
    cuentaId: cuentaId_example,
    // string | Valor de tipoMovimiento aceptado por el handler. (optional)
    tipoMovimiento: tipoMovimiento_example,
    // string | Código de moneda. (optional)
    moneda: moneda_example,
    // number | Página solicitada, comenzando en 1. (optional)
    page: 56,
    // number | Cantidad máxima de elementos por página. (optional)
    limit: 56,
    // string | Valor de formato aceptado por el handler. (optional)
    formato: formato_example,
  } satisfies MobileGetAccountingReportsMovementsRequest;

  try {
    const data = await api.mobileGetAccountingReportsMovements(body);
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
| **busqueda** | `string` | Valor de busqueda aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **fechaInicio** | `Date` | Inicio inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **fechaFin** | `Date` | Fin inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **cuentaId** | `string` | Identificador de la cuenta bancaria. | [Optional] [Defaults to `undefined`] |
| **tipoMovimiento** | `string` | Valor de tipoMovimiento aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **moneda** | `string` | Código de moneda. | [Optional] [Defaults to `undefined`] |
| **page** | `number` | Página solicitada, comenzando en 1. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de elementos por página. | [Optional] [Defaults to `undefined`] |
| **formato** | `string` | Valor de formato aceptado por el handler. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingReportsMovementsResponse**](GetAccountingReportsMovementsResponse.md)

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


## mobileGetAccountingReportsOverdueInvoices

> GetAccountingReportsOverdueInvoicesResponse mobileGetAccountingReportsOverdueInvoices()

Consultar facturas vencidas

Identifica facturas cuyo vencimiento pasó y que aún conservan saldo pendiente.

### Example

```ts
import {
  Configuration,
  AccountingReportsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingReportsOverdueInvoicesRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReportsApi(config);

  try {
    const data = await api.mobileGetAccountingReportsOverdueInvoices();
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

[**GetAccountingReportsOverdueInvoicesResponse**](GetAccountingReportsOverdueInvoicesResponse.md)

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
| **403** | No autorizado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAccountingReportsSummary

> GetAccountingReportsSummaryResponse mobileGetAccountingReportsSummary(fechaInicio, fechaFin, cuentaId, moneda, _export)

Consultar resumen financiero

Consolida saldos, ingresos, egresos y actividad contable del período. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria, moneda, formato de exportación.

### Example

```ts
import {
  Configuration,
  AccountingReportsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingReportsSummaryRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReportsApi(config);

  const body = {
    // Date | Inicio inclusivo del período consultado. (optional)
    fechaInicio: 2013-10-20T19:20:30+01:00,
    // Date | Fin inclusivo del período consultado. (optional)
    fechaFin: 2013-10-20T19:20:30+01:00,
    // string | Identificador de la cuenta bancaria. (optional)
    cuentaId: cuentaId_example,
    // string | Código de moneda. (optional)
    moneda: moneda_example,
    // string | Valor de export aceptado por el handler. (optional)
    _export: _export_example,
  } satisfies MobileGetAccountingReportsSummaryRequest;

  try {
    const data = await api.mobileGetAccountingReportsSummary(body);
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
| **moneda** | `string` | Código de moneda. | [Optional] [Defaults to `undefined`] |
| **_export** | `string` | Valor de export aceptado por el handler. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingReportsSummaryResponse**](GetAccountingReportsSummaryResponse.md)

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


## mobileGetAccountingReportsTransfers

> GetAccountingReportsTransfersResponse mobileGetAccountingReportsTransfers(fechaInicio, fechaFin, cuentaOrigenId, cuentaDestinoId, moneda, page, limit, realizadoPor, _export)

Consultar reporte de transferencias

Analiza transferencias por cuentas, monedas y responsable, con exportación opcional. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta de origen, cuenta de destino, moneda, página, límite por página, usuario responsable, formato de exportación.

### Example

```ts
import {
  Configuration,
  AccountingReportsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingReportsTransfersRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReportsApi(config);

  const body = {
    // Date | Inicio inclusivo del período consultado. (optional)
    fechaInicio: 2013-10-20T19:20:30+01:00,
    // Date | Fin inclusivo del período consultado. (optional)
    fechaFin: 2013-10-20T19:20:30+01:00,
    // string | Valor de cuentaOrigenId aceptado por el handler. (optional)
    cuentaOrigenId: cuentaOrigenId_example,
    // string | Valor de cuentaDestinoId aceptado por el handler. (optional)
    cuentaDestinoId: cuentaDestinoId_example,
    // string | Código de moneda. (optional)
    moneda: moneda_example,
    // number | Página solicitada, comenzando en 1. (optional)
    page: 56,
    // number | Cantidad máxima de elementos por página. (optional)
    limit: 56,
    // string | Valor de realizadoPor aceptado por el handler. (optional)
    realizadoPor: realizadoPor_example,
    // string | Valor de export aceptado por el handler. (optional)
    _export: _export_example,
  } satisfies MobileGetAccountingReportsTransfersRequest;

  try {
    const data = await api.mobileGetAccountingReportsTransfers(body);
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
| **cuentaOrigenId** | `string` | Valor de cuentaOrigenId aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **cuentaDestinoId** | `string` | Valor de cuentaDestinoId aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **moneda** | `string` | Código de moneda. | [Optional] [Defaults to `undefined`] |
| **page** | `number` | Página solicitada, comenzando en 1. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de elementos por página. | [Optional] [Defaults to `undefined`] |
| **realizadoPor** | `string` | Valor de realizadoPor aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **_export** | `string` | Valor de export aceptado por el handler. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingReportsTransfersResponse**](GetAccountingReportsTransfersResponse.md)

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

