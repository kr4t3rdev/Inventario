# ComprasApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetComprasById**](ComprasApi.md#mobilegetcomprasbyid) | **GET** /compras/{id} | Detalle de compra |
| [**mobileListCompras**](ComprasApi.md#mobilelistcompras) | **GET** /compras | Listar compras |



## mobileGetComprasById

> GetComprasDetailResponse mobileGetComprasById(id)

Detalle de compra

Devuelve el detalle de una compra.

### Example

```ts
import {
  Configuration,
  ComprasApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetComprasByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ComprasApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies MobileGetComprasByIdRequest;

  try {
    const data = await api.mobileGetComprasById(body);
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

[**GetComprasDetailResponse**](GetComprasDetailResponse.md)

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


## mobileListCompras

> GetComprasListResponse mobileListCompras()

Listar compras

Devuelve el listado de compras del tenant.

### Example

```ts
import {
  Configuration,
  ComprasApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileListComprasRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ComprasApi(config);

  try {
    const data = await api.mobileListCompras();
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

[**GetComprasListResponse**](GetComprasListResponse.md)

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

