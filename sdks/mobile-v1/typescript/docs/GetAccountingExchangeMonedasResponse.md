
# GetAccountingExchangeMonedasResponse

Respuesta de GET /accounting/exchange/monedas.

## Properties

Name | Type
------------ | -------------
`items` | [Array&lt;Currency&gt;](Currency.md)

## Example

```typescript
import type { GetAccountingExchangeMonedasResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "items": null,
} satisfies GetAccountingExchangeMonedasResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetAccountingExchangeMonedasResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


