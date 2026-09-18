# ProvidersApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
| ------------- | ------------- | ------------- |
| [**mobileDeleteProvidersById**](ProvidersApi.md#mobileDeleteProvidersById) | **DELETE** /providers/{id} | Eliminar proveedor |
| [**mobileGetProviders**](ProvidersApi.md#mobileGetProviders) | **GET** /providers | Listar proveedores |
| [**mobileGetProvidersById**](ProvidersApi.md#mobileGetProvidersById) | **GET** /providers/{id} | Consultar proveedor |
| [**mobilePostProvidersCreate**](ProvidersApi.md#mobilePostProvidersCreate) | **POST** /providers/create | Crear proveedor |
| [**mobilePutProvidersById**](ProvidersApi.md#mobilePutProvidersById) | **PUT** /providers/{id} | Editar proveedor |


<a id="mobileDeleteProvidersById"></a>
# **mobileDeleteProvidersById**
> ProveedorDeleteResponse mobileDeleteProvidersById(id)

Eliminar proveedor

Elimina un proveedor del tenant activo y devuelve la confirmación.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ProvidersApi()
val id : kotlin.String = id_example // kotlin.String | Identificador del proveedor.
try {
    val result : ProveedorDeleteResponse = apiInstance.mobileDeleteProvidersById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ProvidersApi#mobileDeleteProvidersById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ProvidersApi#mobileDeleteProvidersById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**| Identificador del proveedor. | |

### Return type

[**ProveedorDeleteResponse**](ProveedorDeleteResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetProviders"></a>
# **mobileGetProviders**
> ProveedorListResponse mobileGetProviders()

Listar proveedores

Devuelve los proveedores del tenant activo ordenados por creación descendente.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ProvidersApi()
try {
    val result : ProveedorListResponse = apiInstance.mobileGetProviders()
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ProvidersApi#mobileGetProviders")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ProvidersApi#mobileGetProviders")
    e.printStackTrace()
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**ProveedorListResponse**](ProveedorListResponse.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobileGetProvidersById"></a>
# **mobileGetProvidersById**
> Proveedor mobileGetProvidersById(id)

Consultar proveedor

Devuelve el detalle de un proveedor del tenant activo.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ProvidersApi()
val id : kotlin.String = id_example // kotlin.String | Identificador del proveedor.
try {
    val result : Proveedor = apiInstance.mobileGetProvidersById(id)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ProvidersApi#mobileGetProvidersById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ProvidersApi#mobileGetProvidersById")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **id** | **kotlin.String**| Identificador del proveedor. | |

### Return type

[**Proveedor**](Proveedor.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

<a id="mobilePostProvidersCreate"></a>
# **mobilePostProvidersCreate**
> Proveedor mobilePostProvidersCreate(proveedorCreateRequest)

Crear proveedor

Crea un proveedor en el tenant activo y devuelve el registro creado.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ProvidersApi()
val proveedorCreateRequest : ProveedorCreateRequest =  // ProveedorCreateRequest | 
try {
    val result : Proveedor = apiInstance.mobilePostProvidersCreate(proveedorCreateRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ProvidersApi#mobilePostProvidersCreate")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ProvidersApi#mobilePostProvidersCreate")
    e.printStackTrace()
}
```

### Parameters
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **proveedorCreateRequest** | [**ProveedorCreateRequest**](ProveedorCreateRequest.md)|  | |

### Return type

[**Proveedor**](Proveedor.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

<a id="mobilePutProvidersById"></a>
# **mobilePutProvidersById**
> Proveedor mobilePutProvidersById(id, proveedorUpdateRequest)

Editar proveedor

Actualiza los datos de un proveedor del tenant activo y devuelve el registro actualizado.

### Example
```kotlin
// Import classes:
//import com.tcp.mobile.v1.infrastructure.*
//import com.tcp.mobile.v1.models.*

val apiInstance = ProvidersApi()
val id : kotlin.String = id_example // kotlin.String | Identificador del proveedor.
val proveedorUpdateRequest : ProveedorUpdateRequest =  // ProveedorUpdateRequest | 
try {
    val result : Proveedor = apiInstance.mobilePutProvidersById(id, proveedorUpdateRequest)
    println(result)
} catch (e: ClientException) {
    println("4xx response calling ProvidersApi#mobilePutProvidersById")
    e.printStackTrace()
} catch (e: ServerException) {
    println("5xx response calling ProvidersApi#mobilePutProvidersById")
    e.printStackTrace()
}
```

### Parameters
| **id** | **kotlin.String**| Identificador del proveedor. | |
| Name | Type | Description  | Notes |
| ------------- | ------------- | ------------- | ------------- |
| **proveedorUpdateRequest** | [**ProveedorUpdateRequest**](ProveedorUpdateRequest.md)|  | |

### Return type

[**Proveedor**](Proveedor.md)

### Authorization


Configure bearerAuth:
    ApiClient.accessToken = ""

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

