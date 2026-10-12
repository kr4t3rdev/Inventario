# ContratosApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetContratosById**](ContratosApi.md#mobilegetcontratosbyid) | **GET** /contratos/{id} | Detalle de contrato |
| [**mobileListContratos**](ContratosApi.md#mobilelistcontratos) | **GET** /contratos | Listar contratos |



## mobileGetContratosById

> GetContratosDetailResponse mobileGetContratosById(id)

Detalle de contrato

Devuelve el detalle de una contrato.

### Example

```ts
import {
  Configuration,
  ContratosApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetContratosByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ContratosApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies MobileGetContratosByIdRequest;

  try {
    const data = await api.mobileGetContratosById(body);
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

[**GetContratosDetailResponse**](GetContratosDetailResponse.md)

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


## mobileListContratos

> GetContratosListResponse mobileListContratos()

Listar contratos

Devuelve el listado de contratos del tenant.

### Example

```ts
import {
  Configuration,
  ContratosApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileListContratosRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ContratosApi(config);

  try {
    const data = await api.mobileListContratos();
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

[**GetContratosListResponse**](GetContratosListResponse.md)

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

