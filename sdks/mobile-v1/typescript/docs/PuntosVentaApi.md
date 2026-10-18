# PuntosVentaApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetPuntoVentaById**](PuntosVentaApi.md#mobilegetpuntoventabyid) | **GET** /puntos-venta/{id} | Detalle de punto de venta |
| [**mobileListPuntosVenta**](PuntosVentaApi.md#mobilelistpuntosventa) | **GET** /puntos-venta | Listar puntos de venta |



## mobileGetPuntoVentaById

> GetPuntosVentaDetailResponse mobileGetPuntoVentaById(id)

Detalle de punto de venta

Detalle de un punto de venta.

### Example

```ts
import {
  Configuration,
  PuntosVentaApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetPuntoVentaByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PuntosVentaApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies MobileGetPuntoVentaByIdRequest;

  try {
    const data = await api.mobileGetPuntoVentaById(body);
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

[**GetPuntosVentaDetailResponse**](GetPuntosVentaDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileListPuntosVenta

> GetPuntosVentaListResponse mobileListPuntosVenta()

Listar puntos de venta

Puntos de venta del tenant.

### Example

```ts
import {
  Configuration,
  PuntosVentaApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileListPuntosVentaRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PuntosVentaApi(config);

  try {
    const data = await api.mobileListPuntosVenta();
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

[**GetPuntosVentaListResponse**](GetPuntosVentaListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | OK |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

