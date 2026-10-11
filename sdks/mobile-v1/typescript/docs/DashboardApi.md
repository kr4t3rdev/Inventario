# DashboardApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetDashboardDailyAverage**](DashboardApi.md#mobilegetdashboarddailyaverage) | **GET** /dashboard/daily-average | Consultar promedio diario de ingresos |
| [**mobileGetDashboardIncomeExpenses**](DashboardApi.md#mobilegetdashboardincomeexpenses) | **GET** /dashboard/income-expenses | Consultar ingresos vs gastos del panel |
| [**mobileGetDashboardInventoryValue**](DashboardApi.md#mobilegetdashboardinventoryvalue) | **GET** /dashboard/inventory-value | Consultar valor total del inventario |
| [**mobileGetDashboardLowStock**](DashboardApi.md#mobilegetdashboardlowstock) | **GET** /dashboard/low-stock | Consultar productos con stock bajo |
| [**mobileGetDashboardStats**](DashboardApi.md#mobilegetdashboardstats) | **GET** /dashboard/stats | Consultar indicadores del panel principal |
| [**mobileGetDashboardStockDistribution**](DashboardApi.md#mobilegetdashboardstockdistribution) | **GET** /dashboard/stock-distribution | Consultar distribución de stock |
| [**mobileGetDashboardTodaySales**](DashboardApi.md#mobilegetdashboardtodaysales) | **GET** /dashboard/today-sales | Consultar ventas de hoy |
| [**mobileGetDashboardTopProducts**](DashboardApi.md#mobilegetdashboardtopproducts) | **GET** /dashboard/top-products | Consultar productos más vendidos |
| [**mobileGetDashboardTransfers**](DashboardApi.md#mobilegetdashboardtransfers) | **GET** /dashboard/transfers | Consultar transferencias entre ubicaciones |



## mobileGetDashboardDailyAverage

> DashboardValueResponse mobileGetDashboardDailyAverage(ubicacionId, tipoUbicacion)

Consultar promedio diario de ingresos

Promedio de ingresos diarios (30 días).

### Example

```ts
import {
  Configuration,
  DashboardApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetDashboardDailyAverageRequest } from '@tcp/mobile-v1-sdk';

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
  } satisfies MobileGetDashboardDailyAverageRequest;

  try {
    const data = await api.mobileGetDashboardDailyAverage(body);
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

[**DashboardValueResponse**](DashboardValueResponse.md)

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


## mobileGetDashboardIncomeExpenses

> DashboardIncomeExpenseResponse mobileGetDashboardIncomeExpenses(ubicacionId, tipoUbicacion)

Consultar ingresos vs gastos del panel

Ingresos y gastos totales más la serie mensual para la gráfica del panel.

### Example

```ts
import {
  Configuration,
  DashboardApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetDashboardIncomeExpensesRequest } from '@tcp/mobile-v1-sdk';

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
  } satisfies MobileGetDashboardIncomeExpensesRequest;

  try {
    const data = await api.mobileGetDashboardIncomeExpenses(body);
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

[**DashboardIncomeExpenseResponse**](DashboardIncomeExpenseResponse.md)

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


## mobileGetDashboardInventoryValue

> DashboardValueResponse mobileGetDashboardInventoryValue(ubicacionId, tipoUbicacion)

Consultar valor total del inventario

Valor total del inventario en stock.

### Example

```ts
import {
  Configuration,
  DashboardApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetDashboardInventoryValueRequest } from '@tcp/mobile-v1-sdk';

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
  } satisfies MobileGetDashboardInventoryValueRequest;

  try {
    const data = await api.mobileGetDashboardInventoryValue(body);
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

[**DashboardValueResponse**](DashboardValueResponse.md)

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


## mobileGetDashboardLowStock

> DashboardLowStockResponse mobileGetDashboardLowStock(ubicacionId, tipoUbicacion)

Consultar productos con stock bajo

Productos con stock bajo o crítico (top 5).

### Example

```ts
import {
  Configuration,
  DashboardApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetDashboardLowStockRequest } from '@tcp/mobile-v1-sdk';

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
  } satisfies MobileGetDashboardLowStockRequest;

  try {
    const data = await api.mobileGetDashboardLowStock(body);
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

[**DashboardLowStockResponse**](DashboardLowStockResponse.md)

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


## mobileGetDashboardStockDistribution

> DashboardStockDistributionResponse mobileGetDashboardStockDistribution(ubicacionId, tipoUbicacion)

Consultar distribución de stock

Distribución de stock por categoría.

### Example

```ts
import {
  Configuration,
  DashboardApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetDashboardStockDistributionRequest } from '@tcp/mobile-v1-sdk';

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
  } satisfies MobileGetDashboardStockDistributionRequest;

  try {
    const data = await api.mobileGetDashboardStockDistribution(body);
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

[**DashboardStockDistributionResponse**](DashboardStockDistributionResponse.md)

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


## mobileGetDashboardTodaySales

> DashboardValueResponse mobileGetDashboardTodaySales(ubicacionId, tipoUbicacion)

Consultar ventas de hoy

Ingresos por ventas del día actual.

### Example

```ts
import {
  Configuration,
  DashboardApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetDashboardTodaySalesRequest } from '@tcp/mobile-v1-sdk';

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
  } satisfies MobileGetDashboardTodaySalesRequest;

  try {
    const data = await api.mobileGetDashboardTodaySales(body);
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

[**DashboardValueResponse**](DashboardValueResponse.md)

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


## mobileGetDashboardTopProducts

> DashboardTopProductsResponse mobileGetDashboardTopProducts(ubicacionId, tipoUbicacion)

Consultar productos más vendidos

Top 10 de productos más vendidos del período.

### Example

```ts
import {
  Configuration,
  DashboardApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetDashboardTopProductsRequest } from '@tcp/mobile-v1-sdk';

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
  } satisfies MobileGetDashboardTopProductsRequest;

  try {
    const data = await api.mobileGetDashboardTopProducts(body);
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

[**DashboardTopProductsResponse**](DashboardTopProductsResponse.md)

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


## mobileGetDashboardTransfers

> DashboardTransfersResponse mobileGetDashboardTransfers(ubicacionId, tipoUbicacion)

Consultar transferencias entre ubicaciones

Conteo de transferencias entre almacenes y puntos de venta.

### Example

```ts
import {
  Configuration,
  DashboardApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetDashboardTransfersRequest } from '@tcp/mobile-v1-sdk';

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
  } satisfies MobileGetDashboardTransfersRequest;

  try {
    const data = await api.mobileGetDashboardTransfers(body);
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

[**DashboardTransfersResponse**](DashboardTransfersResponse.md)

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

