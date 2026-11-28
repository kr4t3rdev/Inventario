# tcp_mobile_v1_sdk.api.ProductsApi

## Load the API package
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
```

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetProducts**](ProductsApi.md#mobilegetproducts) | **GET** /products | Consultar productos
[**mobileGetProductsById**](ProductsApi.md#mobilegetproductsbyid) | **GET** /products/{id} | Consultar producto
[**mobileGetProductsStock**](ProductsApi.md#mobilegetproductsstock) | **GET** /products/stock | Consultar existencias por ubicación
[**mobileGetProductsSyncChanges**](ProductsApi.md#mobilegetproductssyncchanges) | **GET** /products/sync/changes | Consultar cambios incrementales de productos
[**mobileGetProductsSyncSnapshot**](ProductsApi.md#mobilegetproductssyncsnapshot) | **GET** /products/sync/snapshot | Obtener una página inicial del catálogo sincronizable


# **mobileGetProducts**
> GetProductsResponse mobileGetProducts()

Consultar productos

Devuelve el catálogo de productos disponible para el tenant autenticado.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ProductsApi();

try {
    final result = api_instance.mobileGetProducts();
    print(result);
} catch (e) {
    print('Exception when calling ProductsApi->mobileGetProducts: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetProductsResponse**](GetProductsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetProductsById**
> GetProductsIdResponse mobileGetProductsById(id)

Consultar producto

Devuelve precio, costo, estado y datos de inventario del producto identificado.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ProductsApi();
final id = id_example; // String | Identificador único del recurso.

try {
    final result = api_instance.mobileGetProductsById(id);
    print(result);
} catch (e) {
    print('Exception when calling ProductsApi->mobileGetProductsById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**| Identificador único del recurso. | 

### Return type

[**GetProductsIdResponse**](GetProductsIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetProductsStock**
> GetProductsStockResponse mobileGetProductsStock(ubicacionId, tipoUbicacion, includeZero)

Consultar existencias por ubicación

Devuelve el inventario disponible en un almacén o punto de venta específico.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ProductsApi();
final ubicacionId = ubicacionId_example; // String | Valor de ubicacionId aceptado por el handler.
final tipoUbicacion = tipoUbicacion_example; // String | Valor de tipoUbicacion aceptado por el handler.
final includeZero = includeZero_example; // String | Valor de includeZero aceptado por el handler.

try {
    final result = api_instance.mobileGetProductsStock(ubicacionId, tipoUbicacion, includeZero);
    print(result);
} catch (e) {
    print('Exception when calling ProductsApi->mobileGetProductsStock: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ubicacionId** | **String**| Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String**| Valor de tipoUbicacion aceptado por el handler. | [optional] 
 **includeZero** | **String**| Valor de includeZero aceptado por el handler. | [optional] 

### Return type

[**GetProductsStockResponse**](GetProductsStockResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetProductsSyncChanges**
> GetProductsSyncChangesResponse mobileGetProductsSyncChanges(cursor, limit)

Consultar cambios incrementales de productos

Entrega cambios de producto y stock en orden ascendente de secuencia. La ventana queda acotada durante la paginación; no se aplica expiración automática ni purga de eventos en esta fase.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ProductsApi();
final cursor = cursor_example; // String | Cursor opaco tenant-scoped recibido del snapshot o del pull anterior.
final limit = 56; // int | 

try {
    final result = api_instance.mobileGetProductsSyncChanges(cursor, limit);
    print(result);
} catch (e) {
    print('Exception when calling ProductsApi->mobileGetProductsSyncChanges: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cursor** | **String**| Cursor opaco tenant-scoped recibido del snapshot o del pull anterior. | 
 **limit** | **int**|  | [optional] [default to 200]

### Return type

[**GetProductsSyncChangesResponse**](GetProductsSyncChangesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetProductsSyncSnapshot**
> GetProductsSyncSnapshotResponse mobileGetProductsSyncSnapshot(limit, pageToken)

Obtener una página inicial del catálogo sincronizable

Devuelve páginas ordenadas por identificador y una marca de agua fija. Los cambios posteriores a esa marca se reproducen desde el feed; el cliente debe aplicar upserts de forma idempotente. La respuesta no incluye costo.

### Example
```dart
import 'package:tcp_mobile_v1_sdk/api.dart';
// TODO Configure HTTP Bearer authorization: bearerAuth
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearerAuth').setAccessToken(yourTokenGeneratorFunction);

final api_instance = ProductsApi();
final limit = 56; // int | 
final pageToken = pageToken_example; // String | Token opaco de continuación, ligado al tenant autenticado.

try {
    final result = api_instance.mobileGetProductsSyncSnapshot(limit, pageToken);
    print(result);
} catch (e) {
    print('Exception when calling ProductsApi->mobileGetProductsSyncSnapshot: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **int**|  | [optional] [default to 200]
 **pageToken** | **String**| Token opaco de continuación, ligado al tenant autenticado. | [optional] 

### Return type

[**GetProductsSyncSnapshotResponse**](GetProductsSyncSnapshotResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

