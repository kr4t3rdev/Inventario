# AuthApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetAuthMe**](AuthApi.md#mobilegetauthme) | **GET** /auth/me | Consultar perfil autenticado |
| [**mobileGetAuthTenants**](AuthApi.md#mobilegetauthtenants) | **GET** /auth/tenants | Listar tenants accesibles |
| [**mobilePostAuthLogin**](AuthApi.md#mobilepostauthlogin) | **POST** /auth/login | Iniciar sesión móvil |
| [**mobilePostAuthLogout**](AuthApi.md#mobilepostauthlogout) | **POST** /auth/logout | Cerrar sesión actual |
| [**mobilePostAuthRefresh**](AuthApi.md#mobilepostauthrefresh) | **POST** /auth/refresh | Renovar tokens de sesión |
| [**mobilePostAuthTenants**](AuthApi.md#mobilepostauthtenants) | **POST** /auth/tenants | Cambiar tenant activo |



## mobileGetAuthMe

> AuthenticatedUser mobileGetAuthMe()

Consultar perfil autenticado

Devuelve la identidad, rol y contexto de tenant contenidos en la sesión Bearer vigente.

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAuthMeRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthApi(config);

  try {
    const data = await api.mobileGetAuthMe();
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

[**AuthenticatedUser**](AuthenticatedUser.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Contexto autenticado |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobileGetAuthTenants

> TenantListResponse mobileGetAuthTenants()

Listar tenants accesibles

Devuelve los tenants activos a los que pertenece el usuario autenticado.

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAuthTenantsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthApi(config);

  try {
    const data = await api.mobileGetAuthTenants();
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

[**TenantListResponse**](TenantListResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Tenants disponibles |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobilePostAuthLogin

> AuthSession mobilePostAuthLogin(loginRequest, xTenantId)

Iniciar sesión móvil

Valida las credenciales y entrega el usuario autenticado junto con los tokens de acceso y renovación.

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostAuthLoginRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const api = new AuthApi();

  const body = {
    // LoginRequest
    loginRequest: ...,
    // string | Tenant que se desea activar al iniciar sesión; si se omite, el servicio resuelve el contexto disponible. (optional)
    xTenantId: xTenantId_example,
  } satisfies MobilePostAuthLoginRequest;

  try {
    const data = await api.mobilePostAuthLogin(body);
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
| **loginRequest** | [LoginRequest](LoginRequest.md) |  | |
| **xTenantId** | `string` | Tenant que se desea activar al iniciar sesión; si se omite, el servicio resuelve el contexto disponible. | [Optional] [Defaults to `undefined`] |

### Return type

[**AuthSession**](AuthSession.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Sesión iniciada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobilePostAuthLogout

> SuccessResponse mobilePostAuthLogout()

Cerrar sesión actual

Invalida la sesión autenticada para impedir el uso posterior de sus credenciales de renovación.

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostAuthLogoutRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthApi(config);

  try {
    const data = await api.mobilePostAuthLogout();
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

[**SuccessResponse**](SuccessResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Sesión cerrada |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobilePostAuthRefresh

> TokenPair mobilePostAuthRefresh(refreshRequest)

Renovar tokens de sesión

Valida el token de renovación y emite un nuevo par de tokens para continuar la sesión.

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostAuthRefreshRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const api = new AuthApi();

  const body = {
    // RefreshRequest
    refreshRequest: ...,
  } satisfies MobilePostAuthRefreshRequest;

  try {
    const data = await api.mobilePostAuthRefresh(body);
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
| **refreshRequest** | [RefreshRequest](RefreshRequest.md) |  | |

### Return type

[**TokenPair**](TokenPair.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Tokens renovados |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobilePostAuthTenants

> SwitchTenantResponse mobilePostAuthTenants(switchTenantRequest)

Cambiar tenant activo

Cambia el contexto de tenant y entrega tokens nuevos asociados a la membresía seleccionada.

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostAuthTenantsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthApi(config);

  const body = {
    // SwitchTenantRequest
    switchTenantRequest: ...,
  } satisfies MobilePostAuthTenantsRequest;

  try {
    const data = await api.mobilePostAuthTenants(body);
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
| **switchTenantRequest** | [SwitchTenantRequest](SwitchTenantRequest.md) |  | |

### Return type

[**SwitchTenantResponse**](SwitchTenantResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Tenant activo actualizado |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **403** | No autorizado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

