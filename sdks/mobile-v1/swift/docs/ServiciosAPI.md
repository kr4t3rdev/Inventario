# ServiciosAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetServiciosById**](ServiciosAPI.md#mobilegetserviciosbyid) | **GET** /servicios/{id} | Detalle de servicio
[**mobileListServicios**](ServiciosAPI.md#mobilelistservicios) | **GET** /servicios | Listar servicios


# **mobileGetServiciosById**
```swift
    open class func mobileGetServiciosById(id: String, completion: @escaping (_ data: GetServiciosDetailResponse?, _ error: Error?) -> Void)
```

Detalle de servicio

Devuelve el detalle de una servicio.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | 

// Detalle de servicio
ServiciosAPI.mobileGetServiciosById(id: id) { (response, error) in
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

[**GetServiciosDetailResponse**](GetServiciosDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListServicios**
```swift
    open class func mobileListServicios(completion: @escaping (_ data: GetServiciosListResponse?, _ error: Error?) -> Void)
```

Listar servicios

Devuelve el listado de servicios del tenant.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar servicios
ServiciosAPI.mobileListServicios() { (response, error) in
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

[**GetServiciosListResponse**](GetServiciosListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

