# WarehousesAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileDeleteWarehousesById**](WarehousesAPI.md#mobiledeletewarehousesbyid) | **DELETE** /warehouses/{id} | Eliminar almacén
[**mobileGetWarehouses**](WarehousesAPI.md#mobilegetwarehouses) | **GET** /warehouses | Listar almacenes
[**mobileGetWarehousesById**](WarehousesAPI.md#mobilegetwarehousesbyid) | **GET** /warehouses/{id} | Consultar almacén
[**mobilePostWarehousesCreate**](WarehousesAPI.md#mobilepostwarehousescreate) | **POST** /warehouses/create | Crear almacén
[**mobilePutWarehousesById**](WarehousesAPI.md#mobileputwarehousesbyid) | **PUT** /warehouses/{id} | Editar almacén


# **mobileDeleteWarehousesById**
```swift
    open class func mobileDeleteWarehousesById(id: String, completion: @escaping (_ data: AlmacenDeleteResponse?, _ error: Error?) -> Void)
```

Eliminar almacén

Elimina un almacén del tenant activo y devuelve la confirmación.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador del almacén.

// Eliminar almacén
WarehousesAPI.mobileDeleteWarehousesById(id: id) { (response, error) in
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
 **id** | **String** | Identificador del almacén. | 

### Return type

[**AlmacenDeleteResponse**](AlmacenDeleteResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetWarehouses**
```swift
    open class func mobileGetWarehouses(completion: @escaping (_ data: AlmacenListResponse?, _ error: Error?) -> Void)
```

Listar almacenes

Devuelve los almacenes del tenant activo ordenados por nombre ascendente.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar almacenes
WarehousesAPI.mobileGetWarehouses() { (response, error) in
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

[**AlmacenListResponse**](AlmacenListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetWarehousesById**
```swift
    open class func mobileGetWarehousesById(id: String, completion: @escaping (_ data: Almacen?, _ error: Error?) -> Void)
```

Consultar almacén

Devuelve el detalle de un almacén del tenant activo.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador del almacén.

// Consultar almacén
WarehousesAPI.mobileGetWarehousesById(id: id) { (response, error) in
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
 **id** | **String** | Identificador del almacén. | 

### Return type

[**Almacen**](Almacen.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostWarehousesCreate**
```swift
    open class func mobilePostWarehousesCreate(almacenCreateRequest: AlmacenCreateRequest, completion: @escaping (_ data: Almacen?, _ error: Error?) -> Void)
```

Crear almacén

Crea un almacén en el tenant activo y devuelve el registro creado.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let almacenCreateRequest = AlmacenCreateRequest(nombre: "nombre_example") // AlmacenCreateRequest | 

// Crear almacén
WarehousesAPI.mobilePostWarehousesCreate(almacenCreateRequest: almacenCreateRequest) { (response, error) in
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
 **almacenCreateRequest** | [**AlmacenCreateRequest**](AlmacenCreateRequest.md) |  | 

### Return type

[**Almacen**](Almacen.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePutWarehousesById**
```swift
    open class func mobilePutWarehousesById(id: String, almacenUpdateRequest: AlmacenUpdateRequest, completion: @escaping (_ data: Almacen?, _ error: Error?) -> Void)
```

Editar almacén

Actualiza los datos de un almacén del tenant activo y devuelve el registro actualizado.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador del almacén.
let almacenUpdateRequest = AlmacenUpdateRequest(nombre: "nombre_example") // AlmacenUpdateRequest | 

// Editar almacén
WarehousesAPI.mobilePutWarehousesById(id: id, almacenUpdateRequest: almacenUpdateRequest) { (response, error) in
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
 **id** | **String** | Identificador del almacén. | 
 **almacenUpdateRequest** | [**AlmacenUpdateRequest**](AlmacenUpdateRequest.md) |  | 

### Return type

[**Almacen**](Almacen.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

