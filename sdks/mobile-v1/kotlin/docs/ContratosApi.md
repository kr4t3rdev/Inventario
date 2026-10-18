# ContratosApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetContratosById**](ContratosApi.md#mobileGetContratosById) | **GET** /contratos/{id} | Detalle de contrato |
| [**mobileListContratos**](ContratosApi.md#mobileListContratos) | **GET** /contratos | Listar contratos |


<a id="mobileGetContratosById"></a>
# **mobileGetContratosById**
> GetContratosDetailResponse mobileGetContratosById(id)

Detalle de contrato

Devuelve el detalle de una contrato.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ContratosApi()
val id : kotlin.String = id_example // kotlin.String | 
try {
    val result : GetContratosDetailResponse = apiInstance.mobileGetContratosById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ContratosApi#mobileGetContratosById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ContratosApi#mobileGetContratosById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**|  | |

### Return type

[**GetContratosDetailResponse**](GetContratosDetailResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileListContratos"></a>
# **mobileListContratos**
> GetContratosListResponse mobileListContratos()

Listar contratos

Devuelve el listado de contratos del tenant.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ContratosApi()
try {
    val result : GetContratosListResponse = apiInstance.mobileListContratos()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ContratosApi#mobileListContratos")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ContratosApi#mobileListContratos")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetContratosListResponse**](GetContratosListResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

