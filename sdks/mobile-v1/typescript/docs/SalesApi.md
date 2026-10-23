# SalesApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetSales**](SalesApi.md#mobilegetsales) | **GET** /sales | Consultar ventas |
| [**mobileGetSalesById**](SalesApi.md#mobilegetsalesbyid) | **GET** /sales/{id} | Consultar venta |
| [**mobilePatchSalesByIdUpdate**](SalesApi.md#mobilepatchsalesbyidupdate) | **PATCH** /sales/{id}/update | Actualizar datos de venta |
| [**mobilePostSalesByIdCancel**](SalesApi.md#mobilepostsalesbyidcancel) | **POST** /sales/{id}/cancel | Anular venta |
| [**mobilePostSalesCreate**](SalesApi.md#mobilepostsalescreate) | **POST** /sales/create | Registrar venta |



## mobileGetSales

> GetSalesResponse mobileGetSales()

Consultar ventas

Devuelve las ventas activas con sus líneas, totales y relaciones de facturación.

### Example

```ts
import {
  Configuration,
  SalesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetSalesRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SalesApi(config);

  try {
    const data = await api.mobileGetSales();
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

[**GetSalesResponse**](GetSalesResponse.md)

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


## mobileGetSalesById

> GetSalesIdResponse mobileGetSalesById(id)

Consultar venta

Devuelve la venta identificada con líneas, cliente, turno, factura y conciliaciones.

### Example

```ts
import {
  Configuration,
  SalesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetSalesByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SalesApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
  } satisfies MobileGetSalesByIdRequest;

  try {
    const data = await api.mobileGetSalesById(body);
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

[**GetSalesIdResponse**](GetSalesIdResponse.md)

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


## mobilePatchSalesByIdUpdate

> PatchSalesIdUpdateResponse mobilePatchSalesByIdUpdate(id, saleUpdateRequest)

Actualizar datos de venta

Modifica únicamente el descuento y las observaciones editables de la venta seleccionada.

### Example

```ts
import {
  Configuration,
  SalesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePatchSalesByIdUpdateRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SalesApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
    // SaleUpdateRequest
    saleUpdateRequest: ...,
  } satisfies MobilePatchSalesByIdUpdateRequest;

  try {
    const data = await api.mobilePatchSalesByIdUpdate(body);
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
| **saleUpdateRequest** | [SaleUpdateRequest](SaleUpdateRequest.md) |  | |

### Return type

[**PatchSalesIdUpdateResponse**](PatchSalesIdUpdateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobilePostSalesByIdCancel

> PostSalesIdCancelResponse mobilePostSalesByIdCancel(id, saleCancelRequest)

Anular venta

Anula la venta seleccionada y revierte los efectos permitidos sobre inventario y conciliaciones.

### Example

```ts
import {
  Configuration,
  SalesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostSalesByIdCancelRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SalesApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
    // SaleCancelRequest
    saleCancelRequest: ...,
  } satisfies MobilePostSalesByIdCancelRequest;

  try {
    const data = await api.mobilePostSalesByIdCancel(body);
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
| **saleCancelRequest** | [SaleCancelRequest](SaleCancelRequest.md) |  | |

### Return type

[**PostSalesIdCancelResponse**](PostSalesIdCancelResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobilePostSalesCreate

> PostSalesCreateResponse mobilePostSalesCreate(saleCreateRequest, idempotencyKey)

Registrar venta

Crea la venta, sus líneas y los efectos de inventario, turno y facturación que correspondan. Acepta idempotencyKey en el cuerpo o Idempotency-Key en el encabezado; si ambos están presentes, prevalece el cuerpo. La clave se recorta y debe contener de 1 a 64 caracteres; una clave inválida en el cuerpo devuelve 400. La idempotencia se limita al tenant y a la clave. Si se repite la misma clave con el mismo payload normalizado, devuelve la respuesta original; si el payload normalizado difiere, responde 409. Se valida la autenticación y autorización antes de consultar una repetición. El cliente debe conservar una clave estable por venta lógica pendiente y reutilizarla en todos sus reintentos; no debe generar una clave nueva por intento.

### Example

```ts
import {
  Configuration,
  SalesApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostSalesCreateRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SalesApi(config);

  const body = {
    // SaleCreateRequest
    saleCreateRequest: ...,
    // string | Clave opcional de idempotencia; se usa solo si idempotencyKey no está presente en el cuerpo. El valor del cuerpo tiene precedencia. (optional)
    idempotencyKey: idempotencyKey_example,
  } satisfies MobilePostSalesCreateRequest;

  try {
    const data = await api.mobilePostSalesCreate(body);
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
| **saleCreateRequest** | [SaleCreateRequest](SaleCreateRequest.md) |  | |
| **idempotencyKey** | `string` | Clave opcional de idempotencia; se usa solo si idempotencyKey no está presente en el cuerpo. El valor del cuerpo tiene precedencia. | [Optional] [Defaults to `undefined`] |

### Return type

[**PostSalesCreateResponse**](PostSalesCreateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **409** | IDEMPOTENCY_KEY_REUSED: La clave ya se utilizó con otro contenido; una misma clave no puede reutilizarse con un payload normalizado diferente |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

