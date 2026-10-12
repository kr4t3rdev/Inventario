# TransferenciasApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetTransferenciasById**](TransferenciasApi.md#mobilegettransferenciasbyid) | **GET** /transferencias/{id} | Detalle de transferencia |
| [**mobileListTransferencias**](TransferenciasApi.md#mobilelisttransferencias) | **GET** /transferencias | Listar transferencias |



## mobileGetTransferenciasById

> GetTransferenciasDetailResponse mobileGetTransferenciasById(id)

Detalle de transferencia

Devuelve el detalle de una transferencia.

### Example

```ts
import {
  Configuration,
  TransferenciasApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetTransferenciasByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new TransferenciasApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies MobileGetTransferenciasByIdRequest;

  try {
    const data = await api.mobileGetTransferenciasById(body);
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

[**GetTransferenciasDetailResponse**](GetTransferenciasDetailResponse.md)

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


## mobileListTransferencias

> GetTransferenciasListResponse mobileListTransferencias()

Listar transferencias

Devuelve el listado de transferencias del tenant.

### Example

```ts
import {
  Configuration,
  TransferenciasApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileListTransferenciasRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new TransferenciasApi(config);

  try {
    const data = await api.mobileListTransferencias();
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

[**GetTransferenciasListResponse**](GetTransferenciasListResponse.md)

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

