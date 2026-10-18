# EmpleadosApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetEmpleadosById**](EmpleadosApi.md#mobilegetempleadosbyid) | **GET** /empleados/{id} | Detalle de empleado |
| [**mobileListEmpleados**](EmpleadosApi.md#mobilelistempleados) | **GET** /empleados | Listar empleados |



## mobileGetEmpleadosById

> GetEmpleadosDetailResponse mobileGetEmpleadosById(id)

Detalle de empleado

Devuelve el detalle de una empleado.

### Example

```ts
import {
  Configuration,
  EmpleadosApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetEmpleadosByIdRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new EmpleadosApi(config);

  const body = {
    // string
    id: id_example,
  } satisfies MobileGetEmpleadosByIdRequest;

  try {
    const data = await api.mobileGetEmpleadosById(body);
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
| **id** | `string` |  | [Defaults to `undefined`] |

### Return type

[**GetEmpleadosDetailResponse**](GetEmpleadosDetailResponse.md)

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
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileListEmpleados

> GetEmpleadosListResponse mobileListEmpleados()

Listar empleados

Devuelve el listado de empleados del tenant.

### Example

```ts
import {
  Configuration,
  EmpleadosApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileListEmpleadosRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new EmpleadosApi(config);

  try {
    const data = await api.mobileListEmpleados();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**GetEmpleadosListResponse**](GetEmpleadosListResponse.md)

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
| **404** | No encontrado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

