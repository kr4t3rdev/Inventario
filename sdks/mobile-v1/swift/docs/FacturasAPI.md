# FacturasAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetFacturasById**](FacturasAPI.md#mobilegetfacturasbyid) | **GET** /facturas/{id} | Detalle de factura
[**mobileListFacturas**](FacturasAPI.md#mobilelistfacturas) | **GET** /facturas | Listar facturas


# **mobileGetFacturasById**
```swift
    open class func mobileGetFacturasById(id: String, completion: @escaping (_ data: GetFacturasDetailResponse?, _ error: Error?) -> Void)
```

Detalle de factura

Devuelve el detalle de una factura.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | 

// Detalle de factura
FacturasAPI.mobileGetFacturasById(id: id) { (response, error) in
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

[**GetFacturasDetailResponse**](GetFacturasDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListFacturas**
```swift
    open class func mobileListFacturas(completion: @escaping (_ data: GetFacturasListResponse?, _ error: Error?) -> Void)
```

Listar facturas

Devuelve el listado de facturas del tenant.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar facturas
FacturasAPI.mobileListFacturas() { (response, error) in
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

[**GetFacturasListResponse**](GetFacturasListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

