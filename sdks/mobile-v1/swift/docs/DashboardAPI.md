# DashboardAPI

All URIs are relative to */api/mobile/v1*

Method | HTTP request | Description
------------- | ------------- | -------------
[**mobileGetDashboardStats**](DashboardAPI.md#mobilegetdashboardstats) | **GET** /dashboard/stats | Consultar indicadores del panel principal


# **mobileGetDashboardStats**
```swift
    open class func mobileGetDashboardStats(ubicacionId: String? = nil, tipoUbicacion: TipoUbicacion_mobileGetDashboardStats? = nil, completion: @escaping (_ data: GetDashboardStatsResponse?, _ error: Error?) -> Void)
```

Consultar indicadores del panel principal

Resume ventas, ingresos y alertas de inventario para una ubicación operativa. Permite precisar la consulta mediante ubicación, tipo de ubicación.

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import TCPMobileV1SDK

let ubicacionId = "ubicacionId_example" // String | Valor de ubicacionId aceptado por el handler. (optional)
let tipoUbicacion = "tipoUbicacion_example" // String | Valor de tipoUbicacion aceptado por el handler. (optional)

// Consultar indicadores del panel principal
DashboardAPI.mobileGetDashboardStats(ubicacionId: ubicacionId, tipoUbicacion: tipoUbicacion) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ubicacionId** | **String** | Valor de ubicacionId aceptado por el handler. | [optional] 
 **tipoUbicacion** | **String** | Valor de tipoUbicacion aceptado por el handler. | [optional] 

### Return type

[**GetDashboardStatsResponse**](GetDashboardStatsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

