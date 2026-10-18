# EmpleadosApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileGetEmpleadosById**](EmpleadosApi.md#mobileGetEmpleadosById) | **GET** /empleados/{id} | Detalle de empleado |
| [**mobileListEmpleados**](EmpleadosApi.md#mobileListEmpleados) | **GET** /empleados | Listar empleados |


<a id="mobileGetEmpleadosById"></a>
# **mobileGetEmpleadosById**
> GetEmpleadosDetailResponse mobileGetEmpleadosById(id)

Detalle de empleado

Devuelve el detalle de una empleado.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = EmpleadosApi()
val id : kotlin.String = id_example // kotlin.String | 
try {
    val result : GetEmpleadosDetailResponse = apiInstance.mobileGetEmpleadosById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling EmpleadosApi#mobileGetEmpleadosById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling EmpleadosApi#mobileGetEmpleadosById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**|  | |

### Return type

[**GetEmpleadosDetailResponse**](GetEmpleadosDetailResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileListEmpleados"></a>
# **mobileListEmpleados**
> GetEmpleadosListResponse mobileListEmpleados()

Listar empleados

Devuelve el listado de empleados del tenant.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = EmpleadosApi()
try {
    val result : GetEmpleadosListResponse = apiInstance.mobileListEmpleados()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling EmpleadosApi#mobileListEmpleados")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling EmpleadosApi#mobileListEmpleados")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetEmpleadosListResponse**](GetEmpleadosListResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

