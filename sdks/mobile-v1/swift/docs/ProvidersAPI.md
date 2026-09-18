# ProvidersAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileDeleteProvidersById**](ProvidersAPI.md#mobiledeleteprovidersbyid) | **DELETE** /providers/{id} | Eliminar proveedor
[**mobileGetProviders**](ProvidersAPI.md#mobilegetproviders) | **GET** /providers | Listar proveedores
[**mobileGetProvidersById**](ProvidersAPI.md#mobilegetprovidersbyid) | **GET** /providers/{id} | Consultar proveedor
[**mobilePostProvidersCreate**](ProvidersAPI.md#mobilepostproviderscreate) | **POST** /providers/create | Crear proveedor
[**mobilePutProvidersById**](ProvidersAPI.md#mobileputprovidersbyid) | **PUT** /providers/{id} | Editar proveedor


# **mobileDeleteProvidersById**
```swift
    open class func mobileDeleteProvidersById(id: String, completion: @escaping (_ data: ProveedorDeleteResponse?, _ error: Error?) -> Void)
```

Eliminar proveedor

Elimina un proveedor del tenant activo y devuelve la confirmación.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador del proveedor.

// Eliminar proveedor
ProvidersAPI.mobileDeleteProvidersById(id: id) { (response, error) in
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
 **id** | **String** | Identificador del proveedor. | 

### Return type

[**ProveedorDeleteResponse**](ProveedorDeleteResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetProviders**
```swift
    open class func mobileGetProviders(completion: @escaping (_ data: ProveedorListResponse?, _ error: Error?) -> Void)
```

Listar proveedores

Devuelve los proveedores del tenant activo ordenados por creación descendente.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar proveedores
ProvidersAPI.mobileGetProviders() { (response, error) in
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

[**ProveedorListResponse**](ProveedorListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetProvidersById**
```swift
    open class func mobileGetProvidersById(id: String, completion: @escaping (_ data: Proveedor?, _ error: Error?) -> Void)
```

Consultar proveedor

Devuelve el detalle de un proveedor del tenant activo.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador del proveedor.

// Consultar proveedor
ProvidersAPI.mobileGetProvidersById(id: id) { (response, error) in
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
 **id** | **String** | Identificador del proveedor. | 

### Return type

[**Proveedor**](Proveedor.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostProvidersCreate**
```swift
    open class func mobilePostProvidersCreate(proveedorCreateRequest: ProveedorCreateRequest, completion: @escaping (_ data: Proveedor?, _ error: Error?) -> Void)
```

Crear proveedor

Crea un proveedor en el tenant activo y devuelve el registro creado.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let proveedorCreateRequest = ProveedorCreateRequest(nombre: "nombre_example", contacto: "contacto_example", direccion: "direccion_example", telefono: "telefono_example", cuentaCUP: "cuentaCUP_example", cuentaUSD: "cuentaUSD_example", logo: "logo_example", contrato: "contrato_example") // ProveedorCreateRequest | 

// Crear proveedor
ProvidersAPI.mobilePostProvidersCreate(proveedorCreateRequest: proveedorCreateRequest) { (response, error) in
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
 **proveedorCreateRequest** | [**ProveedorCreateRequest**](ProveedorCreateRequest.md) |  | 

### Return type

[**Proveedor**](Proveedor.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePutProvidersById**
```swift
    open class func mobilePutProvidersById(id: String, proveedorUpdateRequest: ProveedorUpdateRequest, completion: @escaping (_ data: Proveedor?, _ error: Error?) -> Void)
```

Editar proveedor

Actualiza los datos de un proveedor del tenant activo y devuelve el registro actualizado.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador del proveedor.
let proveedorUpdateRequest = ProveedorUpdateRequest(nombre: "nombre_example", contacto: "contacto_example", direccion: "direccion_example", telefono: "telefono_example", cuentaCUP: "cuentaCUP_example", cuentaUSD: "cuentaUSD_example", logo: "logo_example", contrato: "contrato_example") // ProveedorUpdateRequest | 

// Editar proveedor
ProvidersAPI.mobilePutProvidersById(id: id, proveedorUpdateRequest: proveedorUpdateRequest) { (response, error) in
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
 **id** | **String** | Identificador del proveedor. | 
 **proveedorUpdateRequest** | [**ProveedorUpdateRequest**](ProveedorUpdateRequest.md) |  | 

### Return type

[**Proveedor**](Proveedor.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

