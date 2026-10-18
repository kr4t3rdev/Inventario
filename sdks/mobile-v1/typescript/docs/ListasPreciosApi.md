# ListasPreciosApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetListaPrecioById**](ListasPreciosApi.md#mobilegetlistapreciobyid) | **GET** /listas-precios/{id} | Detalle de lista de precios |
| [**mobileListListasPrecios**](ListasPreciosApi.md#mobilelistlistasprecios) | **GET** /listas-precios | Listar listas de precios |



## mobileGetListaPrecioById

> GetListasPreciosDetailResponse mobileGetListaPrecioById(id)

Detalle de lista de precios

Lista con sus precios por producto.

### Example

```ts
import {
  Configuration,
  ListasPreciosApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetListaPrecioByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ListasPreciosApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies MobileGetListaPrecioByIdRequest;

  try {
    const data = await api.mobileGetListaPrecioById(body);
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

[**GetListasPreciosDetailResponse**](GetListasPreciosDetailResponse.md)

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


## mobileListListasPrecios

> GetListasPreciosListResponse mobileListListasPrecios()

Listar listas de precios

Listas de precios del tenant.

### Example

```ts
import {
  Configuration,
  ListasPreciosApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileListListasPreciosRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ListasPreciosApi(config);

  try {
    const data = await api.mobileListListasPrecios();
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

[**GetListasPreciosListResponse**](GetListasPreciosListResponse.md)

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

