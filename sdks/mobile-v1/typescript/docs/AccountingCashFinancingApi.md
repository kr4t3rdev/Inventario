# AccountingCashFinancingApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetAccountingCashDebts**](AccountingCashFinancingApi.md#mobilegetaccountingcashdebts) | **GET** /accounting/cash-debts | Consultar deudas de efectivo |
| [**mobileGetAccountingCashDebtsById**](AccountingCashFinancingApi.md#mobilegetaccountingcashdebtsbyid) | **GET** /accounting/cash-debts/{id} | Consultar deudas de efectivo |
| [**mobileGetAccountingCashDebtsStats**](AccountingCashFinancingApi.md#mobilegetaccountingcashdebtsstats) | **GET** /accounting/cash-debts/stats | Consultar indicadores de deudas de efectivo |
| [**mobileGetAccountingCashLoans**](AccountingCashFinancingApi.md#mobilegetaccountingcashloans) | **GET** /accounting/cash-loans | Consultar préstamos de efectivo |
| [**mobileGetAccountingCashLoansById**](AccountingCashFinancingApi.md#mobilegetaccountingcashloansbyid) | **GET** /accounting/cash-loans/{id} | Consultar préstamos de efectivo |
| [**mobileGetAccountingCashLoansByIdComprobante**](AccountingCashFinancingApi.md#mobilegetaccountingcashloansbyidcomprobante) | **GET** /accounting/cash-loans/{id}/comprobante | Descargar comprobante de préstamos de efectivo |
| [**mobileGetAccountingCashLoansByIdNestedHistory**](AccountingCashFinancingApi.md#mobilegetaccountingcashloansbyidnestedhistory) | **GET** /accounting/cash-loans/{id}/history | Consultar historial de préstamos de efectivo |
| [**mobileGetAccountingCashLoansStats**](AccountingCashFinancingApi.md#mobilegetaccountingcashloansstats) | **GET** /accounting/cash-loans/stats | Consultar indicadores de préstamos de efectivo |
| [**mobilePostAccountingCashDebts**](AccountingCashFinancingApi.md#mobilepostaccountingcashdebts) | **POST** /accounting/cash-debts | Registrar deudas de efectivo |
| [**mobilePostAccountingCashDebtsByIdPayments**](AccountingCashFinancingApi.md#mobilepostaccountingcashdebtsbyidpayments) | **POST** /accounting/cash-debts/{id}/payments | Registrar pago de deudas de efectivo |
| [**mobilePostAccountingCashLoans**](AccountingCashFinancingApi.md#mobilepostaccountingcashloans) | **POST** /accounting/cash-loans | Registrar préstamos de efectivo |
| [**mobilePostAccountingCashLoansByIdPayments**](AccountingCashFinancingApi.md#mobilepostaccountingcashloansbyidpayments) | **POST** /accounting/cash-loans/{id}/payments | Registrar pago de préstamos de efectivo |
| [**mobilePutAccountingCashDebtsById**](AccountingCashFinancingApi.md#mobileputaccountingcashdebtsbyid) | **PUT** /accounting/cash-debts/{id} | Actualizar deudas de efectivo |
| [**mobilePutAccountingCashLoansById**](AccountingCashFinancingApi.md#mobileputaccountingcashloansbyid) | **PUT** /accounting/cash-loans/{id} | Actualizar préstamos de efectivo |



## mobileGetAccountingCashDebts

> GetAccountingCashDebtsResponse mobileGetAccountingCashDebts(estado, proveedorId, moneda, page, limit)

Consultar deudas de efectivo

Lista deudas de efectivo con proveedores, sus vencimientos y saldos. Permite precisar la consulta mediante estado, proveedor, moneda, página, límite por página.

### Example

```ts
import {
  Configuration,
  AccountingCashFinancingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingCashDebtsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingCashFinancingApi(config);

  const body = {
    // boolean | Estado usado para filtrar resultados. (optional)
    estado: true,
    // string | Identificador del proveedor. (optional)
    proveedorId: proveedorId_example,
    // string | Código de moneda. (optional)
    moneda: moneda_example,
    // number | Página solicitada, comenzando en 1. (optional)
    page: 56,
    // number | Cantidad máxima de elementos por página. (optional)
    limit: 56,
  } satisfies MobileGetAccountingCashDebtsRequest;

  try {
    const data = await api.mobileGetAccountingCashDebts(body);
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
| **estado** | `boolean` | Estado usado para filtrar resultados. | [Optional] [Defaults to `undefined`] |
| **proveedorId** | `string` | Identificador del proveedor. | [Optional] [Defaults to `undefined`] |
| **moneda** | `string` | Código de moneda. | [Optional] [Defaults to `undefined`] |
| **page** | `number` | Página solicitada, comenzando en 1. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de elementos por página. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingCashDebtsResponse**](GetAccountingCashDebtsResponse.md)

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


## mobileGetAccountingCashDebtsById

> GetAccountingCashDebtsIdResponse mobileGetAccountingCashDebtsById(id)

Consultar deudas de efectivo

Devuelve la deuda identificada con proveedor, cuenta por pagar y pagos relacionados.

### Example

```ts
import {
  Configuration,
  AccountingCashFinancingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingCashDebtsByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingCashFinancingApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
  } satisfies MobileGetAccountingCashDebtsByIdRequest;

  try {
    const data = await api.mobileGetAccountingCashDebtsById(body);
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
| **id** | `string` | Identificador único del recurso. | [Defaults to `undefined`] |

### Return type

[**GetAccountingCashDebtsIdResponse**](GetAccountingCashDebtsIdResponse.md)

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


## mobileGetAccountingCashDebtsStats

> GetAccountingCashDebtsStatsResponse mobileGetAccountingCashDebtsStats()

Consultar indicadores de deudas de efectivo

Calcula cantidad, capital y saldo pendiente de las deudas de efectivo.

### Example

```ts
import {
  Configuration,
  AccountingCashFinancingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingCashDebtsStatsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingCashFinancingApi(config);

  try {
    const data = await api.mobileGetAccountingCashDebtsStats();
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

[**GetAccountingCashDebtsStatsResponse**](GetAccountingCashDebtsStatsResponse.md)

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


## mobileGetAccountingCashLoans

> GetAccountingCashLoansResponse mobileGetAccountingCashLoans(estado, clienteId, moneda, page, limit)

Consultar préstamos de efectivo

Lista préstamos de efectivo otorgados a clientes, con vencimientos y saldos. Permite precisar la consulta mediante estado, cliente, moneda, página, límite por página.

### Example

```ts
import {
  Configuration,
  AccountingCashFinancingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingCashLoansRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingCashFinancingApi(config);

  const body = {
    // boolean | Estado usado para filtrar resultados. (optional)
    estado: true,
    // string | Identificador del cliente. (optional)
    clienteId: clienteId_example,
    // string | Código de moneda. (optional)
    moneda: moneda_example,
    // number | Página solicitada, comenzando en 1. (optional)
    page: 56,
    // number | Cantidad máxima de elementos por página. (optional)
    limit: 56,
  } satisfies MobileGetAccountingCashLoansRequest;

  try {
    const data = await api.mobileGetAccountingCashLoans(body);
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
| **estado** | `boolean` | Estado usado para filtrar resultados. | [Optional] [Defaults to `undefined`] |
| **clienteId** | `string` | Identificador del cliente. | [Optional] [Defaults to `undefined`] |
| **moneda** | `string` | Código de moneda. | [Optional] [Defaults to `undefined`] |
| **page** | `number` | Página solicitada, comenzando en 1. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de elementos por página. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingCashLoansResponse**](GetAccountingCashLoansResponse.md)

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


## mobileGetAccountingCashLoansById

> GetAccountingCashLoansIdResponse mobileGetAccountingCashLoansById(id)

Consultar préstamos de efectivo

Devuelve el préstamo identificado con cliente, cuenta por cobrar y pagos relacionados.

### Example

```ts
import {
  Configuration,
  AccountingCashFinancingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingCashLoansByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingCashFinancingApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
  } satisfies MobileGetAccountingCashLoansByIdRequest;

  try {
    const data = await api.mobileGetAccountingCashLoansById(body);
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
| **id** | `string` | Identificador único del recurso. | [Defaults to `undefined`] |

### Return type

[**GetAccountingCashLoansIdResponse**](GetAccountingCashLoansIdResponse.md)

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


## mobileGetAccountingCashLoansByIdComprobante

> Blob mobileGetAccountingCashLoansByIdComprobante(id)

Descargar comprobante de préstamos de efectivo

Genera el comprobante PDF del registro solicitado, conservando sus importes y referencias contables.

### Example

```ts
import {
  Configuration,
  AccountingCashFinancingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingCashLoansByIdComprobanteRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingCashFinancingApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
  } satisfies MobileGetAccountingCashLoansByIdComprobanteRequest;

  try {
    const data = await api.mobileGetAccountingCashLoansByIdComprobante(body);
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
| **id** | `string` | Identificador único del recurso. | [Defaults to `undefined`] |

### Return type

**Blob**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/pdf`, `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Documento PDF |  -  |
| **401** | No autenticado |  -  |
| **404** | Recurso no encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAccountingCashLoansByIdNestedHistory

> GetAccountingCashLoansIdHistoryResponse mobileGetAccountingCashLoansByIdNestedHistory(id)

Consultar historial de préstamos de efectivo

Devuelve los movimientos cronológicos asociados al registro solicitado para facilitar su trazabilidad.

### Example

```ts
import {
  Configuration,
  AccountingCashFinancingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingCashLoansByIdNestedHistoryRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingCashFinancingApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
  } satisfies MobileGetAccountingCashLoansByIdNestedHistoryRequest;

  try {
    const data = await api.mobileGetAccountingCashLoansByIdNestedHistory(body);
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
| **id** | `string` | Identificador único del recurso. | [Defaults to `undefined`] |

### Return type

[**GetAccountingCashLoansIdHistoryResponse**](GetAccountingCashLoansIdHistoryResponse.md)

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


## mobileGetAccountingCashLoansStats

> GetAccountingCashLoansStatsResponse mobileGetAccountingCashLoansStats()

Consultar indicadores de préstamos de efectivo

Calcula cantidad, capital y saldo pendiente de los préstamos de efectivo.

### Example

```ts
import {
  Configuration,
  AccountingCashFinancingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingCashLoansStatsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingCashFinancingApi(config);

  try {
    const data = await api.mobileGetAccountingCashLoansStats();
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

[**GetAccountingCashLoansStatsResponse**](GetAccountingCashLoansStatsResponse.md)

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


## mobilePostAccountingCashDebts

> PostAccountingCashDebtsResponse mobilePostAccountingCashDebts(cashDebtCreateRequest, estado, proveedorId, moneda, page, limit)

Registrar deudas de efectivo

Registra financiamiento recibido de un proveedor, incrementa la cuenta bancaria y crea la cuenta por pagar.

### Example

```ts
import {
  Configuration,
  AccountingCashFinancingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostAccountingCashDebtsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingCashFinancingApi(config);

  const body = {
    // CashDebtCreateRequest
    cashDebtCreateRequest: ...,
    // boolean | Estado usado para filtrar resultados. (optional)
    estado: true,
    // string | Identificador del proveedor. (optional)
    proveedorId: proveedorId_example,
    // string | Código de moneda. (optional)
    moneda: moneda_example,
    // number | Página solicitada, comenzando en 1. (optional)
    page: 56,
    // number | Cantidad máxima de elementos por página. (optional)
    limit: 56,
  } satisfies MobilePostAccountingCashDebtsRequest;

  try {
    const data = await api.mobilePostAccountingCashDebts(body);
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
| **cashDebtCreateRequest** | [CashDebtCreateRequest](CashDebtCreateRequest.md) |  | |
| **estado** | `boolean` | Estado usado para filtrar resultados. | [Optional] [Defaults to `undefined`] |
| **proveedorId** | `string` | Identificador del proveedor. | [Optional] [Defaults to `undefined`] |
| **moneda** | `string` | Código de moneda. | [Optional] [Defaults to `undefined`] |
| **page** | `number` | Página solicitada, comenzando en 1. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de elementos por página. | [Optional] [Defaults to `undefined`] |

### Return type

[**PostAccountingCashDebtsResponse**](PostAccountingCashDebtsResponse.md)

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


## mobilePostAccountingCashDebtsByIdPayments

> PostAccountingCashDebtsIdPaymentsResponse mobilePostAccountingCashDebtsByIdPayments(id, cashPaymentRequest)

Registrar pago de deudas de efectivo

Aplica un pago al saldo pendiente y registra sus efectos bancarios y contables.

### Example

```ts
import {
  Configuration,
  AccountingCashFinancingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostAccountingCashDebtsByIdPaymentsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingCashFinancingApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
    // CashPaymentRequest
    cashPaymentRequest: ...,
  } satisfies MobilePostAccountingCashDebtsByIdPaymentsRequest;

  try {
    const data = await api.mobilePostAccountingCashDebtsByIdPayments(body);
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
| **id** | `string` | Identificador único del recurso. | [Defaults to `undefined`] |
| **cashPaymentRequest** | [CashPaymentRequest](CashPaymentRequest.md) |  | |

### Return type

[**PostAccountingCashDebtsIdPaymentsResponse**](PostAccountingCashDebtsIdPaymentsResponse.md)

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


## mobilePostAccountingCashLoans

> PostAccountingCashLoansResponse mobilePostAccountingCashLoans(cashLoanCreateRequest, estado, clienteId, moneda, page, limit)

Registrar préstamos de efectivo

Registra un préstamo a un cliente, descuenta fondos de la cuenta bancaria y crea la cuenta por cobrar.

### Example

```ts
import {
  Configuration,
  AccountingCashFinancingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostAccountingCashLoansRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingCashFinancingApi(config);

  const body = {
    // CashLoanCreateRequest
    cashLoanCreateRequest: ...,
    // boolean | Estado usado para filtrar resultados. (optional)
    estado: true,
    // string | Identificador del cliente. (optional)
    clienteId: clienteId_example,
    // string | Código de moneda. (optional)
    moneda: moneda_example,
    // number | Página solicitada, comenzando en 1. (optional)
    page: 56,
    // number | Cantidad máxima de elementos por página. (optional)
    limit: 56,
  } satisfies MobilePostAccountingCashLoansRequest;

  try {
    const data = await api.mobilePostAccountingCashLoans(body);
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
| **cashLoanCreateRequest** | [CashLoanCreateRequest](CashLoanCreateRequest.md) |  | |
| **estado** | `boolean` | Estado usado para filtrar resultados. | [Optional] [Defaults to `undefined`] |
| **clienteId** | `string` | Identificador del cliente. | [Optional] [Defaults to `undefined`] |
| **moneda** | `string` | Código de moneda. | [Optional] [Defaults to `undefined`] |
| **page** | `number` | Página solicitada, comenzando en 1. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de elementos por página. | [Optional] [Defaults to `undefined`] |

### Return type

[**PostAccountingCashLoansResponse**](PostAccountingCashLoansResponse.md)

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


## mobilePostAccountingCashLoansByIdPayments

> PostAccountingCashLoansIdPaymentsResponse mobilePostAccountingCashLoansByIdPayments(id, cashPaymentRequest)

Registrar pago de préstamos de efectivo

Aplica un pago al saldo pendiente y registra sus efectos bancarios y contables.

### Example

```ts
import {
  Configuration,
  AccountingCashFinancingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostAccountingCashLoansByIdPaymentsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingCashFinancingApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
    // CashPaymentRequest
    cashPaymentRequest: ...,
  } satisfies MobilePostAccountingCashLoansByIdPaymentsRequest;

  try {
    const data = await api.mobilePostAccountingCashLoansByIdPayments(body);
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
| **id** | `string` | Identificador único del recurso. | [Defaults to `undefined`] |
| **cashPaymentRequest** | [CashPaymentRequest](CashPaymentRequest.md) |  | |

### Return type

[**PostAccountingCashLoansIdPaymentsResponse**](PostAccountingCashLoansIdPaymentsResponse.md)

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


## mobilePutAccountingCashDebtsById

> PutAccountingCashDebtsIdResponse mobilePutAccountingCashDebtsById(id, cashOperationUpdateRequest)

Actualizar deudas de efectivo

Actualiza vencimiento, tasa de interés u observaciones de la deuda identificada.

### Example

```ts
import {
  Configuration,
  AccountingCashFinancingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePutAccountingCashDebtsByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingCashFinancingApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
    // CashOperationUpdateRequest
    cashOperationUpdateRequest: ...,
  } satisfies MobilePutAccountingCashDebtsByIdRequest;

  try {
    const data = await api.mobilePutAccountingCashDebtsById(body);
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
| **id** | `string` | Identificador único del recurso. | [Defaults to `undefined`] |
| **cashOperationUpdateRequest** | [CashOperationUpdateRequest](CashOperationUpdateRequest.md) |  | |

### Return type

[**PutAccountingCashDebtsIdResponse**](PutAccountingCashDebtsIdResponse.md)

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


## mobilePutAccountingCashLoansById

> PutAccountingCashLoansIdResponse mobilePutAccountingCashLoansById(id, cashOperationUpdateRequest)

Actualizar préstamos de efectivo

Actualiza vencimiento, tasa de interés u observaciones del préstamo identificado.

### Example

```ts
import {
  Configuration,
  AccountingCashFinancingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePutAccountingCashLoansByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingCashFinancingApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
    // CashOperationUpdateRequest
    cashOperationUpdateRequest: ...,
  } satisfies MobilePutAccountingCashLoansByIdRequest;

  try {
    const data = await api.mobilePutAccountingCashLoansById(body);
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
| **id** | `string` | Identificador único del recurso. | [Defaults to `undefined`] |
| **cashOperationUpdateRequest** | [CashOperationUpdateRequest](CashOperationUpdateRequest.md) |  | |

### Return type

[**PutAccountingCashLoansIdResponse**](PutAccountingCashLoansIdResponse.md)

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

