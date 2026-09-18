# AccountingAdvancesApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileDeleteAccountingAdvancesById**](AccountingAdvancesApi.md#mobileDeleteAccountingAdvancesById) | **DELETE** /accounting/advances/{id} | Eliminar anticipo |
| [**mobileGetAccountingAdvances**](AccountingAdvancesApi.md#mobileGetAccountingAdvances) | **GET** /accounting/advances | Consultar anticipos |
| [**mobileGetAccountingAdvancesAvailable**](AccountingAdvancesApi.md#mobileGetAccountingAdvancesAvailable) | **GET** /accounting/advances/available | Consultar anticipos disponibles |
| [**mobileGetAccountingAdvancesById**](AccountingAdvancesApi.md#mobileGetAccountingAdvancesById) | **GET** /accounting/advances/{id} | Consultar anticipo |
| [**mobilePostAccountingAdvances**](AccountingAdvancesApi.md#mobilePostAccountingAdvances) | **POST** /accounting/advances | Registrar anticipos |
| [**mobilePostAccountingAdvancesByIdEjecutar**](AccountingAdvancesApi.md#mobilePostAccountingAdvancesByIdEjecutar) | **POST** /accounting/advances/{id}/ejecutar | Ejecutar anticipo reservado |
| [**mobilePostAccountingAdvancesByIdRevertir**](AccountingAdvancesApi.md#mobilePostAccountingAdvancesByIdRevertir) | **POST** /accounting/advances/{id}/revertir | Revertir ejecución de anticipo |
| [**mobilePutAccountingAdvancesById**](AccountingAdvancesApi.md#mobilePutAccountingAdvancesById) | **PUT** /accounting/advances/{id} | Actualizar anticipo |


<a id="mobileDeleteAccountingAdvancesById"></a>
# **mobileDeleteAccountingAdvancesById**
> DeleteAccountingAdvancesIdResponse mobileDeleteAccountingAdvancesById(id)

Eliminar anticipo

Elimina el anticipo identificado después de comprobar que pertenece al tenant.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingAdvancesApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
try {
    val result : DeleteAccountingAdvancesIdResponse = apiInstance.mobileDeleteAccountingAdvancesById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingAdvancesApi#mobileDeleteAccountingAdvancesById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingAdvancesApi#mobileDeleteAccountingAdvancesById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**| Identificador único del recurso. | |

### Return type

[**DeleteAccountingAdvancesIdResponse**](DeleteAccountingAdvancesIdResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingAdvances"></a>
# **mobileGetAccountingAdvances**
> GetAccountingAdvancesResponse mobileGetAccountingAdvances()

Consultar anticipos

Consulta anticipos de pago o cobro con su saldo disponible y vigencia.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingAdvancesApi()
try {
    val result : GetAccountingAdvancesResponse = apiInstance.mobileGetAccountingAdvances()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingAdvancesApi#mobileGetAccountingAdvances")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingAdvancesApi#mobileGetAccountingAdvances")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetAccountingAdvancesResponse**](GetAccountingAdvancesResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingAdvancesAvailable"></a>
# **mobileGetAccountingAdvancesAvailable**
> GetAccountingAdvancesAvailableResponse mobileGetAccountingAdvancesAvailable(contexto, proveedorId, clienteId, moneda, estado)

Consultar anticipos disponibles

Busca anticipos reservados con saldo que todavía pueden aplicarse a una compra o factura. Permite precisar la consulta mediante contexto de uso, proveedor, cliente, moneda, estado.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingAdvancesApi()
val contexto : kotlin.String = contexto_example // kotlin.String | Valor de contexto aceptado por el handler.
val proveedorId : kotlin.String = proveedorId_example // kotlin.String | Identificador del proveedor.
val clienteId : kotlin.String = clienteId_example // kotlin.String | Identificador del cliente.
val moneda : kotlin.String = moneda_example // kotlin.String | Código de moneda.
val estado : kotlin.Boolean = true // kotlin.Boolean | Estado usado para filtrar resultados.
try {
    val result : GetAccountingAdvancesAvailableResponse = apiInstance.mobileGetAccountingAdvancesAvailable(contexto, proveedorId, clienteId, moneda, estado)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingAdvancesApi#mobileGetAccountingAdvancesAvailable")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingAdvancesApi#mobileGetAccountingAdvancesAvailable")
    e.printStackTrace()
}
```

### Parameters
| **contexto** | **kotlin.String**| Valor de contexto aceptado por el handler. | [optional] [enum: compra, factura] |
| **proveedorId** | **kotlin.String**| Identificador del proveedor. | [optional] |
| **clienteId** | **kotlin.String**| Identificador del cliente. | [optional] |
| **moneda** | **kotlin.String**| Código de moneda. | [optional] |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **estado** | **kotlin.Boolean**| Estado usado para filtrar resultados. | [optional] |

### Return type

[**GetAccountingAdvancesAvailableResponse**](GetAccountingAdvancesAvailableResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetAccountingAdvancesById"></a>
# **mobileGetAccountingAdvancesById**
> GetAccountingAdvancesIdResponse mobileGetAccountingAdvancesById(id)

Consultar anticipo

Devuelve el anticipo solicitado con contrato, contraparte y movimientos relacionados.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingAdvancesApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
try {
    val result : GetAccountingAdvancesIdResponse = apiInstance.mobileGetAccountingAdvancesById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingAdvancesApi#mobileGetAccountingAdvancesById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingAdvancesApi#mobileGetAccountingAdvancesById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**| Identificador único del recurso. | |

### Return type

[**GetAccountingAdvancesIdResponse**](GetAccountingAdvancesIdResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobilePostAccountingAdvances"></a>
# **mobilePostAccountingAdvances**
> PostAccountingAdvancesResponse mobilePostAccountingAdvances(accountingAdvancesPostRequest)

Registrar anticipos

Crea una reserva de anticipo de pago o cobro, vinculada al contrato y contraparte indicados.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingAdvancesApi()
val accountingAdvancesPostRequest : AccountingAdvancesPostRequest =  // AccountingAdvancesPostRequest | 
try {
    val result : PostAccountingAdvancesResponse = apiInstance.mobilePostAccountingAdvances(accountingAdvancesPostRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingAdvancesApi#mobilePostAccountingAdvances")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingAdvancesApi#mobilePostAccountingAdvances")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **accountingAdvancesPostRequest** | [**AccountingAdvancesPostRequest**](AccountingAdvancesPostRequest.md)|  | |

### Return type

[**PostAccountingAdvancesResponse**](PostAccountingAdvancesResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePostAccountingAdvancesByIdEjecutar"></a>
# **mobilePostAccountingAdvancesByIdEjecutar**
> PostAccountingAdvancesIdEjecutarResponse mobilePostAccountingAdvancesByIdEjecutar(id, accountingAdvancesIdEjecutarPostRequest)

Ejecutar anticipo reservado

Aplica el saldo completo del anticipo al documento destino con control de idempotencia y período contable.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingAdvancesApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
val accountingAdvancesIdEjecutarPostRequest : AccountingAdvancesIdEjecutarPostRequest =  // AccountingAdvancesIdEjecutarPostRequest | 
try {
    val result : PostAccountingAdvancesIdEjecutarResponse = apiInstance.mobilePostAccountingAdvancesByIdEjecutar(id, accountingAdvancesIdEjecutarPostRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingAdvancesApi#mobilePostAccountingAdvancesByIdEjecutar")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingAdvancesApi#mobilePostAccountingAdvancesByIdEjecutar")
    e.printStackTrace()
}
```

### Parameters
| **id** | **kotlin.String**| Identificador único del recurso. | |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **accountingAdvancesIdEjecutarPostRequest** | [**AccountingAdvancesIdEjecutarPostRequest**](AccountingAdvancesIdEjecutarPostRequest.md)|  | |

### Return type

[**PostAccountingAdvancesIdEjecutarResponse**](PostAccountingAdvancesIdEjecutarResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePostAccountingAdvancesByIdRevertir"></a>
# **mobilePostAccountingAdvancesByIdRevertir**
> PostAccountingAdvancesIdRevertirResponse mobilePostAccountingAdvancesByIdRevertir(id, accountingAdvancesIdRevertirPostRequest)

Revertir ejecución de anticipo

Revierte el importe aplicado al documento destino y restablece el estado contable correspondiente.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingAdvancesApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
val accountingAdvancesIdRevertirPostRequest : AccountingAdvancesIdRevertirPostRequest =  // AccountingAdvancesIdRevertirPostRequest | 
try {
    val result : PostAccountingAdvancesIdRevertirResponse = apiInstance.mobilePostAccountingAdvancesByIdRevertir(id, accountingAdvancesIdRevertirPostRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingAdvancesApi#mobilePostAccountingAdvancesByIdRevertir")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingAdvancesApi#mobilePostAccountingAdvancesByIdRevertir")
    e.printStackTrace()
}
```

### Parameters
| **id** | **kotlin.String**| Identificador único del recurso. | |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **accountingAdvancesIdRevertirPostRequest** | [**AccountingAdvancesIdRevertirPostRequest**](AccountingAdvancesIdRevertirPostRequest.md)|  | |

### Return type

[**PostAccountingAdvancesIdRevertirResponse**](PostAccountingAdvancesIdRevertirResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePutAccountingAdvancesById"></a>
# **mobilePutAccountingAdvancesById**
> PutAccountingAdvancesIdResponse mobilePutAccountingAdvancesById(id, accountingAdvancesIdPutRequest)

Actualizar anticipo

Modifica estado, saldo disponible, vigencia o referencia externa del anticipo existente.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = AccountingAdvancesApi()
val id : kotlin.String = id_example // kotlin.String | Identificador único del recurso.
val accountingAdvancesIdPutRequest : AccountingAdvancesIdPutRequest =  // AccountingAdvancesIdPutRequest | 
try {
    val result : PutAccountingAdvancesIdResponse = apiInstance.mobilePutAccountingAdvancesById(id, accountingAdvancesIdPutRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling AccountingAdvancesApi#mobilePutAccountingAdvancesById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling AccountingAdvancesApi#mobilePutAccountingAdvancesById")
    e.printStackTrace()
}
```

### Parameters
| **id** | **kotlin.String**| Identificador único del recurso. | |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **accountingAdvancesIdPutRequest** | [**AccountingAdvancesIdPutRequest**](AccountingAdvancesIdPutRequest.md)|  | |

### Return type

[**PutAccountingAdvancesIdResponse**](PutAccountingAdvancesIdResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

