# AccountingBankingApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetAccountingBankAccounts**](AccountingBankingApi.md#mobilegetaccountingbankaccounts) | **GET** /accounting/bank-accounts | Consultar cuentas bancarias |
| [**mobileGetAccountingBankAccountsById**](AccountingBankingApi.md#mobilegetaccountingbankaccountsbyid) | **GET** /accounting/bank-accounts/{id} | Consultar cuentas bancaria |
| [**mobileGetAccountingBankAccountsByIdNestedHistory**](AccountingBankingApi.md#mobilegetaccountingbankaccountsbyidnestedhistory) | **GET** /accounting/bank-accounts/{id}/history | Consultar historial de cuentas bancarias |
| [**mobileGetAccountingBankAdjustments**](AccountingBankingApi.md#mobilegetaccountingbankadjustments) | **GET** /accounting/bank-adjustments | Consultar ajustes bancarios |
| [**mobileGetAccountingBankTransfers**](AccountingBankingApi.md#mobilegetaccountingbanktransfers) | **GET** /accounting/bank-transfers | Consultar transferencias bancarias |
| [**mobileGetAccountingBankTransfersById**](AccountingBankingApi.md#mobilegetaccountingbanktransfersbyid) | **GET** /accounting/bank-transfers/{id} | Consultar transferencias bancaria |
| [**mobileGetAccountingBankTransfersByIdComprobante**](AccountingBankingApi.md#mobilegetaccountingbanktransfersbyidcomprobante) | **GET** /accounting/bank-transfers/{id}/comprobante | Descargar comprobante de transferencias bancarias |
| [**mobilePostAccountingBankAdjustments**](AccountingBankingApi.md#mobilepostaccountingbankadjustments) | **POST** /accounting/bank-adjustments | Registrar ajustes bancarios |
| [**mobilePostAccountingBankTransfers**](AccountingBankingApi.md#mobilepostaccountingbanktransfers) | **POST** /accounting/bank-transfers | Registrar transferencias bancarias |
| [**mobilePostAccountingBankTransfersValidate**](AccountingBankingApi.md#mobilepostaccountingbanktransfersvalidate) | **POST** /accounting/bank-transfers/validate | Validar transferencia bancaria |



## mobileGetAccountingBankAccounts

> GetAccountingBankAccountsResponse mobileGetAccountingBankAccounts()

Consultar cuentas bancarias

Lista las cuentas bancarias activas disponibles para operaciones contables.

### Example

```ts
import {
  Configuration,
  AccountingBankingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingBankAccountsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingBankingApi(config);

  try {
    const data = await api.mobileGetAccountingBankAccounts();
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

[**GetAccountingBankAccountsResponse**](GetAccountingBankAccountsResponse.md)

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


## mobileGetAccountingBankAccountsById

> GetAccountingBankAccountsIdResponse mobileGetAccountingBankAccountsById(id)

Consultar cuentas bancaria

Devuelve datos, saldo y moneda de la cuenta bancaria identificada.

### Example

```ts
import {
  Configuration,
  AccountingBankingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingBankAccountsByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingBankingApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
  } satisfies MobileGetAccountingBankAccountsByIdRequest;

  try {
    const data = await api.mobileGetAccountingBankAccountsById(body);
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

[**GetAccountingBankAccountsIdResponse**](GetAccountingBankAccountsIdResponse.md)

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


## mobileGetAccountingBankAccountsByIdNestedHistory

> GetAccountingBankAccountsIdHistoryResponse mobileGetAccountingBankAccountsByIdNestedHistory(id, fechaInicio, fechaFin, tipoMovimiento, page, limit)

Consultar historial de cuentas bancarias

Devuelve los movimientos cronológicos asociados al registro solicitado para facilitar su trazabilidad.

### Example

```ts
import {
  Configuration,
  AccountingBankingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingBankAccountsByIdNestedHistoryRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingBankingApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
    // Date | Inicio inclusivo del período consultado. (optional)
    fechaInicio: 2013-10-20T19:20:30+01:00,
    // Date | Fin inclusivo del período consultado. (optional)
    fechaFin: 2013-10-20T19:20:30+01:00,
    // string | Valor de tipoMovimiento aceptado por el handler. (optional)
    tipoMovimiento: tipoMovimiento_example,
    // number | Página solicitada, comenzando en 1. (optional)
    page: 56,
    // number | Cantidad máxima de elementos por página. (optional)
    limit: 56,
  } satisfies MobileGetAccountingBankAccountsByIdNestedHistoryRequest;

  try {
    const data = await api.mobileGetAccountingBankAccountsByIdNestedHistory(body);
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
| **fechaInicio** | `Date` | Inicio inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **fechaFin** | `Date` | Fin inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **tipoMovimiento** | `string` | Valor de tipoMovimiento aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **page** | `number` | Página solicitada, comenzando en 1. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de elementos por página. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingBankAccountsIdHistoryResponse**](GetAccountingBankAccountsIdHistoryResponse.md)

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


## mobileGetAccountingBankAdjustments

> GetAccountingBankAdjustmentsResponse mobileGetAccountingBankAdjustments(cuentaId, tipo, fechaInicio, fechaFin, page, limit)

Consultar ajustes bancarios

Lista ingresos y egresos manuales registrados sobre cuentas bancarias. Permite precisar la consulta mediante cuenta bancaria, tipo, fecha inicial, fecha final, página, límite por página.

### Example

```ts
import {
  Configuration,
  AccountingBankingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingBankAdjustmentsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingBankingApi(config);

  const body = {
    // string | Identificador de la cuenta bancaria. (optional)
    cuentaId: cuentaId_example,
    // string | Tipo de registro solicitado. (optional)
    tipo: tipo_example,
    // Date | Inicio inclusivo del período consultado. (optional)
    fechaInicio: 2013-10-20T19:20:30+01:00,
    // Date | Fin inclusivo del período consultado. (optional)
    fechaFin: 2013-10-20T19:20:30+01:00,
    // number | Página solicitada, comenzando en 1. (optional)
    page: 56,
    // number | Cantidad máxima de elementos por página. (optional)
    limit: 56,
  } satisfies MobileGetAccountingBankAdjustmentsRequest;

  try {
    const data = await api.mobileGetAccountingBankAdjustments(body);
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
| **cuentaId** | `string` | Identificador de la cuenta bancaria. | [Optional] [Defaults to `undefined`] |
| **tipo** | `string` | Tipo de registro solicitado. | [Optional] [Defaults to `undefined`] |
| **fechaInicio** | `Date` | Inicio inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **fechaFin** | `Date` | Fin inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **page** | `number` | Página solicitada, comenzando en 1. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de elementos por página. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingBankAdjustmentsResponse**](GetAccountingBankAdjustmentsResponse.md)

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


## mobileGetAccountingBankTransfers

> GetAccountingBankTransfersResponse mobileGetAccountingBankTransfers(fechaInicio, fechaFin, cuentaId)

Consultar transferencias bancarias

Lista transferencias entre cuentas con importes de origen, destino y tasa aplicada. Permite precisar la consulta mediante fecha inicial, fecha final, cuenta bancaria.

### Example

```ts
import {
  Configuration,
  AccountingBankingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingBankTransfersRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingBankingApi(config);

  const body = {
    // Date | Inicio inclusivo del período consultado. (optional)
    fechaInicio: 2013-10-20T19:20:30+01:00,
    // Date | Fin inclusivo del período consultado. (optional)
    fechaFin: 2013-10-20T19:20:30+01:00,
    // string | Identificador de la cuenta bancaria. (optional)
    cuentaId: cuentaId_example,
  } satisfies MobileGetAccountingBankTransfersRequest;

  try {
    const data = await api.mobileGetAccountingBankTransfers(body);
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

[**GetAccountingBankTransfersResponse**](GetAccountingBankTransfersResponse.md)

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


## mobileGetAccountingBankTransfersById

> GetAccountingBankTransfersIdResponse mobileGetAccountingBankTransfersById(id)

Consultar transferencias bancaria

Devuelve importes, cuentas, moneda, tasa y comprobante de la transferencia identificada.

### Example

```ts
import {
  Configuration,
  AccountingBankingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingBankTransfersByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingBankingApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
  } satisfies MobileGetAccountingBankTransfersByIdRequest;

  try {
    const data = await api.mobileGetAccountingBankTransfersById(body);
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

[**GetAccountingBankTransfersIdResponse**](GetAccountingBankTransfersIdResponse.md)

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


## mobileGetAccountingBankTransfersByIdComprobante

> Blob mobileGetAccountingBankTransfersByIdComprobante(id)

Descargar comprobante de transferencias bancarias

Genera el comprobante PDF del registro solicitado, conservando sus importes y referencias contables.

### Example

```ts
import {
  Configuration,
  AccountingBankingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingBankTransfersByIdComprobanteRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingBankingApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
  } satisfies MobileGetAccountingBankTransfersByIdComprobanteRequest;

  try {
    const data = await api.mobileGetAccountingBankTransfersByIdComprobante(body);
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
| **500** | Error interno |  -  |
| **404** | Transferencia bancaria no encontrada |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobilePostAccountingBankAdjustments

> PostAccountingBankAdjustmentsResponse mobilePostAccountingBankAdjustments(bankAdjustmentRequest, cuentaId, tipo, fechaInicio, fechaFin, page, limit)

Registrar ajustes bancarios

Registra un ingreso o egreso manual y actualiza el saldo de la cuenta bancaria seleccionada.

### Example

```ts
import {
  Configuration,
  AccountingBankingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostAccountingBankAdjustmentsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingBankingApi(config);

  const body = {
    // BankAdjustmentRequest
    bankAdjustmentRequest: ...,
    // string | Identificador de la cuenta bancaria. (optional)
    cuentaId: cuentaId_example,
    // string | Tipo de registro solicitado. (optional)
    tipo: tipo_example,
    // Date | Inicio inclusivo del período consultado. (optional)
    fechaInicio: 2013-10-20T19:20:30+01:00,
    // Date | Fin inclusivo del período consultado. (optional)
    fechaFin: 2013-10-20T19:20:30+01:00,
    // number | Página solicitada, comenzando en 1. (optional)
    page: 56,
    // number | Cantidad máxima de elementos por página. (optional)
    limit: 56,
  } satisfies MobilePostAccountingBankAdjustmentsRequest;

  try {
    const data = await api.mobilePostAccountingBankAdjustments(body);
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
| **bankAdjustmentRequest** | [BankAdjustmentRequest](BankAdjustmentRequest.md) |  | |
| **cuentaId** | `string` | Identificador de la cuenta bancaria. | [Optional] [Defaults to `undefined`] |
| **tipo** | `string` | Tipo de registro solicitado. | [Optional] [Defaults to `undefined`] |
| **fechaInicio** | `Date` | Inicio inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **fechaFin** | `Date` | Fin inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **page** | `number` | Página solicitada, comenzando en 1. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de elementos por página. | [Optional] [Defaults to `undefined`] |

### Return type

[**PostAccountingBankAdjustmentsResponse**](PostAccountingBankAdjustmentsResponse.md)

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


## mobilePostAccountingBankTransfers

> PostAccountingBankTransfersResponse mobilePostAccountingBankTransfers(bankTransferCreateRequest, fechaInicio, fechaFin, cuentaId)

Registrar transferencias bancarias

Transfiere fondos entre dos cuentas, aplicando conversión cuando las monedas son diferentes.

### Example

```ts
import {
  Configuration,
  AccountingBankingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostAccountingBankTransfersRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingBankingApi(config);

  const body = {
    // BankTransferCreateRequest
    bankTransferCreateRequest: ...,
    // Date | Inicio inclusivo del período consultado. (optional)
    fechaInicio: 2013-10-20T19:20:30+01:00,
    // Date | Fin inclusivo del período consultado. (optional)
    fechaFin: 2013-10-20T19:20:30+01:00,
    // string | Identificador de la cuenta bancaria. (optional)
    cuentaId: cuentaId_example,
  } satisfies MobilePostAccountingBankTransfersRequest;

  try {
    const data = await api.mobilePostAccountingBankTransfers(body);
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
| **bankTransferCreateRequest** | [BankTransferCreateRequest](BankTransferCreateRequest.md) |  | |
| **fechaInicio** | `Date` | Inicio inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **fechaFin** | `Date` | Fin inclusivo del período consultado. | [Optional] [Defaults to `undefined`] |
| **cuentaId** | `string` | Identificador de la cuenta bancaria. | [Optional] [Defaults to `undefined`] |

### Return type

[**PostAccountingBankTransfersResponse**](PostAccountingBankTransfersResponse.md)

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


## mobilePostAccountingBankTransfersValidate

> PostAccountingBankTransfersValidateResponse mobilePostAccountingBankTransfersValidate(bankTransferValidationRequest)

Validar transferencia bancaria

Comprueba cuentas, monedas, saldo e importes antes de registrar una transferencia.

### Example

```ts
import {
  Configuration,
  AccountingBankingApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostAccountingBankTransfersValidateRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingBankingApi(config);

  const body = {
    // BankTransferValidationRequest
    bankTransferValidationRequest: ...,
  } satisfies MobilePostAccountingBankTransfersValidateRequest;

  try {
    const data = await api.mobilePostAccountingBankTransfersValidate(body);
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
| **bankTransferValidationRequest** | [BankTransferValidationRequest](BankTransferValidationRequest.md) |  | |

### Return type

[**PostAccountingBankTransfersValidateResponse**](PostAccountingBankTransfersValidateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

