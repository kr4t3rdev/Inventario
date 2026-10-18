# CategoriasApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetCategoriaById**](CategoriasApi.md#mobilegetcategoriabyid) | **GET** /categorias/{id} | Detalle de categoría |
| [**mobileListCategorias**](CategoriasApi.md#mobilelistcategorias) | **GET** /categorias | Listar categorías |



## mobileGetCategoriaById

> GetCategoriasDetailResponse mobileGetCategoriaById(id)

Detalle de categoría

Detalle de una categoría.

### Example

```ts
import {
  Configuration,
  CategoriasApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetCategoriaByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CategoriasApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies MobileGetCategoriaByIdRequest;

  try {
    const data = await api.mobileGetCategoriaById(body);
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

[**GetCategoriasDetailResponse**](GetCategoriasDetailResponse.md)

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


## mobileListCategorias

> GetCategoriasListResponse mobileListCategorias()

Listar categorías

Devuelve las categorías del tenant autenticado.

### Example

```ts
import {
  Configuration,
  CategoriasApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileListCategoriasRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CategoriasApi(config);

  try {
    const data = await api.mobileListCategorias();
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

[**GetCategoriasListResponse**](GetCategoriasListResponse.md)

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

