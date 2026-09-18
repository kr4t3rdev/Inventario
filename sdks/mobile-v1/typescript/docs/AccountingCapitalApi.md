# AccountingCapitalApi

All URIs are relative to */api/mobile/v1*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mobileGetAccountingCapitalInjections**](AccountingCapitalApi.md#mobilegetaccountingcapitalinjections) | **GET** /accounting/capital-injections | Consultar inyecciones de capital |
| [**mobilePostAccountingCapitalInjections**](AccountingCapitalApi.md#mobilepostaccountingcapitalinjections) | **POST** /accounting/capital-injections | Registrar inyecciones de capital |
| [**mobilePostAccountingCapitalInjectionsByIdPayments**](AccountingCapitalApi.md#mobilepostaccountingcapitalinjectionsbyidpayments) | **POST** /accounting/capital-injections/{id}/payments | Registrar pago de inyecciones de capital |



## mobileGetAccountingCapitalInjections

> GetAccountingCapitalInjectionsResponse mobileGetAccountingCapitalInjections(tipo)

Consultar inyecciones de capital

Lista aportes de capital registrados para el tenant. Permite precisar la consulta mediante tipo.

### Example

```ts
import {
  Configuration,
  AccountingCapitalApi,
} from '@tcp/mobile-v1-sdk';
import type { MobileGetAccountingCapitalInjectionsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingCapitalApi(config);

  const body = {
    // string | Tipo de registro solicitado. (optional)
    tipo: tipo_example,
  } satisfies MobileGetAccountingCapitalInjectionsRequest;

  try {
    const data = await api.mobileGetAccountingCapitalInjections(body);
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
| **tipo** | `string` | Tipo de registro solicitado. | [Optional] [Defaults to `undefined`] |

### Return type

[**GetAccountingCapitalInjectionsResponse**](GetAccountingCapitalInjectionsResponse.md)

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


## mobilePostAccountingCapitalInjections

> PostAccountingCapitalInjectionsResponse mobilePostAccountingCapitalInjections(capitalInjectionCreateRequest, tipo)

Registrar inyecciones de capital

Registra un aporte de capital y lo vincula con la cuenta bancaria indicada cuando corresponde.

### Example

```ts
import {
  Configuration,
  AccountingCapitalApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostAccountingCapitalInjectionsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingCapitalApi(config);

  const body = {
    // CapitalInjectionCreateRequest
    capitalInjectionCreateRequest: ...,
    // string | Tipo de registro solicitado. (optional)
    tipo: tipo_example,
  } satisfies MobilePostAccountingCapitalInjectionsRequest;

  try {
    const data = await api.mobilePostAccountingCapitalInjections(body);
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
| **capitalInjectionCreateRequest** | [CapitalInjectionCreateRequest](CapitalInjectionCreateRequest.md) |  | |
| **tipo** | `string` | Tipo de registro solicitado. | [Optional] [Defaults to `undefined`] |

### Return type

[**PostAccountingCapitalInjectionsResponse**](PostAccountingCapitalInjectionsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mobilePostAccountingCapitalInjectionsByIdPayments

> PostAccountingCapitalInjectionsIdPaymentsResponse mobilePostAccountingCapitalInjectionsByIdPayments(id, capitalPaymentRequest)

Registrar pago de inyecciones de capital

Aplica un pago al saldo pendiente y registra sus efectos bancarios y contables.

### Example

```ts
import {
  Configuration,
  AccountingCapitalApi,
} from '@tcp/mobile-v1-sdk';
import type { MobilePostAccountingCapitalInjectionsByIdPaymentsRequest } from '@tcp/mobile-v1-sdk';

async function example() {
  console.log("🚀 Testing @tcp/mobile-v1-sdk SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AccountingCapitalApi(config);

  const body = {
    // string | Identificador único del recurso.
    id: id_example,
    // CapitalPaymentRequest
    capitalPaymentRequest: ...,
  } satisfies MobilePostAccountingCapitalInjectionsByIdPaymentsRequest;

  try {
    const data = await api.mobilePostAccountingCapitalInjectionsByIdPayments(body);
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
| **id** | `string` | Identificador único del recurso. | [Defaults to `undefined`] |
| **capitalPaymentRequest** | [CapitalPaymentRequest](CapitalPaymentRequest.md) |  | |

### Return type

[**PostAccountingCapitalInjectionsIdPaymentsResponse**](PostAccountingCapitalInjectionsIdPaymentsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Operación completada |  -  |
| **400** | Solicitud inválida |  -  |
| **401** | No autenticado |  -  |
| **500** | Error interno |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

