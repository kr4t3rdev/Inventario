
# ExchangeRate


## Properties

Name | Type
------------ | -------------
`tasaId` | string
`monedaOrigen` | string
`monedaDestino` | string
`tasa` | number
`fecha` | Date

## Example

```typescript
import type { ExchangeRate } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "tasaId": null,
  "monedaOrigen": null,
  "monedaDestino": null,
  "tasa": null,
  "fecha": null,
} satisfies ExchangeRate

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ExchangeRate
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


