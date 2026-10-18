# ListasPreciosAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetListaPrecioById**](ListasPreciosAPI.md#mobilegetlistapreciobyid) | **GET** /listas-precios/{id} | Detalle de lista de precios
[**mobileListListasPrecios**](ListasPreciosAPI.md#mobilelistlistasprecios) | **GET** /listas-precios | Listar listas de precios


# **mobileGetListaPrecioById**
```swift
    open class func mobileGetListaPrecioById(id: String, completion: @escaping (_ data: GetListasPreciosDetailResponse?, _ error: Error?) -> Void)
```

Detalle de lista de precios

Lista con sus precios por producto.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | 

// Detalle de lista de precios
ListasPreciosAPI.mobileGetListaPrecioById(id: id) { (response, error) in
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

[**GetListasPreciosDetailResponse**](GetListasPreciosDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListListasPrecios**
```swift
    open class func mobileListListasPrecios(completion: @escaping (_ data: GetListasPreciosListResponse?, _ error: Error?) -> Void)
```

Listar listas de precios

Listas de precios del tenant.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar listas de precios
ListasPreciosAPI.mobileListListasPrecios() { (response, error) in
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

[**GetListasPreciosListResponse**](GetListasPreciosListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

