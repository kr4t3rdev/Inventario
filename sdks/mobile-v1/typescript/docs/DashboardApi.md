# DashboardApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetDashboardStats**](DashboardApi.md#mobilegetdashboardstats) | **GET** /dashboard/stats | Consultar indicadores del panel principal |



## mobileGetDashboardStats

> GetDashboardStatsResponse mobileGetDashboardStats(ubicacionId, tipoUbicacion)

Consultar indicadores del panel principal

Resume ventas, ingresos y alertas de inventario para una ubicación operativa. Permite precisar la consulta mediante ubicación, tipo de ubicación.

### Example

```ts
import {
  Configuration,
  DashboardApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetDashboardStatsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DashboardApi(config);

  const body = {
    // string | Valor de ubicacionId aceptado por el handler. (optional)
    ubicacionId: ubicacionId_example,
    // 'almacen' | 'punto_venta' | Valor de tipoUbicacion aceptado por el handler. (optional)
    tipoUbicacion: tipoUbicacion_example,
  } satisfies MobileGetDashboardStatsRequest;

  try {
    const data = await api.mobileGetDashboardStats(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **ubicacionId** | `string` | Valor de ubicacionId aceptado por el handler. | [Optional] [Defaults to `undefined`] |
| **tipoUbicacion** | `almacen`, `punto_venta` | Valor de tipoUbicacion aceptado por el handler. | [Optional] [Defaults to `undefined`] [Enum: almacen, punto_venta] |

### Return type

[**GetDashboardStatsResponse**](GetDashboardStatsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

