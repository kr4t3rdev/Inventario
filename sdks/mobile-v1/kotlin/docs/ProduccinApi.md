# ProduccinApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetProduccionById**](ProduccinApi.md#mobileGetProduccionById) | **GET** /produccion/{id} | Detalle de orden de producción |
| [**mobileListProduccion**](ProduccinApi.md#mobileListProduccion) | **GET** /produccion | Listar órdenes de producción |


<a id="mobileGetProduccionById"></a>
# **mobileGetProduccionById**
> GetProduccionDetailResponse mobileGetProduccionById(id)

Detalle de orden de producción

Devuelve el detalle de una orden de producción.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ProduccinApi()
val id : kotlin.String = id_example // kotlin.String | 
try {
    val result : GetProduccionDetailResponse = apiInstance.mobileGetProduccionById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ProduccinApi#mobileGetProduccionById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ProduccinApi#mobileGetProduccionById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**|  | |

### Return type

[**GetProduccionDetailResponse**](GetProduccionDetailResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileListProduccion"></a>
# **mobileListProduccion**
> GetProduccionListResponse mobileListProduccion()

Listar órdenes de producción

Devuelve el listado de órdenes de producción del tenant.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ProduccinApi()
try {
    val result : GetProduccionListResponse = apiInstance.mobileListProduccion()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ProduccinApi#mobileListProduccion")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ProduccinApi#mobileListProduccion")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetProduccionListResponse**](GetProduccionListResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

