# Matriz final de endpoints mobile

Esta matriz se genera desde las rutas reales de `src/app/api/mobile/v1`. Incluye las operaciones HTTP disponibles, su estado, el test asociado y el perfil de dependencias necesario para consumirlas desde cualquier cliente mobile.

## Lectura rápida

- **Operaciones detectadas:** 84
- **Operaciones con test asociado:** 84
- **Operaciones sin test localizado:** 0
- **Autenticación:** Bearer JWT con refresh y cambio de tenant.
- **Formato principal:** JSON; los comprobantes usan PDF.

## Perfiles de dependencias

| Perfil | Uso | Requisitos del cliente |
|---|---|---|
| `A1` | Inicio de sesión | HTTPS, JSON, almacenamiento seguro, persistencia del access/refresh token. |
| `A2` | Renovación de sesión | HTTPS, refresh token, rotación atómica de tokens, prevención de solicitudes concurrentes de refresh. |
| `A3` | Tenant | Bearer token, tenant activo, sustitución segura del par de tokens al cambiar de tenant. |
| `R1` | Lectura protegida | HTTPS, Bearer token, serialización de query params, decodificación JSON, estados loading/error. |
| `M1` | Mutación protegida | Todo `R1`, body JSON, validación local, idempotencia/reintentos controlados y mapeo de errores de negocio. |
| `F1` | Archivo PDF | Bearer token, descarga blob/stream, almacenamiento temporal, visor PDF o share sheet. |

## Dependencias recomendadas por plataforma

| Plataforma | HTTP/JSON | Almacenamiento seguro | Archivos PDF |
|---|---|---|---|
| React Native | `fetch` o Axios | `expo-secure-store` o `react-native-keychain` | `expo-file-system` + `expo-sharing`, o equivalentes nativos |
| Flutter | `dio` o `http` | `flutter_secure_storage` | `path_provider` + `share_plus`/`open_filex` |
| Swift | `URLSession` + `Codable` | Keychain Services | `URLSessionDownloadTask` + Quick Look/ShareLink |
| Kotlin | Ktor Client o Retrofit + Kotlin Serialization | Android Keystore/EncryptedSharedPreferences | DownloadManager/FileProvider + visor del sistema |

> Las bibliotecas son opciones de integración, no dependencias del backend. La identidad y el tenant siempre deben derivarse del token emitido por el servidor.

## Matriz

| Método | Ruta | Estado | Test asociado | Perfil |
|---|---|---|---|---|
| `GET` | `/api/mobile/v1/accounting/accounts-payable` | Implementado | `src/app/api/mobile/v1/accounting/accounts-payable/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/accounts-receivable/metrics` | Implementado | `src/app/api/mobile/v1/accounting/accounts-receivable/metrics/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/accounts-receivable` | Implementado | `src/app/api/mobile/v1/accounting/accounts-receivable/__tests__/route.test.ts` | `R1` |
| `POST` | `/api/mobile/v1/accounting/advances/:id/ejecutar` | Implementado | `src/app/api/mobile/v1/accounting/advances/[id]/ejecutar/__tests__/route.test.ts` | `M1` |
| `POST` | `/api/mobile/v1/accounting/advances/:id/revertir` | Implementado | `src/app/api/mobile/v1/accounting/advances/[id]/revertir/__tests__/route.test.ts` | `M1` |
| `GET` | `/api/mobile/v1/accounting/advances/:id` | Implementado | `src/app/api/mobile/v1/accounting/advances/[id]/__tests__/route.test.ts` | `R1` |
| `PUT` | `/api/mobile/v1/accounting/advances/:id` | Implementado | `src/app/api/mobile/v1/accounting/advances/[id]/__tests__/route.test.ts` | `M1` |
| `DELETE` | `/api/mobile/v1/accounting/advances/:id` | Implementado | `src/app/api/mobile/v1/accounting/advances/[id]/__tests__/route.test.ts` | `M1` |
| `GET` | `/api/mobile/v1/accounting/advances/available` | Implementado | `src/app/api/mobile/v1/accounting/advances/available/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/advances/reports/customers` | Implementado | `src/app/api/mobile/v1/accounting/advances/reports/customers/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/advances/reports/providers` | Implementado | `src/app/api/mobile/v1/accounting/advances/reports/providers/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/advances/reports/summary` | Implementado | `src/app/api/mobile/v1/accounting/advances/reports/summary/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/advances` | Implementado | `src/app/api/mobile/v1/accounting/advances/__tests__/route.test.ts` | `R1` |
| `POST` | `/api/mobile/v1/accounting/advances` | Implementado | `src/app/api/mobile/v1/accounting/advances/__tests__/route.test.ts` | `M1` |
| `GET` | `/api/mobile/v1/accounting/bank-accounts/:id/history` | Implementado | `src/app/api/mobile/v1/accounting/bank-accounts/[id]/history/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/bank-accounts/:id` | Implementado | `src/app/api/mobile/v1/accounting/bank-accounts/[id]/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/bank-accounts` | Implementado | `src/app/api/mobile/v1/accounting/bank-accounts/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/bank-adjustments` | Implementado | `src/app/api/mobile/v1/accounting/bank-adjustments/__tests__/route.test.ts` | `R1` |
| `POST` | `/api/mobile/v1/accounting/bank-adjustments` | Implementado | `src/app/api/mobile/v1/accounting/bank-adjustments/__tests__/route.test.ts` | `M1` |
| `GET` | `/api/mobile/v1/accounting/bank-transfers/:id/comprobante` | Implementado | `src/app/api/mobile/v1/accounting/bank-transfers/[id]/comprobante/__tests__/route.test.ts` | `F1` |
| `GET` | `/api/mobile/v1/accounting/bank-transfers/:id` | Implementado | `src/app/api/mobile/v1/accounting/bank-transfers/[id]/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/bank-transfers` | Implementado | `src/app/api/mobile/v1/accounting/bank-transfers/__tests__/route.test.ts` | `R1` |
| `POST` | `/api/mobile/v1/accounting/bank-transfers` | Implementado | `src/app/api/mobile/v1/accounting/bank-transfers/__tests__/route.test.ts` | `M1` |
| `POST` | `/api/mobile/v1/accounting/bank-transfers/validate` | Implementado | `src/app/api/mobile/v1/accounting/bank-transfers/validate/__tests__/route.test.ts` | `M1` |
| `POST` | `/api/mobile/v1/accounting/capital-injections/:id/payments` | Implementado | `src/app/api/mobile/v1/accounting/capital-injections/[id]/payments/__tests__/route.test.ts` | `M1` |
| `GET` | `/api/mobile/v1/accounting/capital-injections` | Implementado | `src/app/api/mobile/v1/accounting/capital-injections/__tests__/route.test.ts` | `R1` |
| `POST` | `/api/mobile/v1/accounting/capital-injections` | Implementado | `src/app/api/mobile/v1/accounting/capital-injections/__tests__/route.test.ts` | `M1` |
| `POST` | `/api/mobile/v1/accounting/cash-debts/:id/payments` | Implementado | `src/app/api/mobile/v1/accounting/cash-debts/[id]/payments/__tests__/route.test.ts` | `M1` |
| `GET` | `/api/mobile/v1/accounting/cash-debts/:id` | Implementado | `src/app/api/mobile/v1/accounting/cash-debts/[id]/__tests__/mutations.test.ts` | `R1` |
| `PUT` | `/api/mobile/v1/accounting/cash-debts/:id` | Implementado | `src/app/api/mobile/v1/accounting/cash-debts/[id]/__tests__/mutations.test.ts` | `M1` |
| `GET` | `/api/mobile/v1/accounting/cash-debts` | Implementado | `src/app/api/mobile/v1/accounting/cash-debts/__tests__/mutations.test.ts` | `R1` |
| `POST` | `/api/mobile/v1/accounting/cash-debts` | Implementado | `src/app/api/mobile/v1/accounting/cash-debts/__tests__/mutations.test.ts` | `M1` |
| `GET` | `/api/mobile/v1/accounting/cash-debts/stats` | Implementado | `src/app/api/mobile/v1/accounting/cash-debts/stats/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/cash-loans/:id/comprobante` | Implementado | `src/app/api/mobile/v1/accounting/cash-loans/[id]/comprobante/__tests__/route.test.ts` | `F1` |
| `GET` | `/api/mobile/v1/accounting/cash-loans/:id/history` | Implementado | `src/app/api/mobile/v1/accounting/cash-loans/[id]/history/__tests__/route.test.ts` | `R1` |
| `POST` | `/api/mobile/v1/accounting/cash-loans/:id/payments` | Implementado | `src/app/api/mobile/v1/accounting/cash-loans/[id]/payments/__tests__/route.test.ts` | `M1` |
| `GET` | `/api/mobile/v1/accounting/cash-loans/:id` | Implementado | `src/app/api/mobile/v1/accounting/cash-loans/[id]/__tests__/mutations.test.ts` | `R1` |
| `PUT` | `/api/mobile/v1/accounting/cash-loans/:id` | Implementado | `src/app/api/mobile/v1/accounting/cash-loans/[id]/__tests__/mutations.test.ts` | `M1` |
| `GET` | `/api/mobile/v1/accounting/cash-loans` | Implementado | `src/app/api/mobile/v1/accounting/cash-loans/__tests__/mutations.test.ts` | `R1` |
| `POST` | `/api/mobile/v1/accounting/cash-loans` | Implementado | `src/app/api/mobile/v1/accounting/cash-loans/__tests__/mutations.test.ts` | `M1` |
| `GET` | `/api/mobile/v1/accounting/cash-loans/stats` | Implementado | `src/app/api/mobile/v1/accounting/cash-loans/stats/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/exchange/monedas` | Implementado | `src/app/api/mobile/v1/accounting/exchange/monedas/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/exchange/tasas` | Implementado | `src/app/api/mobile/v1/accounting/exchange/tasas/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/logs` | Implementado | `src/app/api/mobile/v1/accounting/logs/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/payment-types/:id` | Implementado | `src/app/api/mobile/v1/accounting/payment-types/[id]/__tests__/route.test.ts` | `R1` |
| `PUT` | `/api/mobile/v1/accounting/payment-types/:id` | Implementado | `src/app/api/mobile/v1/accounting/payment-types/[id]/__tests__/route.test.ts` | `M1` |
| `DELETE` | `/api/mobile/v1/accounting/payment-types/:id` | Implementado | `src/app/api/mobile/v1/accounting/payment-types/[id]/__tests__/route.test.ts` | `M1` |
| `GET` | `/api/mobile/v1/accounting/payment-types/available-accounts` | Implementado | `src/app/api/mobile/v1/accounting/payment-types/available-accounts/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/payment-types` | Implementado | `src/app/api/mobile/v1/accounting/payment-types/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/reconciliation/expenses/history` | Implementado | `src/app/api/mobile/v1/accounting/reconciliation/expenses/history/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/reconciliation/expenses` | Implementado | `src/app/api/mobile/v1/accounting/reconciliation/expenses/__tests__/route.test.ts` | `R1` |
| `POST` | `/api/mobile/v1/accounting/reconciliation/expenses` | Implementado | `src/app/api/mobile/v1/accounting/reconciliation/expenses/__tests__/route.test.ts` | `M1` |
| `GET` | `/api/mobile/v1/accounting/reconciliation/expenses-history` | Implementado | `src/app/api/mobile/v1/accounting/reconciliation/expenses-history/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/reconciliation/sales/history` | Implementado | `src/app/api/mobile/v1/accounting/reconciliation/sales/history/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/reconciliation/sales` | Implementado | `src/app/api/mobile/v1/accounting/reconciliation/sales/__tests__/route.test.ts` | `R1` |
| `POST` | `/api/mobile/v1/accounting/reconciliation/sales` | Implementado | `src/app/api/mobile/v1/accounting/reconciliation/sales/__tests__/route.test.ts` | `M1` |
| `GET` | `/api/mobile/v1/accounting/reconciliation/sales-history` | Implementado | `src/app/api/mobile/v1/accounting/reconciliation/sales-history/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/reconciliation/services/history` | Implementado | `src/app/api/mobile/v1/accounting/reconciliation/services/history/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/reconciliation/services` | Implementado | `src/app/api/mobile/v1/accounting/reconciliation/services/__tests__/route.test.ts` | `R1` |
| `POST` | `/api/mobile/v1/accounting/reconciliation/services` | Implementado | `src/app/api/mobile/v1/accounting/reconciliation/services/__tests__/route.test.ts` | `M1` |
| `GET` | `/api/mobile/v1/accounting/reconciliation/services-history` | Implementado | `src/app/api/mobile/v1/accounting/reconciliation/services-history/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/reconciliation/stats` | Implementado | `src/app/api/mobile/v1/accounting/reconciliation/stats/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/reports/client-account-analysis` | Implementado | `src/app/api/mobile/v1/accounting/reports/client-account-analysis/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/reports/exchange` | Implementado | `src/app/api/mobile/v1/accounting/reports/exchange/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/reports/exchange-impact` | Implementado | `src/app/api/mobile/v1/accounting/reports/exchange-impact/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/reports/movements` | Implementado | `src/app/api/mobile/v1/accounting/reports/movements/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/reports/overdue-invoices` | Implementado | `src/app/api/mobile/v1/accounting/reports/overdue-invoices/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/reports/summary` | Implementado | `src/app/api/mobile/v1/accounting/reports/summary/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/accounting/reports/transfers` | Implementado | `src/app/api/mobile/v1/accounting/reports/transfers/__tests__/route.test.ts` | `R1` |
| `POST` | `/api/mobile/v1/auth/login` | Implementado | `src/app/api/mobile/v1/auth/__tests__/routes.test.ts` | `A1` |
| `POST` | `/api/mobile/v1/auth/logout` | Implementado | `src/app/api/mobile/v1/auth/__tests__/routes.test.ts` | `M1` |
| `GET` | `/api/mobile/v1/auth/me` | Implementado | `src/app/api/mobile/v1/auth/__tests__/routes.test.ts` | `R1` |
| `POST` | `/api/mobile/v1/auth/refresh` | Implementado | `src/app/api/mobile/v1/auth/__tests__/routes.test.ts` | `A2` |
| `GET` | `/api/mobile/v1/auth/tenants` | Implementado | `src/app/api/mobile/v1/auth/__tests__/routes.test.ts` | `A3` |
| `POST` | `/api/mobile/v1/auth/tenants` | Implementado | `src/app/api/mobile/v1/auth/__tests__/routes.test.ts` | `A3` |
| `GET` | `/api/mobile/v1/dashboard/stats` | Implementado | `src/app/api/mobile/v1/dashboard/__tests__/stats.route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/products/:id` | Implementado | `src/app/api/mobile/v1/products/[id]/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/products` | Implementado | `src/app/api/mobile/v1/products/__tests__/route.test.ts` | `R1` |
| `GET` | `/api/mobile/v1/products/stock` | Implementado | `src/app/api/mobile/v1/products/stock/__tests__/route.test.ts` | `R1` |
| `POST` | `/api/mobile/v1/sales/:id/cancel` | Implementado | `src/app/api/mobile/v1/sales/[id]/cancel/__tests__/route.test.ts` | `M1` |
| `GET` | `/api/mobile/v1/sales/:id` | Implementado | `src/app/api/mobile/v1/sales/[id]/__tests__/route.test.ts` | `R1` |
| `PATCH` | `/api/mobile/v1/sales/:id/update` | Implementado | `src/app/api/mobile/v1/sales/[id]/update/__tests__/route.test.ts` | `M1` |
| `POST` | `/api/mobile/v1/sales/create` | Implementado | `src/app/api/mobile/v1/sales/create/__tests__/route.test.ts` | `M1` |
| `GET` | `/api/mobile/v1/sales` | Implementado | `src/app/api/mobile/v1/sales/__tests__/route.test.ts` | `R1` |

## Reglas transversales

1. Usar HTTPS en todos los ambientes remotos.
2. Enviar `Authorization: Bearer <accessToken>` en rutas protegidas.
3. Almacenar tokens únicamente en mecanismos seguros de cada plataforma.
4. Ante `401`, intentar un único refresh coordinado; si falla, cerrar la sesión.
5. No aceptar ni construir identidad de usuario desde parámetros enviados por el cliente.
6. No sumar importes en monedas diferentes sin conversión o agrupación por moneda.
7. Mapear los códigos `400`, `401`, `403`, `404` y `500` a estados de UI diferenciados.
