# AccountingAdvancesAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileDeleteAccountingAdvancesById**](AccountingAdvancesAPI.md#mobiledeleteaccountingadvancesbyid) | **DELETE** /accounting/advances/{id} | Eliminar anticipo
[**mobileGetAccountingAdvances**](AccountingAdvancesAPI.md#mobilegetaccountingadvances) | **GET** /accounting/advances | Consultar anticipos
[**mobileGetAccountingAdvancesAvailable**](AccountingAdvancesAPI.md#mobilegetaccountingadvancesavailable) | **GET** /accounting/advances/available | Consultar anticipos disponibles
[**mobileGetAccountingAdvancesById**](AccountingAdvancesAPI.md#mobilegetaccountingadvancesbyid) | **GET** /accounting/advances/{id} | Consultar anticipo
[**mobilePostAccountingAdvances**](AccountingAdvancesAPI.md#mobilepostaccountingadvances) | **POST** /accounting/advances | Registrar anticipos
[**mobilePostAccountingAdvancesByIdEjecutar**](AccountingAdvancesAPI.md#mobilepostaccountingadvancesbyidejecutar) | **POST** /accounting/advances/{id}/ejecutar | Ejecutar anticipo reservado
[**mobilePostAccountingAdvancesByIdRevertir**](AccountingAdvancesAPI.md#mobilepostaccountingadvancesbyidrevertir) | **POST** /accounting/advances/{id}/revertir | Revertir ejecución de anticipo
[**mobilePutAccountingAdvancesById**](AccountingAdvancesAPI.md#mobileputaccountingadvancesbyid) | **PUT** /accounting/advances/{id} | Actualizar anticipo


# **mobileDeleteAccountingAdvancesById**
```swift
    open class func mobileDeleteAccountingAdvancesById(id: String, completion: @escaping (_ data: DeleteAccountingAdvancesIdResponse?, _ error: Error?) -> Void)
```

Eliminar anticipo

Elimina el anticipo identificado después de comprobar que pertenece al tenant.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.

// Eliminar anticipo
AccountingAdvancesAPI.mobileDeleteAccountingAdvancesById(id: id) { (response, error) in
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
 **id** | **String** | Identificador único del recurso. | 

### Return type

[**DeleteAccountingAdvancesIdResponse**](DeleteAccountingAdvancesIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingAdvances**
```swift
    open class func mobileGetAccountingAdvances(completion: @escaping (_ data: GetAccountingAdvancesResponse?, _ error: Error?) -> Void)
```

Consultar anticipos

Consulta anticipos de pago o cobro con su saldo disponible y vigencia.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK


// Consultar anticipos
AccountingAdvancesAPI.mobileGetAccountingAdvances() { (response, error) in
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

[**GetAccountingAdvancesResponse**](GetAccountingAdvancesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingAdvancesAvailable**
```swift
    open class func mobileGetAccountingAdvancesAvailable(contexto: Contexto_mobileGetAccountingAdvancesAvailable? = nil, proveedorId: String? = nil, clienteId: String? = nil, moneda: String? = nil, estado: Bool? = nil, completion: @escaping (_ data: GetAccountingAdvancesAvailableResponse?, _ error: Error?) -> Void)
```

Consultar anticipos disponibles

Busca anticipos reservados con saldo que todavía pueden aplicarse a una compra o factura. Permite precisar la consulta mediante contexto de uso, proveedor, cliente, moneda, estado.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let contexto = "contexto_example" // String | Valor de contexto aceptado por el handler. (optional)
let proveedorId = "proveedorId_example" // String | Identificador del proveedor. (optional)
let clienteId = "clienteId_example" // String | Identificador del cliente. (optional)
let moneda = "moneda_example" // String | Código de moneda. (optional)
let estado = true // Bool | Estado usado para filtrar resultados. (optional)

// Consultar anticipos disponibles
AccountingAdvancesAPI.mobileGetAccountingAdvancesAvailable(contexto: contexto, proveedorId: proveedorId, clienteId: clienteId, moneda: moneda, estado: estado) { (response, error) in
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
 **contexto** | **String** | Valor de contexto aceptado por el handler. | [optional] 
 **proveedorId** | **String** | Identificador del proveedor. | [optional] 
 **clienteId** | **String** | Identificador del cliente. | [optional] 
 **moneda** | **String** | Código de moneda. | [optional] 
 **estado** | **Bool** | Estado usado para filtrar resultados. | [optional] 

### Return type

[**GetAccountingAdvancesAvailableResponse**](GetAccountingAdvancesAvailableResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobileGetAccountingAdvancesById**
```swift
    open class func mobileGetAccountingAdvancesById(id: String, completion: @escaping (_ data: GetAccountingAdvancesIdResponse?, _ error: Error?) -> Void)
```

Consultar anticipo

Devuelve el anticipo solicitado con contrato, contraparte y movimientos relacionados.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.

// Consultar anticipo
AccountingAdvancesAPI.mobileGetAccountingAdvancesById(id: id) { (response, error) in
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
 **id** | **String** | Identificador único del recurso. | 

### Return type

[**GetAccountingAdvancesIdResponse**](GetAccountingAdvancesIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingAdvances**
```swift
    open class func mobilePostAccountingAdvances(accountingAdvancesPostRequest: AccountingAdvancesPostRequest, completion: @escaping (_ data: PostAccountingAdvancesResponse?, _ error: Error?) -> Void)
```

Registrar anticipos

Crea una reserva de anticipo de pago o cobro, vinculada al contrato y contraparte indicados.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let accountingAdvancesPostRequest = AccountingAdvancesPostRequest(tipo: "tipo_example", contratoId: "contratoId_example", proveedorId: "proveedorId_example", clienteId: "clienteId_example", monto: 123, moneda: "moneda_example", cuentaOrigenId: "cuentaOrigenId_example", tipoPagoOrigenId: "tipoPagoOrigenId_example", referenciaExterna: "referenciaExterna_example", vigenciaHasta: Date()) // AccountingAdvancesPostRequest | 

// Registrar anticipos
AccountingAdvancesAPI.mobilePostAccountingAdvances(accountingAdvancesPostRequest: accountingAdvancesPostRequest) { (response, error) in
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
 **accountingAdvancesPostRequest** | [**AccountingAdvancesPostRequest**](AccountingAdvancesPostRequest.md) |  | 

### Return type

[**PostAccountingAdvancesResponse**](PostAccountingAdvancesResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingAdvancesByIdEjecutar**
```swift
    open class func mobilePostAccountingAdvancesByIdEjecutar(id: String, accountingAdvancesIdEjecutarPostRequest: AccountingAdvancesIdEjecutarPostRequest, completion: @escaping (_ data: PostAccountingAdvancesIdEjecutarResponse?, _ error: Error?) -> Void)
```

Ejecutar anticipo reservado

Aplica el saldo completo del anticipo al documento destino con control de idempotencia y período contable.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.
let accountingAdvancesIdEjecutarPostRequest = AccountingAdvancesIdEjecutarPostRequest(contexto: "contexto_example", documentoDestinoId: "documentoDestinoId_example", montoObjetivo: 123, monedaObjetivo: "monedaObjetivo_example", tasaAplicada: 123, idempotencyKey: "idempotencyKey_example", observaciones: "observaciones_example") // AccountingAdvancesIdEjecutarPostRequest | 

// Ejecutar anticipo reservado
AccountingAdvancesAPI.mobilePostAccountingAdvancesByIdEjecutar(id: id, accountingAdvancesIdEjecutarPostRequest: accountingAdvancesIdEjecutarPostRequest) { (response, error) in
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
 **id** | **String** | Identificador único del recurso. | 
 **accountingAdvancesIdEjecutarPostRequest** | [**AccountingAdvancesIdEjecutarPostRequest**](AccountingAdvancesIdEjecutarPostRequest.md) |  | 

### Return type

[**PostAccountingAdvancesIdEjecutarResponse**](PostAccountingAdvancesIdEjecutarResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePostAccountingAdvancesByIdRevertir**
```swift
    open class func mobilePostAccountingAdvancesByIdRevertir(id: String, accountingAdvancesIdRevertirPostRequest: AccountingAdvancesIdRevertirPostRequest, completion: @escaping (_ data: PostAccountingAdvancesIdRevertirResponse?, _ error: Error?) -> Void)
```

Revertir ejecución de anticipo

Revierte el importe aplicado al documento destino y restablece el estado contable correspondiente.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.
let accountingAdvancesIdRevertirPostRequest = AccountingAdvancesIdRevertirPostRequest(documentoDestinoId: "documentoDestinoId_example", montoReverso: 123, observaciones: "observaciones_example") // AccountingAdvancesIdRevertirPostRequest | 

// Revertir ejecución de anticipo
AccountingAdvancesAPI.mobilePostAccountingAdvancesByIdRevertir(id: id, accountingAdvancesIdRevertirPostRequest: accountingAdvancesIdRevertirPostRequest) { (response, error) in
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
 **id** | **String** | Identificador único del recurso. | 
 **accountingAdvancesIdRevertirPostRequest** | [**AccountingAdvancesIdRevertirPostRequest**](AccountingAdvancesIdRevertirPostRequest.md) |  | 

### Return type

[**PostAccountingAdvancesIdRevertirResponse**](PostAccountingAdvancesIdRevertirResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mobilePutAccountingAdvancesById**
```swift
    open class func mobilePutAccountingAdvancesById(id: String, accountingAdvancesIdPutRequest: AccountingAdvancesIdPutRequest, completion: @escaping (_ data: PutAccountingAdvancesIdResponse?, _ error: Error?) -> Void)
```

Actualizar anticipo

Modifica estado, saldo disponible, vigencia o referencia externa del anticipo existente.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let id = "id_example" // String | Identificador único del recurso.
let accountingAdvancesIdPutRequest = AccountingAdvancesIdPutRequest(estado: false, saldoDisponible: 123, vigenciaHasta: Date(), referenciaExterna: "referenciaExterna_example") // AccountingAdvancesIdPutRequest | 

// Actualizar anticipo
AccountingAdvancesAPI.mobilePutAccountingAdvancesById(id: id, accountingAdvancesIdPutRequest: accountingAdvancesIdPutRequest) { (response, error) in
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
 **id** | **String** | Identificador único del recurso. | 
 **accountingAdvancesIdPutRequest** | [**AccountingAdvancesIdPutRequest**](AccountingAdvancesIdPutRequest.md) |  | 

### Return type

[**PutAccountingAdvancesIdResponse**](PutAccountingAdvancesIdResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

