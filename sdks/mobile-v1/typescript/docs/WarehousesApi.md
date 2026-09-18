# WarehousesApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileDeleteWarehousesById**](WarehousesApi.md#mobiledeletewarehousesbyid) | **DELETE** /warehouses/{id} | Eliminar almacén |
| [**mobileGetWarehouses**](WarehousesApi.md#mobilegetwarehouses) | **GET** /warehouses | Listar almacenes |
| [**mobileGetWarehousesById**](WarehousesApi.md#mobilegetwarehousesbyid) | **GET** /warehouses/{id} | Consultar almacén |
| [**mobilePostWarehousesCreate**](WarehousesApi.md#mobilepostwarehousescreate) | **POST** /warehouses/create | Crear almacén |
| [**mobilePutWarehousesById**](WarehousesApi.md#mobileputwarehousesbyid) | **PUT** /warehouses/{id} | Editar almacén |



## mobileDeleteWarehousesById

> AlmacenDeleteResponse mobileDeleteWarehousesById(id)

Eliminar almacén

Elimina un almacén del tenant activo y devuelve la confirmación.

### Example

```ts
import {
  Configuration,
  WarehousesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileDeleteWarehousesByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WarehousesApi(config);

  const body = {
    // string | Identificador del almacén.
    id: id_example,
  } satisfies MobileDeleteWarehousesByIdRequest;

  try {
    const data = await api.mobileDeleteWarehousesById(body);
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
| **id** | `string` | Identificador del almacén. | [Defaults to `undefined`] |

### Return type

[**AlmacenDeleteResponse**](AlmacenDeleteResponse.md)

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


## mobileGetWarehouses

> AlmacenListResponse mobileGetWarehouses()

Listar almacenes

Devuelve los almacenes del tenant activo ordenados por nombre ascendente.

### Example

```ts
import {
  Configuration,
  WarehousesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetWarehousesRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WarehousesApi(config);

  try {
    const data = await api.mobileGetWarehouses();
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

[**AlmacenListResponse**](AlmacenListResponse.md)

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


## mobileGetWarehousesById

> Almacen mobileGetWarehousesById(id)

Consultar almacén

Devuelve el detalle de un almacén del tenant activo.

### Example

```ts
import {
  Configuration,
  WarehousesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetWarehousesByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WarehousesApi(config);

  const body = {
    // string | Identificador del almacén.
    id: id_example,
  } satisfies MobileGetWarehousesByIdRequest;

  try {
    const data = await api.mobileGetWarehousesById(body);
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
| **id** | `string` | Identificador del almacén. | [Defaults to `undefined`] |

### Return type

[**Almacen**](Almacen.md)

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


## mobilePostWarehousesCreate

> Almacen mobilePostWarehousesCreate(almacenCreateRequest)

Crear almacén

Crea un almacén en el tenant activo y devuelve el registro creado.

### Example

```ts
import {
  Configuration,
  WarehousesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostWarehousesCreateRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WarehousesApi(config);

  const body = {
    // AlmacenCreateRequest
    almacenCreateRequest: ...,
  } satisfies MobilePostWarehousesCreateRequest;

  try {
    const data = await api.mobilePostWarehousesCreate(body);
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
| **almacenCreateRequest** | [AlmacenCreateRequest](AlmacenCreateRequest.md) |  | |

### Return type

[**Almacen**](Almacen.md)

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


## mobilePutWarehousesById

> Almacen mobilePutWarehousesById(id, almacenUpdateRequest)

Editar almacén

Actualiza los datos de un almacén del tenant activo y devuelve el registro actualizado.

### Example

```ts
import {
  Configuration,
  WarehousesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePutWarehousesByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new WarehousesApi(config);

  const body = {
    // string | Identificador del almacén.
    id: id_example,
    // AlmacenUpdateRequest
    almacenUpdateRequest: ...,
  } satisfies MobilePutWarehousesByIdRequest;

  try {
    const data = await api.mobilePutWarehousesById(body);
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
| **id** | `string` | Identificador del almacén. | [Defaults to `undefined`] |
| **almacenUpdateRequest** | [AlmacenUpdateRequest](AlmacenUpdateRequest.md) |  | |

### Return type

[**Almacen**](Almacen.md)

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

