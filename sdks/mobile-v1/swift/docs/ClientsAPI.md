# ClientsAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileDeleteClientsById**](ClientsAPI.md#mobiledeleteclientsbyid) | **DELETE** /clients/{id} | Eliminar cliente
[**mobileGetClients**](ClientsAPI.md#mobilegetclients) | **GET** /clients | Listar clientes
[**mobileGetClientsById**](ClientsAPI.md#mobilegetclientsbyid) | **GET** /clients/{id} | Consultar cliente
[**mobilePostClientsCreate**](ClientsAPI.md#mobilepostclientscreate) | **POST** /clients/create | Crear cliente
[**mobilePutClientsById**](ClientsAPI.md#mobileputclientsbyid) | **PUT** /clients/{id} | Editar cliente


# **mobileDeleteClientsById**
```swift
    open class func mobileDeleteClientsById(id: String, completion: @escaping (_ data: ClienteDeleteResponse?, _ error: Error?) -> Void)
```

Eliminar cliente

Elimina un cliente del tenant activo y devuelve la confirmación.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador del cliente.

// Eliminar cliente
ClientsAPI.mobileDeleteClientsById(id: id) { (response, error) in
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
 **id** | **String** | Identificador del cliente. | 

### Return type

[**ClienteDeleteResponse**](ClienteDeleteResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetClients**
```swift
    open class func mobileGetClients(completion: @escaping (_ data: ClienteListResponse?, _ error: Error?) -> Void)
```

Listar clientes

Devuelve los clientes del tenant activo ordenados por creación descendente.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Listar clientes
ClientsAPI.mobileGetClients() { (response, error) in
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

[**ClienteListResponse**](ClienteListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetClientsById**
```swift
    open class func mobileGetClientsById(id: String, completion: @escaping (_ data: Cliente?, _ error: Error?) -> Void)
```

Consultar cliente

Devuelve el detalle de un cliente del tenant activo.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador del cliente.

// Consultar cliente
ClientsAPI.mobileGetClientsById(id: id) { (response, error) in
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
 **id** | **String** | Identificador del cliente. | 

### Return type

[**Cliente**](Cliente.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostClientsCreate**
```swift
    open class func mobilePostClientsCreate(clienteCreateRequest: ClienteCreateRequest, completion: @escaping (_ data: Cliente?, _ error: Error?) -> Void)
```

Crear cliente

Crea un cliente en el tenant activo y devuelve el registro creado.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let clienteCreateRequest = ClienteCreateRequest(nombre: "nombre_example", direccion: "direccion_example", telefono: "telefono_example", logoUrl: "logoUrl_example", numeroCuentaCUP: "numeroCuentaCUP_example", numeroCuentaUSD: "numeroCuentaUSD_example", numeroContrato: "numeroContrato_example") // ClienteCreateRequest | 

// Crear cliente
ClientsAPI.mobilePostClientsCreate(clienteCreateRequest: clienteCreateRequest) { (response, error) in
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
 **clienteCreateRequest** | [**ClienteCreateRequest**](ClienteCreateRequest.md) |  | 

### Return type

[**Cliente**](Cliente.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePutClientsById**
```swift
    open class func mobilePutClientsById(id: String, clienteUpdateRequest: ClienteUpdateRequest, completion: @escaping (_ data: Cliente?, _ error: Error?) -> Void)
```

Editar cliente

Actualiza los datos de un cliente del tenant activo y devuelve el registro actualizado.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador del cliente.
let clienteUpdateRequest = ClienteUpdateRequest(nombre: "nombre_example", direccion: "direccion_example", telefono: "telefono_example", logoUrl: "logoUrl_example", numeroCuentaCUP: "numeroCuentaCUP_example", numeroCuentaUSD: "numeroCuentaUSD_example", numeroContrato: "numeroContrato_example") // ClienteUpdateRequest | 

// Editar cliente
ClientsAPI.mobilePutClientsById(id: id, clienteUpdateRequest: clienteUpdateRequest) { (response, error) in
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
 **id** | **String** | Identificador del cliente. | 
 **clienteUpdateRequest** | [**ClienteUpdateRequest**](ClienteUpdateRequest.md) |  | 

### Return type

[**Cliente**](Cliente.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

