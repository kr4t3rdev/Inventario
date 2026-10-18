# TransferenciasAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetTransferenciasById**](TransferenciasAPI.md#mobilegettransferenciasbyid) | **GET** /transferencias/{id} | Detalle de transferencia
[**mobileListTransferencias**](TransferenciasAPI.md#mobilelisttransferencias) | **GET** /transferencias | Listar transferencias


# **mobileGetTransferenciasById**
```swift
    open class func mobileGetTransferenciasById(id: String, completion: @escaping (_ data: GetTransferenciasDetailResponse?, _ error: Error?) -> Void)
```

Detalle de transferencia

Devuelve el detalle de una transferencia.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | 

// Detalle de transferencia
TransferenciasAPI.mobileGetTransferenciasById(id: id) { (response, error) in
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

[**GetTransferenciasDetailResponse**](GetTransferenciasDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListTransferencias**
```swift
    open class func mobileListTransferencias(completion: @escaping (_ data: GetTransferenciasListResponse?, _ error: Error?) -> Void)
```

Listar transferencias

Devuelve el listado de transferencias del tenant.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar transferencias
TransferenciasAPI.mobileListTransferencias() { (response, error) in
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

[**GetTransferenciasListResponse**](GetTransferenciasListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

