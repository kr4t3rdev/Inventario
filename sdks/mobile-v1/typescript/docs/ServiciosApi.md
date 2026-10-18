# ServiciosApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetServiciosById**](ServiciosApi.md#mobilegetserviciosbyid) | **GET** /servicios/{id} | Detalle de servicio |
| [**mobileListServicios**](ServiciosApi.md#mobilelistservicios) | **GET** /servicios | Listar servicios |



## mobileGetServiciosById

> GetServiciosDetailResponse mobileGetServiciosById(id)

Detalle de servicio

Devuelve el detalle de una servicio.

### Example

```ts
import {
  Configuration,
  ServiciosApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetServiciosByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ServiciosApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies MobileGetServiciosByIdRequest;

  try {
    const data = await api.mobileGetServiciosById(body);
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

[**GetServiciosDetailResponse**](GetServiciosDetailResponse.md)

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


## mobileListServicios

> GetServiciosListResponse mobileListServicios()

Listar servicios

Devuelve el listado de servicios del tenant.

### Example

```ts
import {
  Configuration,
  ServiciosApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileListServiciosRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ServiciosApi(config);

  try {
    const data = await api.mobileListServicios();
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

[**GetServiciosListResponse**](GetServiciosListResponse.md)

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

