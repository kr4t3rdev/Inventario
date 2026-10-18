# MermasApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetMermasById**](MermasApi.md#mobileGetMermasById) | **GET** /mermas/{id} | Detalle de merma |
| [**mobileListMermas**](MermasApi.md#mobileListMermas) | **GET** /mermas | Listar mermas |


<a id="mobileGetMermasById"></a>
# **mobileGetMermasById**
> GetMermasDetailResponse mobileGetMermasById(id)

Detalle de merma

Devuelve el detalle de una merma.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = MermasApi()
val id : kotlin.String = id_example // kotlin.String | 
try {
    val result : GetMermasDetailResponse = apiInstance.mobileGetMermasById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling MermasApi#mobileGetMermasById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling MermasApi#mobileGetMermasById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**|  | |

### Return type

[**GetMermasDetailResponse**](GetMermasDetailResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileListMermas"></a>
# **mobileListMermas**
> GetMermasListResponse mobileListMermas()

Listar mermas

Devuelve el listado de mermas del tenant.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = MermasApi()
try {
    val result : GetMermasListResponse = apiInstance.mobileListMermas()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling MermasApi#mobileListMermas")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling MermasApi#mobileListMermas")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetMermasListResponse**](GetMermasListResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

