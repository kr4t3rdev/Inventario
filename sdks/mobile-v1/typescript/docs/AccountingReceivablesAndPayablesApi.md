# AccountingReceivablesAndPayablesApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetAccountingAccountsPayable**](AccountingReceivablesAndPayablesApi.md#mobilegetaccountingaccountspayable) | **GET** /accounting/accounts-payable | Consultar cuentas por pagar |
| [**mobileGetAccountingAccountsReceivable**](AccountingReceivablesAndPayablesApi.md#mobilegetaccountingaccountsreceivable) | **GET** /accounting/accounts-receivable | Consultar cuentas por cobrar |
| [**mobileGetAccountingAccountsReceivableMetrics**](AccountingReceivablesAndPayablesApi.md#mobilegetaccountingaccountsreceivablemetrics) | **GET** /accounting/accounts-receivable/metrics | Consultar métricas de cuentas por cobrar |



## mobileGetAccountingAccountsPayable

> GetAccountingAccountsPayableResponse mobileGetAccountingAccountsPayable(search, estado, tipo, page, limit)

Consultar cuentas por pagar

Lista obligaciones con proveedores y muestra saldos, estado y métricas de pago. Permite precisar la consulta mediante texto de búsqueda, estado, tipo, página, límite por página.

### Example

```ts
import {
  Configuration,
  AccountingReceivablesAndPayablesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingAccountsPayableRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReceivablesAndPayablesApi(config);

  const body = {
    // string | Texto de búsqueda aplicado por el servicio. (optional)
    search: search_example,
    // boolean | Estado usado para filtrar resultados. (optional)
    estado: true,
    // string | Tipo de registro solicitado. (optional)
    tipo: tipo_example,
    // number | Página solicitada, comenzando en 1. (optional)
    page: 56,
    // number | Cantidad máxima de elementos por página. (optional)
    limit: 56,
  } satisfies MobileGetAccountingAccountsPayableRequest;

  try {
    const data = await api.mobileGetAccountingAccountsPayable(body);
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
| **search** | `string` | Texto de búsqueda aplicado por el servicio. | [Optional] [Defaults to `undefined`] |
| **estado** | `boolean` | Estado usado para filtrar resultados. | [Optional] [Defaults to `undefined`] |
| **tipo** | `string` | Tipo de registro solicitado. | [Optional] [Defaults to `undefined`] |
| **page** | `number` | Página solicitada, comenzando en 1. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de elementos por página. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingAccountsPayableResponse**](GetAccountingAccountsPayableResponse.md)

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


## mobileGetAccountingAccountsReceivable

> GetAccountingAccountsReceivableResponse mobileGetAccountingAccountsReceivable(search, estado, clienteId, page, limit)

Consultar cuentas por cobrar

Lista obligaciones de clientes y sus saldos pendientes dentro del tenant. Permite precisar la consulta mediante texto de búsqueda, estado, cliente, página, límite por página.

### Example

```ts
import {
  Configuration,
  AccountingReceivablesAndPayablesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingAccountsReceivableRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReceivablesAndPayablesApi(config);

  const body = {
    // string | Texto de búsqueda aplicado por el servicio. (optional)
    search: search_example,
    // boolean | Estado usado para filtrar resultados. (optional)
    estado: true,
    // string | Identificador del cliente. (optional)
    clienteId: clienteId_example,
    // number | Página solicitada, comenzando en 1. (optional)
    page: 56,
    // number | Cantidad máxima de elementos por página. (optional)
    limit: 56,
  } satisfies MobileGetAccountingAccountsReceivableRequest;

  try {
    const data = await api.mobileGetAccountingAccountsReceivable(body);
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
| **search** | `string` | Texto de búsqueda aplicado por el servicio. | [Optional] [Defaults to `undefined`] |
| **estado** | `boolean` | Estado usado para filtrar resultados. | [Optional] [Defaults to `undefined`] |
| **clienteId** | `string` | Identificador del cliente. | [Optional] [Defaults to `undefined`] |
| **page** | `number` | Página solicitada, comenzando en 1. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de elementos por página. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingAccountsReceivableResponse**](GetAccountingAccountsReceivableResponse.md)

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


## mobileGetAccountingAccountsReceivableMetrics

> GetAccountingAccountsReceivableMetricsResponse mobileGetAccountingAccountsReceivableMetrics()

Consultar métricas de cuentas por cobrar

Calcula los importes agregados y estados de las cuentas por cobrar.

### Example

```ts
import {
  Configuration,
  AccountingReceivablesAndPayablesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingAccountsReceivableMetricsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingReceivablesAndPayablesApi(config);

  try {
    const data = await api.mobileGetAccountingAccountsReceivableMetrics();
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

[**GetAccountingAccountsReceivableMetricsResponse**](GetAccountingAccountsReceivableMetricsResponse.md)

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

