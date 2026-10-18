# PuntosVentaApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetPuntoVentaById**](PuntosVentaApi.md#mobileGetPuntoVentaById) | **GET** /puntos-venta/{id} | Detalle de punto de venta |
| [**mobileListPuntosVenta**](PuntosVentaApi.md#mobileListPuntosVenta) | **GET** /puntos-venta | Listar puntos de venta |


<a id="mobileGetPuntoVentaById"></a>
# **mobileGetPuntoVentaById**
> GetPuntosVentaDetailResponse mobileGetPuntoVentaById(id)

Detalle de punto de venta

Detalle de un punto de venta.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = PuntosVentaApi()
val id : kotlin.String = id_example // kotlin.String | 
try {
    val result : GetPuntosVentaDetailResponse = apiInstance.mobileGetPuntoVentaById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling PuntosVentaApi#mobileGetPuntoVentaById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling PuntosVentaApi#mobileGetPuntoVentaById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**|  | |

### Return type

[**GetPuntosVentaDetailResponse**](GetPuntosVentaDetailResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileListPuntosVenta"></a>
# **mobileListPuntosVenta**
> GetPuntosVentaListResponse mobileListPuntosVenta()

Listar puntos de venta

Puntos de venta del tenant.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = PuntosVentaApi()
try {
    val result : GetPuntosVentaListResponse = apiInstance.mobileListPuntosVenta()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling PuntosVentaApi#mobileListPuntosVenta")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling PuntosVentaApi#mobileListPuntosVenta")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetPuntosVentaListResponse**](GetPuntosVentaListResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

