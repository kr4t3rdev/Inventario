# GastosApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetGastosById**](GastosApi.md#mobilegetgastosbyid) | **GET** /gastos/{id} | Detalle de gasto |
| [**mobileListGastos**](GastosApi.md#mobilelistgastos) | **GET** /gastos | Listar gastos |



## mobileGetGastosById

> GetGastosDetailResponse mobileGetGastosById(id)

Detalle de gasto

Devuelve el detalle de una gasto.

### Example

```ts
import {
  Configuration,
  GastosApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetGastosByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new GastosApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies MobileGetGastosByIdRequest;

  try {
    const data = await api.mobileGetGastosById(body);
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

[**GetGastosDetailResponse**](GetGastosDetailResponse.md)

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


## mobileListGastos

> GetGastosListResponse mobileListGastos()

Listar gastos

Devuelve el listado de gastos del tenant.

### Example

```ts
import {
  Configuration,
  GastosApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileListGastosRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new GastosApi(config);

  try {
    const data = await api.mobileListGastos();
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

[**GetGastosListResponse**](GetGastosListResponse.md)

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

