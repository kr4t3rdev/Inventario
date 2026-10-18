# PuntosVentaAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetPuntoVentaById**](PuntosVentaAPI.md#mobilegetpuntoventabyid) | **GET** /puntos-venta/{id} | Detalle de punto de venta
[**mobileListPuntosVenta**](PuntosVentaAPI.md#mobilelistpuntosventa) | **GET** /puntos-venta | Listar puntos de venta


# **mobileGetPuntoVentaById**
```swift
    open class func mobileGetPuntoVentaById(id: String, completion: @escaping (_ data: GetPuntosVentaDetailResponse?, _ error: Error?) -> Void)
```

Detalle de punto de venta

Detalle de un punto de venta.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | 

// Detalle de punto de venta
PuntosVentaAPI.mobileGetPuntoVentaById(id: id) { (response, error) in
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

[**GetPuntosVentaDetailResponse**](GetPuntosVentaDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListPuntosVenta**
```swift
    open class func mobileListPuntosVenta(completion: @escaping (_ data: GetPuntosVentaListResponse?, _ error: Error?) -> Void)
```

Listar puntos de venta

Puntos de venta del tenant.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar puntos de venta
PuntosVentaAPI.mobileListPuntosVenta() { (response, error) in
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

[**GetPuntosVentaListResponse**](GetPuntosVentaListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

