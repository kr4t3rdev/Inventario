# MermasAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetMermasById**](MermasAPI.md#mobilegetmermasbyid) | **GET** /mermas/{id} | Detalle de merma
[**mobileListMermas**](MermasAPI.md#mobilelistmermas) | **GET** /mermas | Listar mermas


# **mobileGetMermasById**
```swift
    open class func mobileGetMermasById(id: String, completion: @escaping (_ data: GetMermasDetailResponse?, _ error: Error?) -> Void)
```

Detalle de merma

Devuelve el detalle de una merma.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | 

// Detalle de merma
MermasAPI.mobileGetMermasById(id: id) { (response, error) in
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

[**GetMermasDetailResponse**](GetMermasDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListMermas**
```swift
    open class func mobileListMermas(completion: @escaping (_ data: GetMermasListResponse?, _ error: Error?) -> Void)
```

Listar mermas

Devuelve el listado de mermas del tenant.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar mermas
MermasAPI.mobileListMermas() { (response, error) in
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

[**GetMermasListResponse**](GetMermasListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

