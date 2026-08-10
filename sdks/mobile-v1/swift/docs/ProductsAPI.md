# ProductsAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetProducts**](ProductsAPI.md#mobilegetproducts) | **GET** /products | Consultar productos
[**mobileGetProductsById**](ProductsAPI.md#mobilegetproductsbyid) | **GET** /products/{id} | Consultar producto
[**mobileGetProductsStock**](ProductsAPI.md#mobilegetproductsstock) | **GET** /products/stock | Consultar existencias por ubicación


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

