# ClientsApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileDeleteClientsById**](ClientsApi.md#mobileDeleteClientsById) | **DELETE** /clients/{id} | Eliminar cliente |
| [**mobileGetClients**](ClientsApi.md#mobileGetClients) | **GET** /clients | Listar clientes |
| [**mobileGetClientsById**](ClientsApi.md#mobileGetClientsById) | **GET** /clients/{id} | Consultar cliente |
| [**mobilePostClientsCreate**](ClientsApi.md#mobilePostClientsCreate) | **POST** /clients/create | Crear cliente |
| [**mobilePutClientsById**](ClientsApi.md#mobilePutClientsById) | **PUT** /clients/{id} | Editar cliente |


<a id="mobileDeleteClientsById"></a>
# **mobileDeleteClientsById**
> ClienteDeleteResponse mobileDeleteClientsById(id)

Eliminar cliente

Elimina un cliente del tenant activo y devuelve la confirmación.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ClientsApi()
val id : kotlin.String = id_example // kotlin.String | Identificador del cliente.
try {
    val result : ClienteDeleteResponse = apiInstance.mobileDeleteClientsById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ClientsApi#mobileDeleteClientsById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ClientsApi#mobileDeleteClientsById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**| Identificador del cliente. | |

### Return type

[**ClienteDeleteResponse**](ClienteDeleteResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetClients"></a>
# **mobileGetClients**
> ClienteListResponse mobileGetClients()

Listar clientes

Devuelve los clientes del tenant activo ordenados por creación descendente.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ClientsApi()
try {
    val result : ClienteListResponse = apiInstance.mobileGetClients()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ClientsApi#mobileGetClients")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ClientsApi#mobileGetClients")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**ClienteListResponse**](ClienteListResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetClientsById"></a>
# **mobileGetClientsById**
> Cliente mobileGetClientsById(id)

Consultar cliente

Devuelve el detalle de un cliente del tenant activo.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ClientsApi()
val id : kotlin.String = id_example // kotlin.String | Identificador del cliente.
try {
    val result : Cliente = apiInstance.mobileGetClientsById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ClientsApi#mobileGetClientsById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ClientsApi#mobileGetClientsById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**| Identificador del cliente. | |

### Return type

[**Cliente**](Cliente.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobilePostClientsCreate"></a>
# **mobilePostClientsCreate**
> Cliente mobilePostClientsCreate(clienteCreateRequest)

Crear cliente

Crea un cliente en el tenant activo y devuelve el registro creado.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ClientsApi()
val clienteCreateRequest : ClienteCreateRequest =  // ClienteCreateRequest | 
try {
    val result : Cliente = apiInstance.mobilePostClientsCreate(clienteCreateRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ClientsApi#mobilePostClientsCreate")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ClientsApi#mobilePostClientsCreate")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **clienteCreateRequest** | [**ClienteCreateRequest**](ClienteCreateRequest.md)|  | |

### Return type

[**Cliente**](Cliente.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePutClientsById"></a>
# **mobilePutClientsById**
> Cliente mobilePutClientsById(id, clienteUpdateRequest)

Editar cliente

Actualiza los datos de un cliente del tenant activo y devuelve el registro actualizado.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ClientsApi()
val id : kotlin.String = id_example // kotlin.String | Identificador del cliente.
val clienteUpdateRequest : ClienteUpdateRequest =  // ClienteUpdateRequest | 
try {
    val result : Cliente = apiInstance.mobilePutClientsById(id, clienteUpdateRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ClientsApi#mobilePutClientsById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ClientsApi#mobilePutClientsById")
    e.printStackTrace()
}
```

### Parameters
| **id** | **kotlin.String**| Identificador del cliente. | |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **clienteUpdateRequest** | [**ClienteUpdateRequest**](ClienteUpdateRequest.md)|  | |

### Return type

[**Cliente**](Cliente.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

