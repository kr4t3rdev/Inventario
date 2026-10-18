# ContratosAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetContratosById**](ContratosAPI.md#mobilegetcontratosbyid) | **GET** /contratos/{id} | Detalle de contrato
[**mobileListContratos**](ContratosAPI.md#mobilelistcontratos) | **GET** /contratos | Listar contratos


# **mobileGetContratosById**
```swift
    open class func mobileGetContratosById(id: String, completion: @escaping (_ data: GetContratosDetailResponse?, _ error: Error?) -> Void)
```

Detalle de contrato

Devuelve el detalle de una contrato.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | 

// Detalle de contrato
ContratosAPI.mobileGetContratosById(id: id) { (response, error) in
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

[**GetContratosDetailResponse**](GetContratosDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListContratos**
```swift
    open class func mobileListContratos(completion: @escaping (_ data: GetContratosListResponse?, _ error: Error?) -> Void)
```

Listar contratos

Devuelve el listado de contratos del tenant.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar contratos
ContratosAPI.mobileListContratos() { (response, error) in
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

[**GetContratosListResponse**](GetContratosListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

