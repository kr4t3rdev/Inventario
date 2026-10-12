# ProduccinApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetProduccionById**](ProduccinApi.md#mobilegetproduccionbyid) | **GET** /produccion/{id} | Detalle de orden de producción |
| [**mobileListProduccion**](ProduccinApi.md#mobilelistproduccion) | **GET** /produccion | Listar órdenes de producción |



## mobileGetProduccionById

> GetProduccionDetailResponse mobileGetProduccionById(id)

Detalle de orden de producción

Devuelve el detalle de una orden de producción.

### Example

```ts
import {
  Configuration,
  ProduccinApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetProduccionByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ProduccinApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies MobileGetProduccionByIdRequest;

  try {
    const data = await api.mobileGetProduccionById(body);
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

[**GetProduccionDetailResponse**](GetProduccionDetailResponse.md)

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


## mobileListProduccion

> GetProduccionListResponse mobileListProduccion()

Listar órdenes de producción

Devuelve el listado de órdenes de producción del tenant.

### Example

```ts
import {
  Configuration,
  ProduccinApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileListProduccionRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ProduccinApi(config);

  try {
    const data = await api.mobileListProduccion();
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

[**GetProduccionListResponse**](GetProduccionListResponse.md)

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

