# tcp_mobile_v1_sdk.api.SalesApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetSales**](SalesApi.md#mobilegetsales) | **GET** /sales | Consultar ventas
[**mobileGetSalesById**](SalesApi.md#mobilegetsalesbyid) | **GET** /sales/{id} | Consultar venta
[**mobilePatchSalesByIdUpdate**](SalesApi.md#mobilepatchsalesbyidupdate) | **PATCH** /sales/{id}/update | Actualizar datos de venta
[**mobilePostSalesByIdCancel**](SalesApi.md#mobilepostsalesbyidcancel) | **POST** /sales/{id}/cancel | Anular venta
[**mobilePostSalesCreate**](SalesApi.md#mobilepostsalescreate) | **POST** /sales/create | Registrar venta


# **mobileGetSales**
> GetSalesResponse mobileGetSales()

Consultar ventas

Devuelve las ventas activas con sus líneas, totales y relaciones de facturación.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = SalesApi();

try {
    final result = api_instance.mobileGetSales();
    print(result);
} catch (e) {
    print('Exception when calling SalesApi->mobileGetSales: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetSalesResponse**](GetSalesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetSalesById**
> GetSalesIdResponse mobileGetSalesById(id)

Consultar venta

Devuelve la venta identificada con líneas, cliente, turno, factura y conciliaciones.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = SalesApi();
final id = id_example; // String | Identificador único del recurso.

try {
    final result = api_instance.mobileGetSalesById(id);
    print(result);
} catch (e) {
    print('Exception when calling SalesApi->mobileGetSalesById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. |

### Return type

[**GetSalesIdResponse**](GetSalesIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePatchSalesByIdUpdate**
> PatchSalesIdUpdateResponse mobilePatchSalesByIdUpdate(id, saleUpdateRequest)

Actualizar datos de venta

Modifica únicamente el descuento y las observaciones editables de la venta seleccionada.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = SalesApi();
final id = id_example; // String | Identificador único del recurso.
final saleUpdateRequest = SaleUpdateRequest(); // SaleUpdateRequest |

try {
    final result = api_instance.mobilePatchSalesByIdUpdate(id, saleUpdateRequest);
    print(result);
} catch (e) {
    print('Exception when calling SalesApi->mobilePatchSalesByIdUpdate: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. |
 **saleUpdateRequest** | [**SaleUpdateRequest**](SaleUpdateRequest.md)|  |

### Return type

[**PatchSalesIdUpdateResponse**](PatchSalesIdUpdateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostSalesByIdCancel**
> PostSalesIdCancelResponse mobilePostSalesByIdCancel(id, saleCancelRequest)

Anular venta

Anula la venta seleccionada y revierte los efectos permitidos sobre inventario y conciliaciones.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = SalesApi();
final id = id_example; // String | Identificador único del recurso.
final saleCancelRequest = SaleCancelRequest(); // SaleCancelRequest |

try {
    final result = api_instance.mobilePostSalesByIdCancel(id, saleCancelRequest);
    print(result);
} catch (e) {
    print('Exception when calling SalesApi->mobilePostSalesByIdCancel: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. |
 **saleCancelRequest** | [**SaleCancelRequest**](SaleCancelRequest.md)|  |

### Return type

[**PostSalesIdCancelResponse**](PostSalesIdCancelResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostSalesCreate**
> PostSalesCreateResponse mobilePostSalesCreate(saleCreateRequest, idempotencyKey)

Registrar venta

Crea la venta, sus líneas y los efectos de inventario, turno y facturación que correspondan. Acepta idempotencyKey en el cuerpo o Idempotency-Key en el encabezado; si ambos están presentes, prevalece el cuerpo. La clave se recorta y debe contener de 1 a 64 caracteres; una clave inválida en el cuerpo devuelve 400. La idempotencia se limita al tenant y a la clave. Si se repite la misma clave con el mismo payload normalizado, devuelve la respuesta original; si el payload normalizado difiere, responde 409. Se valida la autenticación y autorización antes de consultar una repetición. El cliente debe conservar una clave estable por venta lógica pendiente y reutilizarla en todos sus reintentos; no debe generar una clave nueva por intento.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = SalesApi();
final saleCreateRequest = SaleCreateRequest(); // SaleCreateRequest |
final idempotencyKey = idempotencyKey_example; // String | Clave opcional de idempotencia; se usa solo si idempotencyKey no está presente en el cuerpo. El valor del cuerpo tiene precedencia.

try {
    final result = api_instance.mobilePostSalesCreate(saleCreateRequest, idempotencyKey);
    print(result);
} catch (e) {
    print('Exception when calling SalesApi->mobilePostSalesCreate: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **saleCreateRequest** | [**SaleCreateRequest**](SaleCreateRequest.md)|  |
 **idempotencyKey** | **String**| Clave opcional de idempotencia; se usa solo si idempotencyKey no está presente en el cuerpo. El valor del cuerpo tiene precedencia. | [optional]

### Return type

[**PostSalesCreateResponse**](PostSalesCreateResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

