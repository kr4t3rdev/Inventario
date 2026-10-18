# ProduccinAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetProduccionById**](ProduccinAPI.md#mobilegetproduccionbyid) | **GET** /produccion/{id} | Detalle de orden de producción
[**mobileListProduccion**](ProduccinAPI.md#mobilelistproduccion) | **GET** /produccion | Listar órdenes de producción


# **mobileGetProduccionById**
```swift
    open class func mobileGetProduccionById(id: String, completion: @escaping (_ data: GetProduccionDetailResponse?, _ error: Error?) -> Void)
```

Detalle de orden de producción

Devuelve el detalle de una orden de producción.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | 

// Detalle de orden de producción
ProduccinAPI.mobileGetProduccionById(id: id) { (response, error) in
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

[**GetProduccionDetailResponse**](GetProduccionDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListProduccion**
```swift
    open class func mobileListProduccion(completion: @escaping (_ data: GetProduccionListResponse?, _ error: Error?) -> Void)
```

Listar órdenes de producción

Devuelve el listado de órdenes de producción del tenant.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar órdenes de producción
ProduccinAPI.mobileListProduccion() { (response, error) in
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

[**GetProduccionListResponse**](GetProduccionListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

