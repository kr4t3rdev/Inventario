# ReparacionesAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetReparacionesById**](ReparacionesAPI.md#mobilegetreparacionesbyid) | **GET** /reparaciones/{id} | Detalle de orden de reparación
[**mobileListReparaciones**](ReparacionesAPI.md#mobilelistreparaciones) | **GET** /reparaciones | Listar órdenes de reparación


# **mobileGetReparacionesById**
```swift
    open class func mobileGetReparacionesById(id: String, completion: @escaping (_ data: GetReparacionesDetailResponse?, _ error: Error?) -> Void)
```

Detalle de orden de reparación

Devuelve el detalle de una orden de reparación.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | 

// Detalle de orden de reparación
ReparacionesAPI.mobileGetReparacionesById(id: id) { (response, error) in
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

[**GetReparacionesDetailResponse**](GetReparacionesDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListReparaciones**
```swift
    open class func mobileListReparaciones(completion: @escaping (_ data: GetReparacionesListResponse?, _ error: Error?) -> Void)
```

Listar órdenes de reparación

Devuelve el listado de órdenes de reparación del tenant.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar órdenes de reparación
ReparacionesAPI.mobileListReparaciones() { (response, error) in
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

[**GetReparacionesListResponse**](GetReparacionesListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

