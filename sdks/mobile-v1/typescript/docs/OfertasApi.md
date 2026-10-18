# OfertasApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetOfertasById**](OfertasApi.md#mobilegetofertasbyid) | **GET** /ofertas/{id} | Detalle de oferta |
| [**mobileListOfertas**](OfertasApi.md#mobilelistofertas) | **GET** /ofertas | Listar ofertas |



## mobileGetOfertasById

> GetOfertasDetailResponse mobileGetOfertasById(id)

Detalle de oferta

Devuelve el detalle de una oferta.

### Example

```ts
import {
  Configuration,
  OfertasApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetOfertasByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OfertasApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies MobileGetOfertasByIdRequest;

  try {
    const data = await api.mobileGetOfertasById(body);
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

[**GetOfertasDetailResponse**](GetOfertasDetailResponse.md)

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


## mobileListOfertas

> GetOfertasListResponse mobileListOfertas()

Listar ofertas

Devuelve el listado de ofertas del tenant.

### Example

```ts
import {
  Configuration,
  OfertasApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileListOfertasRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new OfertasApi(config);

  try {
    const data = await api.mobileListOfertas();
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

[**GetOfertasListResponse**](GetOfertasListResponse.md)

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

