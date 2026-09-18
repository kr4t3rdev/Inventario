# ProductsApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetProducts**](ProductsApi.md#mobilegetproducts) | **GET** /products | Consultar productos |
| [**mobileGetProductsById**](ProductsApi.md#mobilegetproductsbyid) | **GET** /products/{id} | Consultar producto |
| [**mobileGetProductsStock**](ProductsApi.md#mobilegetproductsstock) | **GET** /products/stock | Consultar existencias por ubicación |



## mobileGetProducts

> GetProductsResponse mobileGetProducts()

Consultar productos

Devuelve el catálogo de productos disponible para el tenant autenticado.

### Example

```ts
import {
  Configuration,
  ProductsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetProductsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ProductsApi(config);

  try {
    const data = await api.mobileGetProducts();
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

[**GetProductsResponse**](GetProductsResponse.md)

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
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetProductsById

> GetProductsIdResponse mobileGetProductsById(id)

Consultar producto

Devuelve precio, costo, estado y datos de inventario del producto identificado.

### Example

```ts
import {
  Configuration,
  ProductsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetProductsByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ProductsApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
  } satisfies MobileGetProductsByIdRequest;

  try {
    const data = await api.mobileGetProductsById(body);
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
| **id** | `string` | Identificador único del recurso. | [Defaults to `undefined`] |

### Return type

[**GetProductsIdResponse**](GetProductsIdResponse.md)

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
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetProductsStock

> GetProductsStockResponse mobileGetProductsStock(ubicacionId, tipoUbicacion, includeZero)

Consultar existencias por ubicación

Devuelve el inventario disponible en un almacén o punto de venta específico.

### Example

```ts
import {
  Configuration,
  ProductsApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetProductsStockRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ProductsApi(config);

  const body = {
    // string | Valor de ubicacionId aceptado por el handler. (optional)
    ubicacionId: ubicacionId_example,
    // 'almacen' | 'punto_venta' | Valor de tipoUbicacion aceptado por el handler. (optional)
    tipoUbicacion: tipoUbicacion_example,
    // 'true' | 'false' | Valor de includeZero aceptado por el handler. (optional)
    includeZero: includeZero_example,
  } satisfies MobileGetProductsStockRequest;

  try {
    const data = await api.mobileGetProductsStock(body);
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
| **ubicacionId** | `string` | Valor de ubicacionId aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **tipoUbicacion** | `almacen`, `punto_venta` | Valor de tipoUbicacion aceptado por el handler. | [Optional] [Defaults to `undefined`] [Enum: almacen, punto_venta] |
| **includeZero** | `true`, `false` | Valor de includeZero aceptado por el handler. | [Optional] [Defaults to `undefined`] [Enum: true, false] |

### Return type

[**GetProductsStockResponse**](GetProductsStockResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

