
# PutAccountingAdvancesIdResponse

Respuesta de PUT /accounting/advances/{id}.

## Properties

Name | Type
------------ | -------------
`anticipo` | [Advance](Advance.md)

## Example

```typescript
import type { PutAccountingAdvancesIdResponse } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "anticipo": null,
} satisfies PutAccountingAdvancesIdResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PutAccountingAdvancesIdResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


