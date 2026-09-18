# AccountingAdvancesApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileDeleteAccountingAdvancesById**](AccountingAdvancesApi.md#mobiledeleteaccountingadvancesbyid) | **DELETE** /accounting/advances/{id} | Eliminar anticipo |
| [**mobileGetAccountingAdvances**](AccountingAdvancesApi.md#mobilegetaccountingadvances) | **GET** /accounting/advances | Consultar anticipos |
| [**mobileGetAccountingAdvancesAvailable**](AccountingAdvancesApi.md#mobilegetaccountingadvancesavailable) | **GET** /accounting/advances/available | Consultar anticipos disponibles |
| [**mobileGetAccountingAdvancesById**](AccountingAdvancesApi.md#mobilegetaccountingadvancesbyid) | **GET** /accounting/advances/{id} | Consultar anticipo |
| [**mobilePostAccountingAdvances**](AccountingAdvancesApi.md#mobilepostaccountingadvances) | **POST** /accounting/advances | Registrar anticipos |
| [**mobilePostAccountingAdvancesByIdEjecutar**](AccountingAdvancesApi.md#mobilepostaccountingadvancesbyidejecutar) | **POST** /accounting/advances/{id}/ejecutar | Ejecutar anticipo reservado |
| [**mobilePostAccountingAdvancesByIdRevertir**](AccountingAdvancesApi.md#mobilepostaccountingadvancesbyidrevertir) | **POST** /accounting/advances/{id}/revertir | Revertir ejecución de anticipo |
| [**mobilePutAccountingAdvancesById**](AccountingAdvancesApi.md#mobileputaccountingadvancesbyid) | **PUT** /accounting/advances/{id} | Actualizar anticipo |



## mobileDeleteAccountingAdvancesById

> DeleteAccountingAdvancesIdResponse mobileDeleteAccountingAdvancesById(id)

Eliminar anticipo

Elimina el anticipo identificado después de comprobar que pertenece al tenant.

### Example

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

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | Identificador único del recurso. | [Defaults to `undefined`] |

### Return type

[**DeleteAccountingAdvancesIdResponse**](DeleteAccountingAdvancesIdResponse.md)

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
| **404** | Recurso no encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAccountingAdvances

> GetAccountingAdvancesResponse mobileGetAccountingAdvances()

Consultar anticipos

Consulta anticipos de pago o cobro con su saldo disponible y vigencia.

### Example

```ts
import {
  Configuration,
  AccountingAdvancesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingAdvancesRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingAdvancesApi(config);

  try {
    const data = await api.mobileGetAccountingAdvances();
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

[**GetAccountingAdvancesResponse**](GetAccountingAdvancesResponse.md)

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


## mobileGetAccountingAdvancesAvailable

> GetAccountingAdvancesAvailableResponse mobileGetAccountingAdvancesAvailable(contexto, proveedorId, clienteId, moneda, estado)

Consultar anticipos disponibles

Busca anticipos reservados con saldo que todavía pueden aplicarse a una compra o factura. Permite precisar la consulta mediante contexto de uso, proveedor, cliente, moneda, estado.

### Example

```ts
import {
  Configuration,
  AccountingAdvancesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingAdvancesAvailableRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingAdvancesApi(config);

  const body = {
    // 'compra' | 'factura' | Valor de contexto aceptado por el handler. (optional)
    contexto: contexto_example,
    // string | Identificador del proveedor. (optional)
    proveedorId: proveedorId_example,
    // string | Identificador del cliente. (optional)
    clienteId: clienteId_example,
    // string | Código de moneda. (optional)
    moneda: moneda_example,
    // boolean | Estado usado para filtrar resultados. (optional)
    estado: true,
  } satisfies MobileGetAccountingAdvancesAvailableRequest;

  try {
    const data = await api.mobileGetAccountingAdvancesAvailable(body);
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
| **contexto** | `compra`, `factura` | Valor de contexto aceptado por el handler. | [Optional] [Defaults to `undefined`] [Enum: compra, factura] |
| **proveedorId** | `string` | Identificador del proveedor. | [Optional] [Defaults to `undefined`] |
| **clienteId** | `string` | Identificador del cliente. | [Optional] [Defaults to `undefined`] |
| **moneda** | `string` | Código de moneda. | [Optional] [Defaults to `undefined`] |
| **estado** | `boolean` | Estado usado para filtrar resultados. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingAdvancesAvailableResponse**](GetAccountingAdvancesAvailableResponse.md)

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
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAccountingAdvancesById

> GetAccountingAdvancesIdResponse mobileGetAccountingAdvancesById(id)

Consultar anticipo

Devuelve el anticipo solicitado con contrato, contraparte y movimientos relacionados.

### Example

```ts
import {
  Configuration,
  AccountingAdvancesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingAdvancesByIdRequest } from '@tcp/mobile-v1-sdk';

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
  } satisfies MobileGetAccountingAdvancesByIdRequest;

  try {
    const data = await api.mobileGetAccountingAdvancesById(body);
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

[**GetAccountingAdvancesIdResponse**](GetAccountingAdvancesIdResponse.md)

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
| **404** | Recurso no encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobilePostAccountingAdvances

> PostAccountingAdvancesResponse mobilePostAccountingAdvances(accountingAdvancesPostRequest)

Registrar anticipos

Crea una reserva de anticipo de pago o cobro, vinculada al contrato y contraparte indicados.

### Example

```ts
import {
  Configuration,
  AccountingAdvancesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostAccountingAdvancesRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingAdvancesApi(config);

  const body = {
    // AccountingAdvancesPostRequest
    accountingAdvancesPostRequest: ...,
  } satisfies MobilePostAccountingAdvancesRequest;

  try {
    const data = await api.mobilePostAccountingAdvances(body);
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
| **accountingAdvancesPostRequest** | [AccountingAdvancesPostRequest](AccountingAdvancesPostRequest.md) |  | |

### Return type

[**PostAccountingAdvancesResponse**](PostAccountingAdvancesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **201** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobilePostAccountingAdvancesByIdEjecutar

> PostAccountingAdvancesIdEjecutarResponse mobilePostAccountingAdvancesByIdEjecutar(id, accountingAdvancesIdEjecutarPostRequest)

Ejecutar anticipo reservado

Aplica el saldo completo del anticipo al documento destino con control de idempotencia y período contable.

### Example

```ts
import {
  Configuration,
  AccountingAdvancesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostAccountingAdvancesByIdEjecutarRequest } from '@tcp/mobile-v1-sdk';

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
    // AccountingAdvancesIdEjecutarPostRequest
    accountingAdvancesIdEjecutarPostRequest: ...,
  } satisfies MobilePostAccountingAdvancesByIdEjecutarRequest;

  try {
    const data = await api.mobilePostAccountingAdvancesByIdEjecutar(body);
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
| **accountingAdvancesIdEjecutarPostRequest** | [AccountingAdvancesIdEjecutarPostRequest](AccountingAdvancesIdEjecutarPostRequest.md) |  | |

### Return type

[**PostAccountingAdvancesIdEjecutarResponse**](PostAccountingAdvancesIdEjecutarResponse.md)

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
| **404** | Recurso no encontrado |  -  |
| **409** | Conflicto |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobilePostAccountingAdvancesByIdRevertir

> PostAccountingAdvancesIdRevertirResponse mobilePostAccountingAdvancesByIdRevertir(id, accountingAdvancesIdRevertirPostRequest)

Revertir ejecución de anticipo

Revierte el importe aplicado al documento destino y restablece el estado contable correspondiente.

### Example

```ts
import {
  Configuration,
  AccountingAdvancesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostAccountingAdvancesByIdRevertirRequest } from '@tcp/mobile-v1-sdk';

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
    // AccountingAdvancesIdRevertirPostRequest
    accountingAdvancesIdRevertirPostRequest: ...,
  } satisfies MobilePostAccountingAdvancesByIdRevertirRequest;

  try {
    const data = await api.mobilePostAccountingAdvancesByIdRevertir(body);
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
| **accountingAdvancesIdRevertirPostRequest** | [AccountingAdvancesIdRevertirPostRequest](AccountingAdvancesIdRevertirPostRequest.md) |  | |

### Return type

[**PostAccountingAdvancesIdRevertirResponse**](PostAccountingAdvancesIdRevertirResponse.md)

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
| **404** | Recurso no encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobilePutAccountingAdvancesById

> PutAccountingAdvancesIdResponse mobilePutAccountingAdvancesById(id, accountingAdvancesIdPutRequest)

Actualizar anticipo

Modifica estado, saldo disponible, vigencia o referencia externa del anticipo existente.

### Example

```ts
import {
  Configuration,
  AccountingAdvancesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePutAccountingAdvancesByIdRequest } from '@tcp/mobile-v1-sdk';

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
    // AccountingAdvancesIdPutRequest
    accountingAdvancesIdPutRequest: ...,
  } satisfies MobilePutAccountingAdvancesByIdRequest;

  try {
    const data = await api.mobilePutAccountingAdvancesById(body);
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
| **accountingAdvancesIdPutRequest** | [AccountingAdvancesIdPutRequest](AccountingAdvancesIdPutRequest.md) |  | |

### Return type

[**PutAccountingAdvancesIdResponse**](PutAccountingAdvancesIdResponse.md)

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
| **404** | Recurso no encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

