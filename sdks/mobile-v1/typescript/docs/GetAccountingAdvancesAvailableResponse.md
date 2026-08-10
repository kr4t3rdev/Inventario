
# GetAccountingAdvancesAvailableResponse

Respuesta de GET /accounting/advances/available.

## Properties

Name | Type
------------ | -------------
`anticipos` | [Array&lt;Advance&gt;](Advance.md)

## Example

```typescript
import type { GetAccountingAdvancesAvailableResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "anticipos": null,
} satisfies GetAccountingAdvancesAvailableResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GetAccountingAdvancesAvailableResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


