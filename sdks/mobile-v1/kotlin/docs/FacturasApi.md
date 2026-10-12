# FacturasApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetFacturasById**](FacturasApi.md#mobileGetFacturasById) | **GET** /facturas/{id} | Detalle de factura |
| [**mobileListFacturas**](FacturasApi.md#mobileListFacturas) | **GET** /facturas | Listar facturas |


<a id="mobileGetFacturasById"></a>
# **mobileGetFacturasById**
> GetFacturasDetailResponse mobileGetFacturasById(id)

Detalle de factura

Devuelve el detalle de una factura.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = FacturasApi()
val id : kotlin.String = id_example // kotlin.String | 
try {
    val result : GetFacturasDetailResponse = apiInstance.mobileGetFacturasById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling FacturasApi#mobileGetFacturasById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling FacturasApi#mobileGetFacturasById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**|  | |

### Return type

[**GetFacturasDetailResponse**](GetFacturasDetailResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileListFacturas"></a>
# **mobileListFacturas**
> GetFacturasListResponse mobileListFacturas()

Listar facturas

Devuelve el listado de facturas del tenant.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = FacturasApi()
try {
    val result : GetFacturasListResponse = apiInstance.mobileListFacturas()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling FacturasApi#mobileListFacturas")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling FacturasApi#mobileListFacturas")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetFacturasListResponse**](GetFacturasListResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

