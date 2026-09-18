# AccountingConfigurationApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileDeleteAccountingPaymentTypesById**](AccountingConfigurationApi.md#mobiledeleteaccountingpaymenttypesbyid) | **DELETE** /accounting/payment-types/{id} | Eliminar tipos de pago |
| [**mobileGetAccountingExchangeMonedas**](AccountingConfigurationApi.md#mobilegetaccountingexchangemonedas) | **GET** /accounting/exchange/monedas | Consultar monedas configuradas |
| [**mobileGetAccountingExchangeTasas**](AccountingConfigurationApi.md#mobilegetaccountingexchangetasas) | **GET** /accounting/exchange/tasas | Consultar tasas de cambio |
| [**mobileGetAccountingLogs**](AccountingConfigurationApi.md#mobilegetaccountinglogs) | **GET** /accounting/logs | Consultar eventos de auditoría contable |
| [**mobileGetAccountingPaymentTypes**](AccountingConfigurationApi.md#mobilegetaccountingpaymenttypes) | **GET** /accounting/payment-types | Consultar tipos de pago |
| [**mobileGetAccountingPaymentTypesAvailableAccounts**](AccountingConfigurationApi.md#mobilegetaccountingpaymenttypesavailableaccounts) | **GET** /accounting/payment-types/available-accounts | Consultar cuentas disponibles para tipos de pago |
| [**mobileGetAccountingPaymentTypesById**](AccountingConfigurationApi.md#mobilegetaccountingpaymenttypesbyid) | **GET** /accounting/payment-types/{id} | Consultar tipos de pago |
| [**mobilePutAccountingPaymentTypesById**](AccountingConfigurationApi.md#mobileputaccountingpaymenttypesbyid) | **PUT** /accounting/payment-types/{id} | Actualizar tipos de pago |



## mobileDeleteAccountingPaymentTypesById

> DeleteAccountingPaymentTypesIdResponse mobileDeleteAccountingPaymentTypesById(id)

Eliminar tipos de pago

Elimina el medio de pago únicamente cuando no tiene conciliaciones asociadas.

### Example

```ts
import {
  Configuration,
  AccountingConfigurationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileDeleteAccountingPaymentTypesByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingConfigurationApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
  } satisfies MobileDeleteAccountingPaymentTypesByIdRequest;

  try {
    const data = await api.mobileDeleteAccountingPaymentTypesById(body);
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

[**DeleteAccountingPaymentTypesIdResponse**](DeleteAccountingPaymentTypesIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Datos inválidos, período cerrado o relaciones contables incompatibles. |  -  |
| **401** | No autenticado |  -  |
| **403** | El usuario autenticado no tiene permisos de Manager. |  -  |
| **404** | El tipo de pago o la cuenta bancaria indicada no existe en el tenant. |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAccountingExchangeMonedas

> GetAccountingExchangeMonedasResponse mobileGetAccountingExchangeMonedas()

Consultar monedas configuradas

Devuelve el catálogo de monedas habilitadas para operaciones y reportes contables.

### Example

```ts
import {
  Configuration,
  AccountingConfigurationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingExchangeMonedasRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingConfigurationApi(config);

  try {
    const data = await api.mobileGetAccountingExchangeMonedas();
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

[**GetAccountingExchangeMonedasResponse**](GetAccountingExchangeMonedasResponse.md)

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


## mobileGetAccountingExchangeTasas

> GetAccountingExchangeTasasResponse mobileGetAccountingExchangeTasas()

Consultar tasas de cambio

Devuelve las tasas de cambio vigentes e históricas utilizadas por contabilidad.

### Example

```ts
import {
  Configuration,
  AccountingConfigurationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingExchangeTasasRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingConfigurationApi(config);

  try {
    const data = await api.mobileGetAccountingExchangeTasas();
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

[**GetAccountingExchangeTasasResponse**](GetAccountingExchangeTasasResponse.md)

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


## mobileGetAccountingLogs

> GetAccountingLogsResponse mobileGetAccountingLogs(entidad, limit, offset)

Consultar eventos de auditoría contable

Consulta la trazabilidad de acciones contables registrada por usuario y entidad. Permite precisar la consulta mediante entidad, límite por página, offset.

### Example

```ts
import {
  Configuration,
  AccountingConfigurationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingLogsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingConfigurationApi(config);

  const body = {
    // string | Valor de entidad aceptado por el handler. (optional)
    entidad: entidad_example,
    // number | Cantidad máxima de elementos por página. (optional)
    limit: 56,
    // string | Valor de offset aceptado por el handler. (optional)
    offset: offset_example,
  } satisfies MobileGetAccountingLogsRequest;

  try {
    const data = await api.mobileGetAccountingLogs(body);
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
| **entidad** | `string` | Valor de entidad aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Cantidad máxima de elementos por página. | [Optional] [Defaults to `undefined`] |
| **offset** | `string` | Valor de offset aceptado por el handler. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingLogsResponse**](GetAccountingLogsResponse.md)

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


## mobileGetAccountingPaymentTypes

> GetAccountingPaymentTypesResponse mobileGetAccountingPaymentTypes(includeInactive, requiereCuenta)

Consultar tipos de pago

Lista los medios de pago configurados y su cuenta bancaria predeterminada. Permite precisar la consulta mediante includeInactive, requiereCuenta.

### Example

```ts
import {
  Configuration,
  AccountingConfigurationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingPaymentTypesRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingConfigurationApi(config);

  const body = {
    // boolean | Valor de includeInactive aceptado por el handler. (optional)
    includeInactive: true,
    // string | Valor de requiereCuenta aceptado por el handler. (optional)
    requiereCuenta: requiereCuenta_example,
  } satisfies MobileGetAccountingPaymentTypesRequest;

  try {
    const data = await api.mobileGetAccountingPaymentTypes(body);
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
| **includeInactive** | `boolean` | Valor de includeInactive aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **requiereCuenta** | `string` | Valor de requiereCuenta aceptado por el handler. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingPaymentTypesResponse**](GetAccountingPaymentTypesResponse.md)

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


## mobileGetAccountingPaymentTypesAvailableAccounts

> GetAccountingPaymentTypesAvailableAccountsResponse mobileGetAccountingPaymentTypesAvailableAccounts(moneda, tipoCuenta)

Consultar cuentas disponibles para tipos de pago

Lista cuentas activas que pueden asociarse como cuenta predeterminada de un medio de pago. Permite precisar la consulta mediante moneda, tipoCuenta.

### Example

```ts
import {
  Configuration,
  AccountingConfigurationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingPaymentTypesAvailableAccountsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingConfigurationApi(config);

  const body = {
    // string | Código de moneda. (optional)
    moneda: moneda_example,
    // string | Valor de tipoCuenta aceptado por el handler. (optional)
    tipoCuenta: tipoCuenta_example,
  } satisfies MobileGetAccountingPaymentTypesAvailableAccountsRequest;

  try {
    const data = await api.mobileGetAccountingPaymentTypesAvailableAccounts(body);
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
| **moneda** | `string` | Código de moneda. | [Optional] [Defaults to `undefined`] |
| **tipoCuenta** | `string` | Valor de tipoCuenta aceptado por el handler. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingPaymentTypesAvailableAccountsResponse**](GetAccountingPaymentTypesAvailableAccountsResponse.md)

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


## mobileGetAccountingPaymentTypesById

> GetAccountingPaymentTypesIdResponse mobileGetAccountingPaymentTypesById(id)

Consultar tipos de pago

Devuelve el medio de pago identificado, sus conciliaciones asociadas y la cuenta predeterminada.

### Example

```ts
import {
  Configuration,
  AccountingConfigurationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingPaymentTypesByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingConfigurationApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
  } satisfies MobileGetAccountingPaymentTypesByIdRequest;

  try {
    const data = await api.mobileGetAccountingPaymentTypesById(body);
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

[**GetAccountingPaymentTypesIdResponse**](GetAccountingPaymentTypesIdResponse.md)

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
| **404** | Recurso no encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobilePutAccountingPaymentTypesById

> PutAccountingPaymentTypesIdResponse mobilePutAccountingPaymentTypesById(id, paymentTypeUpdateRequest)

Actualizar tipos de pago

Actualiza nombre, descripción, requisito de cuenta, cuenta predeterminada o estado activo del medio de pago.

### Example

```ts
import {
  Configuration,
  AccountingConfigurationApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePutAccountingPaymentTypesByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingConfigurationApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
    // PaymentTypeUpdateRequest
    paymentTypeUpdateRequest: ...,
  } satisfies MobilePutAccountingPaymentTypesByIdRequest;

  try {
    const data = await api.mobilePutAccountingPaymentTypesById(body);
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
| **paymentTypeUpdateRequest** | [PaymentTypeUpdateRequest](PaymentTypeUpdateRequest.md) |  | |

### Return type

[**PutAccountingPaymentTypesIdResponse**](PutAccountingPaymentTypesIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Datos inválidos, período cerrado o relaciones contables incompatibles. |  -  |
| **401** | No autenticado |  -  |
| **403** | El usuario autenticado no tiene permisos de Manager. |  -  |
| **404** | El tipo de pago o la cuenta bancaria indicada no existe en el tenant. |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

