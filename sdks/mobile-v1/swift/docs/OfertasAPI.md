# OfertasAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetOfertasById**](OfertasAPI.md#mobilegetofertasbyid) | **GET** /ofertas/{id} | Detalle de oferta
[**mobileListOfertas**](OfertasAPI.md#mobilelistofertas) | **GET** /ofertas | Listar ofertas


# **mobileGetOfertasById**
```swift
    open class func mobileGetOfertasById(id: String, completion: @escaping (_ data: GetOfertasDetailResponse?, _ error: Error?) -> Void)
```

Detalle de oferta

Devuelve el detalle de una oferta.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | 

// Detalle de oferta
OfertasAPI.mobileGetOfertasById(id: id) { (response, error) in
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

[**GetOfertasDetailResponse**](GetOfertasDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListOfertas**
```swift
    open class func mobileListOfertas(completion: @escaping (_ data: GetOfertasListResponse?, _ error: Error?) -> Void)
```

Listar ofertas

Devuelve el listado de ofertas del tenant.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar ofertas
OfertasAPI.mobileListOfertas() { (response, error) in
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

[**GetOfertasListResponse**](GetOfertasListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

