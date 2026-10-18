# EmpleadosAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetEmpleadosById**](EmpleadosAPI.md#mobilegetempleadosbyid) | **GET** /empleados/{id} | Detalle de empleado
[**mobileListEmpleados**](EmpleadosAPI.md#mobilelistempleados) | **GET** /empleados | Listar empleados


# **mobileGetEmpleadosById**
```swift
    open class func mobileGetEmpleadosById(id: String, completion: @escaping (_ data: GetEmpleadosDetailResponse?, _ error: Error?) -> Void)
```

Detalle de empleado

Devuelve el detalle de una empleado.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | 

// Detalle de empleado
EmpleadosAPI.mobileGetEmpleadosById(id: id) { (response, error) in
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

[**GetEmpleadosDetailResponse**](GetEmpleadosDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListEmpleados**
```swift
    open class func mobileListEmpleados(completion: @escaping (_ data: GetEmpleadosListResponse?, _ error: Error?) -> Void)
```

Listar empleados

Devuelve el listado de empleados del tenant.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar empleados
EmpleadosAPI.mobileListEmpleados() { (response, error) in
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

[**GetEmpleadosListResponse**](GetEmpleadosListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

