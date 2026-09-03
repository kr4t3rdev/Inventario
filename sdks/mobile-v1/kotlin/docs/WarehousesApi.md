# WarehousesApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileDeleteWarehousesById**](WarehousesApi.md#mobileDeleteWarehousesById) | **DELETE** /warehouses/{id} | Eliminar almacén |
| [**mobileGetWarehouses**](WarehousesApi.md#mobileGetWarehouses) | **GET** /warehouses | Listar almacenes |
| [**mobileGetWarehousesById**](WarehousesApi.md#mobileGetWarehousesById) | **GET** /warehouses/{id} | Consultar almacén |
| [**mobilePostWarehousesCreate**](WarehousesApi.md#mobilePostWarehousesCreate) | **POST** /warehouses/create | Crear almacén |
| [**mobilePutWarehousesById**](WarehousesApi.md#mobilePutWarehousesById) | **PUT** /warehouses/{id} | Editar almacén |


<a id="mobileDeleteWarehousesById"></a>
# **mobileDeleteWarehousesById**
> AlmacenDeleteResponse mobileDeleteWarehousesById(id)

Eliminar almacén

Elimina un almacén del tenant activo y devuelve la confirmación.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = WarehousesApi()
val id : kotlin.String = id_example // kotlin.String | Identificador del almacén.
try {
    val result : AlmacenDeleteResponse = apiInstance.mobileDeleteWarehousesById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling WarehousesApi#mobileDeleteWarehousesById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling WarehousesApi#mobileDeleteWarehousesById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**| Identificador del almacén. | |

### Return type

[**AlmacenDeleteResponse**](AlmacenDeleteResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetWarehouses"></a>
# **mobileGetWarehouses**
> AlmacenListResponse mobileGetWarehouses()

Listar almacenes

Devuelve los almacenes del tenant activo ordenados por nombre ascendente.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = WarehousesApi()
try {
    val result : AlmacenListResponse = apiInstance.mobileGetWarehouses()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling WarehousesApi#mobileGetWarehouses")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling WarehousesApi#mobileGetWarehouses")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**AlmacenListResponse**](AlmacenListResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetWarehousesById"></a>
# **mobileGetWarehousesById**
> Almacen mobileGetWarehousesById(id)

Consultar almacén

Devuelve el detalle de un almacén del tenant activo.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = WarehousesApi()
val id : kotlin.String = id_example // kotlin.String | Identificador del almacén.
try {
    val result : Almacen = apiInstance.mobileGetWarehousesById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling WarehousesApi#mobileGetWarehousesById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling WarehousesApi#mobileGetWarehousesById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**| Identificador del almacén. | |

### Return type

[**Almacen**](Almacen.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobilePostWarehousesCreate"></a>
# **mobilePostWarehousesCreate**
> Almacen mobilePostWarehousesCreate(almacenCreateRequest)

Crear almacén

Crea un almacén en el tenant activo y devuelve el registro creado.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = WarehousesApi()
val almacenCreateRequest : AlmacenCreateRequest =  // AlmacenCreateRequest | 
try {
    val result : Almacen = apiInstance.mobilePostWarehousesCreate(almacenCreateRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling WarehousesApi#mobilePostWarehousesCreate")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling WarehousesApi#mobilePostWarehousesCreate")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **almacenCreateRequest** | [**AlmacenCreateRequest**](AlmacenCreateRequest.md)|  | |

### Return type

[**Almacen**](Almacen.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePutWarehousesById"></a>
# **mobilePutWarehousesById**
> Almacen mobilePutWarehousesById(id, almacenUpdateRequest)

Editar almacén

Actualiza los datos de un almacén del tenant activo y devuelve el registro actualizado.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = WarehousesApi()
val id : kotlin.String = id_example // kotlin.String | Identificador del almacén.
val almacenUpdateRequest : AlmacenUpdateRequest =  // AlmacenUpdateRequest | 
try {
    val result : Almacen = apiInstance.mobilePutWarehousesById(id, almacenUpdateRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling WarehousesApi#mobilePutWarehousesById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling WarehousesApi#mobilePutWarehousesById")
    e.printStackTrace()
}
```

### Parameters
| **id** | **kotlin.String**| Identificador del almacén. | |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **almacenUpdateRequest** | [**AlmacenUpdateRequest**](AlmacenUpdateRequest.md)|  | |

### Return type

[**Almacen**](Almacen.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

