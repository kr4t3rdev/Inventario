# TransferenciasApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetTransferenciasById**](TransferenciasApi.md#mobileGetTransferenciasById) | **GET** /transferencias/{id} | Detalle de transferencia |
| [**mobileListTransferencias**](TransferenciasApi.md#mobileListTransferencias) | **GET** /transferencias | Listar transferencias |


<a id="mobileGetTransferenciasById"></a>
# **mobileGetTransferenciasById**
> GetTransferenciasDetailResponse mobileGetTransferenciasById(id)

Detalle de transferencia

Devuelve el detalle de una transferencia.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = TransferenciasApi()
val id : kotlin.String = id_example // kotlin.String | 
try {
    val result : GetTransferenciasDetailResponse = apiInstance.mobileGetTransferenciasById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling TransferenciasApi#mobileGetTransferenciasById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling TransferenciasApi#mobileGetTransferenciasById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**|  | |

### Return type

[**GetTransferenciasDetailResponse**](GetTransferenciasDetailResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileListTransferencias"></a>
# **mobileListTransferencias**
> GetTransferenciasListResponse mobileListTransferencias()

Listar transferencias

Devuelve el listado de transferencias del tenant.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = TransferenciasApi()
try {
    val result : GetTransferenciasListResponse = apiInstance.mobileListTransferencias()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling TransferenciasApi#mobileListTransferencias")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling TransferenciasApi#mobileListTransferencias")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetTransferenciasListResponse**](GetTransferenciasListResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

