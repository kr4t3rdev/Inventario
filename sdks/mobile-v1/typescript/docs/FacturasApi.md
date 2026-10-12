# FacturasApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetFacturasById**](FacturasApi.md#mobilegetfacturasbyid) | **GET** /facturas/{id} | Detalle de factura |
| [**mobileListFacturas**](FacturasApi.md#mobilelistfacturas) | **GET** /facturas | Listar facturas |



## mobileGetFacturasById

> GetFacturasDetailResponse mobileGetFacturasById(id)

Detalle de factura

Devuelve el detalle de una factura.

### Example

```ts
import {
  Configuration,
  FacturasApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetFacturasByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FacturasApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies MobileGetFacturasByIdRequest;

  try {
    const data = await api.mobileGetFacturasById(body);
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

[**GetFacturasDetailResponse**](GetFacturasDetailResponse.md)

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


## mobileListFacturas

> GetFacturasListResponse mobileListFacturas()

Listar facturas

Devuelve el listado de facturas del tenant.

### Example

```ts
import {
  Configuration,
  FacturasApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileListFacturasRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FacturasApi(config);

  try {
    const data = await api.mobileListFacturas();
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

[**GetFacturasListResponse**](GetFacturasListResponse.md)

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

