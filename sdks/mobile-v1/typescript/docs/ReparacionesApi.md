# ReparacionesApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetReparacionesById**](ReparacionesApi.md#mobilegetreparacionesbyid) | **GET** /reparaciones/{id} | Detalle de orden de reparación |
| [**mobileListReparaciones**](ReparacionesApi.md#mobilelistreparaciones) | **GET** /reparaciones | Listar órdenes de reparación |



## mobileGetReparacionesById

> GetReparacionesDetailResponse mobileGetReparacionesById(id)

Detalle de orden de reparación

Devuelve el detalle de una orden de reparación.

### Example

```ts
import {
  Configuration,
  ReparacionesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetReparacionesByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ReparacionesApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies MobileGetReparacionesByIdRequest;

  try {
    const data = await api.mobileGetReparacionesById(body);
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

[**GetReparacionesDetailResponse**](GetReparacionesDetailResponse.md)

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


## mobileListReparaciones

> GetReparacionesListResponse mobileListReparaciones()

Listar órdenes de reparación

Devuelve el listado de órdenes de reparación del tenant.

### Example

```ts
import {
  Configuration,
  ReparacionesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileListReparacionesRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ReparacionesApi(config);

  try {
    const data = await api.mobileListReparaciones();
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

[**GetReparacionesListResponse**](GetReparacionesListResponse.md)

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

