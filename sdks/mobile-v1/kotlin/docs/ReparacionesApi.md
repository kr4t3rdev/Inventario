# ReparacionesApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetReparacionesById**](ReparacionesApi.md#mobileGetReparacionesById) | **GET** /reparaciones/{id} | Detalle de orden de reparación |
| [**mobileListReparaciones**](ReparacionesApi.md#mobileListReparaciones) | **GET** /reparaciones | Listar órdenes de reparación |


<a id="mobileGetReparacionesById"></a>
# **mobileGetReparacionesById**
> GetReparacionesDetailResponse mobileGetReparacionesById(id)

Detalle de orden de reparación

Devuelve el detalle de una orden de reparación.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ReparacionesApi()
val id : kotlin.String = id_example // kotlin.String | 
try {
    val result : GetReparacionesDetailResponse = apiInstance.mobileGetReparacionesById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ReparacionesApi#mobileGetReparacionesById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ReparacionesApi#mobileGetReparacionesById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**|  | |

### Return type

[**GetReparacionesDetailResponse**](GetReparacionesDetailResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileListReparaciones"></a>
# **mobileListReparaciones**
> GetReparacionesListResponse mobileListReparaciones()

Listar órdenes de reparación

Devuelve el listado de órdenes de reparación del tenant.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ReparacionesApi()
try {
    val result : GetReparacionesListResponse = apiInstance.mobileListReparaciones()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ReparacionesApi#mobileListReparaciones")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ReparacionesApi#mobileListReparaciones")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetReparacionesListResponse**](GetReparacionesListResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

