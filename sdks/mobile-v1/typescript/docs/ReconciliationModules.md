
# ReconciliationModules


## Properties

Name | Type
------------ | -------------
`ventas` | [ReconciliationModuleStats](ReconciliationModuleStats.md)
`servicios` | [ReconciliationModuleStats](ReconciliationModuleStats.md)
`gastos` | [ReconciliationModuleStats](ReconciliationModuleStats.md)

## Example

```typescript
import type { ReconciliationModules } from '@tcp/mobile-v1-sdk'

// TODO: Update the object below with actual values
const example = {
  "ventas": null,
  "servicios": null,
  "gastos": null,
} satisfies ReconciliationModules

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ReconciliationModules
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


