# UnitsApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileCreateUnit**](UnitsApi.md#mobilecreateunitoperation) | **POST** /units/create | Crear unidad |
| [**mobileDeleteUnit**](UnitsApi.md#mobiledeleteunit) | **DELETE** /units/{id} | Eliminar unidad |
| [**mobileListUnits**](UnitsApi.md#mobilelistunits) | **GET** /units | Listar unidades |
| [**mobileUpdateUnit**](UnitsApi.md#mobileupdateunitoperation) | **PUT** /units/{id} | Actualizar unidad |



## mobileCreateUnit

> GetUnitsDetailResponse mobileCreateUnit(mobileCreateUnitRequest)

Crear unidad

Crea una nueva unidad de medida.

### Example

```ts
import {
  Configuration,
  UnitsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileCreateUnitOperationRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UnitsApi(config);

  const body = {
    // MobileCreateUnitRequest
    mobileCreateUnitRequest: ...,
  } satisfies MobileCreateUnitOperationRequest;

  try {
    const data = await api.mobileCreateUnit(body);
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
| **mobileCreateUnitRequest** | [MobileCreateUnitRequest](MobileCreateUnitRequest.md) |  | |

### Return type

[**GetUnitsDetailResponse**](GetUnitsDetailResponse.md)

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
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileDeleteUnit

> DeleteUnitResponse mobileDeleteUnit(id)

Eliminar unidad

Elimina una unidad de medida.

### Example

```ts
import {
  Configuration,
  UnitsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileDeleteUnitRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UnitsApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies MobileDeleteUnitRequest;

  try {
    const data = await api.mobileDeleteUnit(body);
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
| **id** | `string` |  | [Defaults to `undefined`] |

### Return type

[**DeleteUnitResponse**](DeleteUnitResponse.md)

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


## mobileListUnits

> GetUnitsListResponse mobileListUnits()

Listar unidades

Devuelve las unidades de medida del tenant.

### Example

```ts
import {
  Configuration,
  UnitsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileListUnitsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UnitsApi(config);

  try {
    const data = await api.mobileListUnits();
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

[**GetUnitsListResponse**](GetUnitsListResponse.md)

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


## mobileUpdateUnit

> GetUnitsDetailResponse mobileUpdateUnit(id, mobileUpdateUnitRequest)

Actualizar unidad

Actualiza una unidad de medida.

### Example

```ts
import {
  Configuration,
  UnitsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileUpdateUnitOperationRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UnitsApi(config);

  const body = {
    // string
    id: id_example,
    // MobileUpdateUnitRequest
    mobileUpdateUnitRequest: ...,
  } satisfies MobileUpdateUnitOperationRequest;

  try {
    const data = await api.mobileUpdateUnit(body);
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
| **id** | `string` |  | [Defaults to `undefined`] |
| **mobileUpdateUnitRequest** | [MobileUpdateUnitRequest](MobileUpdateUnitRequest.md) |  | |

### Return type

[**GetUnitsDetailResponse**](GetUnitsDetailResponse.md)

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
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

