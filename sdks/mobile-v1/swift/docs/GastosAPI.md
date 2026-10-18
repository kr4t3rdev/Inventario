# GastosAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetGastosById**](GastosAPI.md#mobilegetgastosbyid) | **GET** /gastos/{id} | Detalle de gasto
[**mobileListGastos**](GastosAPI.md#mobilelistgastos) | **GET** /gastos | Listar gastos


# **mobileGetGastosById**
```swift
    open class func mobileGetGastosById(id: String, completion: @escaping (_ data: GetGastosDetailResponse?, _ error: Error?) -> Void)
```

Detalle de gasto

Devuelve el detalle de una gasto.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | 

// Detalle de gasto
GastosAPI.mobileGetGastosById(id: id) { (response, error) in
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

[**GetGastosDetailResponse**](GetGastosDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListGastos**
```swift
    open class func mobileListGastos(completion: @escaping (_ data: GetGastosListResponse?, _ error: Error?) -> Void)
```

Listar gastos

Devuelve el listado de gastos del tenant.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar gastos
GastosAPI.mobileListGastos() { (response, error) in
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

[**GetGastosListResponse**](GetGastosListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

