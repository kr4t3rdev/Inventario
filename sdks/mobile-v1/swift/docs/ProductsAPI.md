# ProductsAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetProducts**](ProductsAPI.md#mobilegetproducts) | **GET** /products | Consultar productos
[**mobileGetProductsById**](ProductsAPI.md#mobilegetproductsbyid) | **GET** /products/{id} | Consultar producto
[**mobileGetProductsStock**](ProductsAPI.md#mobilegetproductsstock) | **GET** /products/stock | Consultar existencias por ubicación
[**mobileGetProductsSyncChanges**](ProductsAPI.md#mobilegetproductssyncchanges) | **GET** /products/sync/changes | Consultar cambios incrementales de productos
[**mobileGetProductsSyncSnapshot**](ProductsAPI.md#mobilegetproductssyncsnapshot) | **GET** /products/sync/snapshot | Obtener una página inicial del catálogo sincronizable


# **mobileGetProducts**
```swift
    open class func mobileGetProducts(completion: @escaping (_ data: GetProductsResponse?, _ error: Error?) -> Void)
```

Consultar productos

Devuelve el catálogo de productos disponible para el tenant autenticado.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Consultar productos
ProductsAPI.mobileGetProducts() { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
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
```swift
    open class func mobileGetProductsById(id: String, completion: @escaping (_ data: GetProductsIdResponse?, _ error: Error?) -> Void)
```

Consultar producto

Devuelve precio, costo, estado y datos de inventario del producto identificado.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.

// Consultar producto
ProductsAPI.mobileGetProductsById(id: id) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String** | Identificador único del recurso. | 

### Return type

[**GetProductsIdResponse**](GetProductsIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetProductsStock**
```swift
    open class func mobileGetProductsStock(ubicacionId: String? = nil, tipoUbicacion: TipoUbicacion_mobileGetProductsStock? = nil, includeZero: IncludeZero_mobileGetProductsStock? = nil, completion: @escaping (_ data: GetProductsStockResponse?, _ error: Error?) -> Void)
```

Consultar existencias por ubicación

Devuelve el inventario disponible en un almacén o punto de venta específico.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let ubicacionId = "ubicacionId_example" // String | Valor de ubicacionId aceptado por el handler. (optional)
let tipoUbicacion = "tipoUbicacion_example" // String | Valor de tipoUbicacion aceptado por el handler. (optional)
let includeZero = "includeZero_example" // String | Valor de includeZero aceptado por el handler. (optional)

// Consultar existencias por ubicación
ProductsAPI.mobileGetProductsStock(ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion, includeZero: includeZero) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ubicacionId** | **String** | Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String** | Valor de tipoUbicacion aceptado por el handler. | [optional] 
 **includeZero** | **String** | Valor de includeZero aceptado por el handler. | [optional] 

### Return type

[**GetProductsStockResponse**](GetProductsStockResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetProductsSyncChanges**
```swift
    open class func mobileGetProductsSyncChanges(cursor: String, limit: Int? = nil, completion: @escaping (_ data: GetProductsSyncChangesResponse?, _ error: Error?) -> Void)
```

Consultar cambios incrementales de productos

Entrega cambios de producto y stock en orden ascendente de secuencia. La ventana queda acotada durante la paginación; no se aplica expiración automática ni purga de eventos en esta fase.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let cursor = "cursor_example" // String | Cursor opaco tenant-scoped recibido del snapshot o del pull anterior.
let limit = 987 // Int |  (optional) (default to 200)

// Consultar cambios incrementales de productos
ProductsAPI.mobileGetProductsSyncChanges(cursor: cursor, limit: limit) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cursor** | **String** | Cursor opaco tenant-scoped recibido del snapshot o del pull anterior. | 
 **limit** | **Int** |  | [optional] [default to 200]

### Return type

[**GetProductsSyncChangesResponse**](GetProductsSyncChangesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetProductsSyncSnapshot**
```swift
    open class func mobileGetProductsSyncSnapshot(limit: Int? = nil, pageToken: String? = nil, completion: @escaping (_ data: GetProductsSyncSnapshotResponse?, _ error: Error?) -> Void)
```

Obtener una página inicial del catálogo sincronizable

Devuelve páginas ordenadas por identificador y una marca de agua fija. Los cambios posteriores a esa marca se reproducen desde el feed; el cliente debe aplicar upserts de forma idempotente. La respuesta no incluye costo.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let limit = 987 // Int |  (optional) (default to 200)
let pageToken = "pageToken_example" // String | Token opaco de continuación, ligado al tenant autenticado. (optional)

// Obtener una página inicial del catálogo sincronizable
ProductsAPI.mobileGetProductsSyncSnapshot(limit: limit, pageToken: pageToken) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **Int** |  | [optional] [default to 200]
 **pageToken** | **String** | Token opaco de continuación, ligado al tenant autenticado. | [optional] 

### Return type

[**GetProductsSyncSnapshotResponse**](GetProductsSyncSnapshotResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

