# ProvidersApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileDeleteProvidersById**](ProvidersApi.md#mobiledeleteprovidersbyid) | **DELETE** /providers/{id} | Eliminar proveedor |
| [**mobileGetProviders**](ProvidersApi.md#mobilegetproviders) | **GET** /providers | Listar proveedores |
| [**mobileGetProvidersById**](ProvidersApi.md#mobilegetprovidersbyid) | **GET** /providers/{id} | Consultar proveedor |
| [**mobilePostProvidersCreate**](ProvidersApi.md#mobilepostproviderscreate) | **POST** /providers/create | Crear proveedor |
| [**mobilePutProvidersById**](ProvidersApi.md#mobileputprovidersbyid) | **PUT** /providers/{id} | Editar proveedor |



## mobileDeleteProvidersById

> ProveedorDeleteResponse mobileDeleteProvidersById(id)

Eliminar proveedor

Elimina un proveedor del tenant activo y devuelve la confirmación.

### Example

```ts
import {
  Configuration,
  ProvidersApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileDeleteProvidersByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ProvidersApi(config);

  const body = {
    // string | Identificador del proveedor.
    id: id_example,
  } satisfies MobileDeleteProvidersByIdRequest;

  try {
    const data = await api.mobileDeleteProvidersById(body);
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
| **id** | `string` | Identificador del proveedor. | [Defaults to `undefined`] |

### Return type

[**ProveedorDeleteResponse**](ProveedorDeleteResponse.md)

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


## mobileGetProviders

> ProveedorListResponse mobileGetProviders()

Listar proveedores

Devuelve los proveedores del tenant activo ordenados por creación descendente.

### Example

```ts
import {
  Configuration,
  ProvidersApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetProvidersRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ProvidersApi(config);

  try {
    const data = await api.mobileGetProviders();
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

[**ProveedorListResponse**](ProveedorListResponse.md)

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


## mobileGetProvidersById

> Proveedor mobileGetProvidersById(id)

Consultar proveedor

Devuelve el detalle de un proveedor del tenant activo.

### Example

```ts
import {
  Configuration,
  ProvidersApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetProvidersByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ProvidersApi(config);

  const body = {
    // string | Identificador del proveedor.
    id: id_example,
  } satisfies MobileGetProvidersByIdRequest;

  try {
    const data = await api.mobileGetProvidersById(body);
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
| **id** | `string` | Identificador del proveedor. | [Defaults to `undefined`] |

### Return type

[**Proveedor**](Proveedor.md)

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


## mobilePostProvidersCreate

> Proveedor mobilePostProvidersCreate(proveedorCreateRequest)

Crear proveedor

Crea un proveedor en el tenant activo y devuelve el registro creado.

### Example

```ts
import {
  Configuration,
  ProvidersApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostProvidersCreateRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ProvidersApi(config);

  const body = {
    // ProveedorCreateRequest
    proveedorCreateRequest: ...,
  } satisfies MobilePostProvidersCreateRequest;

  try {
    const data = await api.mobilePostProvidersCreate(body);
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
| **proveedorCreateRequest** | [ProveedorCreateRequest](ProveedorCreateRequest.md) |  | |

### Return type

[**Proveedor**](Proveedor.md)

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


## mobilePutProvidersById

> Proveedor mobilePutProvidersById(id, proveedorUpdateRequest)

Editar proveedor

Actualiza los datos de un proveedor del tenant activo y devuelve el registro actualizado.

### Example

```ts
import {
  Configuration,
  ProvidersApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePutProvidersByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ProvidersApi(config);

  const body = {
    // string | Identificador del proveedor.
    id: id_example,
    // ProveedorUpdateRequest
    proveedorUpdateRequest: ...,
  } satisfies MobilePutProvidersByIdRequest;

  try {
    const data = await api.mobilePutProvidersById(body);
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
| **id** | `string` | Identificador del proveedor. | [Defaults to `undefined`] |
| **proveedorUpdateRequest** | [ProveedorUpdateRequest](ProveedorUpdateRequest.md) |  | |

### Return type

[**Proveedor**](Proveedor.md)

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

