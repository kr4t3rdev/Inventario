# ClientsApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileDeleteClientsById**](ClientsApi.md#mobiledeleteclientsbyid) | **DELETE** /clients/{id} | Eliminar cliente |
| [**mobileGetClients**](ClientsApi.md#mobilegetclients) | **GET** /clients | Listar clientes |
| [**mobileGetClientsById**](ClientsApi.md#mobilegetclientsbyid) | **GET** /clients/{id} | Consultar cliente |
| [**mobilePostClientsCreate**](ClientsApi.md#mobilepostclientscreate) | **POST** /clients/create | Crear cliente |
| [**mobilePutClientsById**](ClientsApi.md#mobileputclientsbyid) | **PUT** /clients/{id} | Editar cliente |



## mobileDeleteClientsById

> ClienteDeleteResponse mobileDeleteClientsById(id)

Eliminar cliente

Elimina un cliente del tenant activo y devuelve la confirmación.

### Example

```ts
import {
  Configuration,
  ClientsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileDeleteClientsByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ClientsApi(config);

  const body = {
    // string | Identificador del cliente.
    id: id_example,
  } satisfies MobileDeleteClientsByIdRequest;

  try {
    const data = await api.mobileDeleteClientsById(body);
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
| **id** | `string` | Identificador del cliente. | [Defaults to `undefined`] |

### Return type

[**ClienteDeleteResponse**](ClienteDeleteResponse.md)

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
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetClients

> ClienteListResponse mobileGetClients()

Listar clientes

Devuelve los clientes del tenant activo ordenados por creación descendente.

### Example

```ts
import {
  Configuration,
  ClientsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetClientsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ClientsApi(config);

  try {
    const data = await api.mobileGetClients();
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

[**ClienteListResponse**](ClienteListResponse.md)

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


## mobileGetClientsById

> Cliente mobileGetClientsById(id)

Consultar cliente

Devuelve el detalle de un cliente del tenant activo.

### Example

```ts
import {
  Configuration,
  ClientsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetClientsByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ClientsApi(config);

  const body = {
    // string | Identificador del cliente.
    id: id_example,
  } satisfies MobileGetClientsByIdRequest;

  try {
    const data = await api.mobileGetClientsById(body);
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
| **id** | `string` | Identificador del cliente. | [Defaults to `undefined`] |

### Return type

[**Cliente**](Cliente.md)

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
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobilePostClientsCreate

> Cliente mobilePostClientsCreate(clienteCreateRequest)

Crear cliente

Crea un cliente en el tenant activo y devuelve el registro creado.

### Example

```ts
import {
  Configuration,
  ClientsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostClientsCreateRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ClientsApi(config);

  const body = {
    // ClienteCreateRequest
    clienteCreateRequest: ...,
  } satisfies MobilePostClientsCreateRequest;

  try {
    const data = await api.mobilePostClientsCreate(body);
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
| **clienteCreateRequest** | [ClienteCreateRequest](ClienteCreateRequest.md) |  | |

### Return type

[**Cliente**](Cliente.md)

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
| **403** | No autorizado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobilePutClientsById

> Cliente mobilePutClientsById(id, clienteUpdateRequest)

Editar cliente

Actualiza los datos de un cliente del tenant activo y devuelve el registro actualizado.

### Example

```ts
import {
  Configuration,
  ClientsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePutClientsByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ClientsApi(config);

  const body = {
    // string | Identificador del cliente.
    id: id_example,
    // ClienteUpdateRequest
    clienteUpdateRequest: ...,
  } satisfies MobilePutClientsByIdRequest;

  try {
    const data = await api.mobilePutClientsById(body);
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
| **id** | `string` | Identificador del cliente. | [Defaults to `undefined`] |
| **clienteUpdateRequest** | [ClienteUpdateRequest](ClienteUpdateRequest.md) |  | |

### Return type

[**Cliente**](Cliente.md)

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
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

