# ComprasAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetComprasById**](ComprasAPI.md#mobilegetcomprasbyid) | **GET** /compras/{id} | Detalle de compra
[**mobileListCompras**](ComprasAPI.md#mobilelistcompras) | **GET** /compras | Listar compras


# **mobileGetComprasById**
```swift
    open class func mobileGetComprasById(id: String, completion: @escaping (_ data: GetComprasDetailResponse?, _ error: Error?) -> Void)
```

Detalle de compra

Devuelve el detalle de una compra.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | 

// Detalle de compra
ComprasAPI.mobileGetComprasById(id: id) { (response, error) in
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

[**GetComprasDetailResponse**](GetComprasDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListCompras**
```swift
    open class func mobileListCompras(completion: @escaping (_ data: GetComprasListResponse?, _ error: Error?) -> Void)
```

Listar compras

Devuelve el listado de compras del tenant.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar compras
ComprasAPI.mobileListCompras() { (response, error) in
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

[**GetComprasListResponse**](GetComprasListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

