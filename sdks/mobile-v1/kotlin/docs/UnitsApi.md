# UnitsApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileCreateUnit**](UnitsApi.md#mobileCreateUnit) | **POST** /units/create | Crear unidad |
| [**mobileDeleteUnit**](UnitsApi.md#mobileDeleteUnit) | **DELETE** /units/{id} | Eliminar unidad |
| [**mobileListUnits**](UnitsApi.md#mobileListUnits) | **GET** /units | Listar unidades |
| [**mobileUpdateUnit**](UnitsApi.md#mobileUpdateUnit) | **PUT** /units/{id} | Actualizar unidad |


<a id="mobileCreateUnit"></a>
# **mobileCreateUnit**
> GetUnitsDetailResponse mobileCreateUnit(mobileCreateUnitRequest)

Crear unidad

Crea una nueva unidad de medida.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = UnitsApi()
val mobileCreateUnitRequest : MobileCreateUnitRequest =  // MobileCreateUnitRequest | 
try {
    val result : GetUnitsDetailResponse = apiInstance.mobileCreateUnit(mobileCreateUnitRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling UnitsApi#mobileCreateUnit")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling UnitsApi#mobileCreateUnit")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **mobileCreateUnitRequest** | [**MobileCreateUnitRequest**](MobileCreateUnitRequest.md)|  | |

### Return type

[**GetUnitsDetailResponse**](GetUnitsDetailResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobileDeleteUnit"></a>
# **mobileDeleteUnit**
> DeleteUnitResponse mobileDeleteUnit(id)

Eliminar unidad

Elimina una unidad de medida.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = UnitsApi()
val id : kotlin.String = id_example // kotlin.String | 
try {
    val result : DeleteUnitResponse = apiInstance.mobileDeleteUnit(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling UnitsApi#mobileDeleteUnit")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling UnitsApi#mobileDeleteUnit")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**|  | |

### Return type

[**DeleteUnitResponse**](DeleteUnitResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileListUnits"></a>
# **mobileListUnits**
> GetUnitsListResponse mobileListUnits()

Listar unidades

Devuelve las unidades de medida del tenant.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = UnitsApi()
try {
    val result : GetUnitsListResponse = apiInstance.mobileListUnits()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling UnitsApi#mobileListUnits")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling UnitsApi#mobileListUnits")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**GetUnitsListResponse**](GetUnitsListResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileUpdateUnit"></a>
# **mobileUpdateUnit**
> GetUnitsDetailResponse mobileUpdateUnit(id, mobileUpdateUnitRequest)

Actualizar unidad

Actualiza una unidad de medida.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = UnitsApi()
val id : kotlin.String = id_example // kotlin.String | 
val mobileUpdateUnitRequest : MobileUpdateUnitRequest =  // MobileUpdateUnitRequest | 
try {
    val result : GetUnitsDetailResponse = apiInstance.mobileUpdateUnit(id, mobileUpdateUnitRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling UnitsApi#mobileUpdateUnit")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling UnitsApi#mobileUpdateUnit")
    e.printStackTrace()
}
```

### Parameters
| **id** | **kotlin.String**|  | |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **mobileUpdateUnitRequest** | [**MobileUpdateUnitRequest**](MobileUpdateUnitRequest.md)|  | |

### Return type

[**GetUnitsDetailResponse**](GetUnitsDetailResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

