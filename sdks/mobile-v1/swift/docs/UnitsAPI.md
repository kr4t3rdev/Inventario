# UnitsAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileCreateUnit**](UnitsAPI.md#mobilecreateunit) | **POST** /units/create | Crear unidad
[**mobileDeleteUnit**](UnitsAPI.md#mobiledeleteunit) | **DELETE** /units/{id} | Eliminar unidad
[**mobileListUnits**](UnitsAPI.md#mobilelistunits) | **GET** /units | Listar unidades
[**mobileUpdateUnit**](UnitsAPI.md#mobileupdateunit) | **PUT** /units/{id} | Actualizar unidad


# **mobileCreateUnit**
```swift
    open class func mobileCreateUnit(mobileCreateUnitRequest: MobileCreateUnitRequest, completion: @escaping (_ data: GetUnitsDetailResponse?, _ error: Error?) -> Void)
```

Crear unidad

Crea una nueva unidad de medida.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let mobileCreateUnitRequest = mobileCreateUnit_request(nombre: "nombre_example", simbolo: "simbolo_example") // MobileCreateUnitRequest | 

// Crear unidad
UnitsAPI.mobileCreateUnit(mobileCreateUnitRequest: mobileCreateUnitRequest) { (response, error) in
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
 **mobileCreateUnitRequest** | [**MobileCreateUnitRequest**](MobileCreateUnitRequest.md) |  | 

### Return type

[**GetUnitsDetailResponse**](GetUnitsDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileDeleteUnit**
```swift
    open class func mobileDeleteUnit(id: String, completion: @escaping (_ data: DeleteUnitResponse?, _ error: Error?) -> Void)
```

Eliminar unidad

Elimina una unidad de medida.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | 

// Eliminar unidad
UnitsAPI.mobileDeleteUnit(id: id) { (response, error) in
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

[**DeleteUnitResponse**](DeleteUnitResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileListUnits**
```swift
    open class func mobileListUnits(completion: @escaping (_ data: GetUnitsListResponse?, _ error: Error?) -> Void)
```

Listar unidades

Devuelve las unidades de medida del tenant.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar unidades
UnitsAPI.mobileListUnits() { (response, error) in
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

[**GetUnitsListResponse**](GetUnitsListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileUpdateUnit**
```swift
    open class func mobileUpdateUnit(id: String, mobileUpdateUnitRequest: MobileUpdateUnitRequest, completion: @escaping (_ data: GetUnitsDetailResponse?, _ error: Error?) -> Void)
```

Actualizar unidad

Actualiza una unidad de medida.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | 
let mobileUpdateUnitRequest = mobileUpdateUnit_request(nombre: "nombre_example", simbolo: "simbolo_example") // MobileUpdateUnitRequest | 

// Actualizar unidad
UnitsAPI.mobileUpdateUnit(id: id, mobileUpdateUnitRequest: mobileUpdateUnitRequest) { (response, error) in
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
 **mobileUpdateUnitRequest** | [**MobileUpdateUnitRequest**](MobileUpdateUnitRequest.md) |  | 

### Return type

[**GetUnitsDetailResponse**](GetUnitsDetailResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

