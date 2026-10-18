# CategoriasAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetCategoriaById**](CategoriasAPI.md#mobilegetcategoriabyid) | **GET** /categorias/{id} | Detalle de categoría
[**mobileListCategorias**](CategoriasAPI.md#mobilelistcategorias) | **GET** /categorias | Listar categorías


# **mobileGetCategoriaById**
```swift
    open class func mobileGetCategoriaById(id: String, completion: @escaping (_ data: GetCategoriasDetailResponse?, _ error: Error?) -> Void)
```

Detalle de categoría

Detalle de una categoría.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | 

// Detalle de categoría
CategoriasAPI.mobileGetCategoriaById(id: id) { (response, error) in
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
 **id** | **String** |  | 

### Return type

[**GetCategoriasDetailResponse**](GetCategoriasDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListCategorias**
```swift
    open class func mobileListCategorias(completion: @escaping (_ data: GetCategoriasListResponse?, _ error: Error?) -> Void)
```

Listar categorías

Devuelve las categorías del tenant autenticado.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar categorías
CategoriasAPI.mobileListCategorias() { (response, error) in
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

[**GetCategoriasListResponse**](GetCategoriasListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

