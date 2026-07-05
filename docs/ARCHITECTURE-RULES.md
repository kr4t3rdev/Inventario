# Reglas de Frontera Arquitectónica

Este documento define **dónde vive cada responsabilidad** en FinanceMDM.  
Su objetivo es evitar que web, mobile e infraestructura arrastren lógica de negocio fuera de lugar y facilitar la evolución hacia **arquitectura hexagonal**.

---

## Quick path

1. Si el caso de uso es **solo web**, empieza evaluando **Server Action**.
2. Si el consumidor es **mobile, integración o webhook**, usa **Route Handler**.
3. Si la lógica sirve a más de un canal, **va a service / use case**, no al entrypoint.
4. Si el código habla directamente con Prisma, JWT, cookies o headers, preguntate si eso debería ser un **adapter**.

---

## Regla madre

> **Nada importante del negocio debería depender del canal de entrada.**

Dicho simple:

- web y mobile pueden entrar distinto,
- pero el negocio debería ejecutarse igual.

---

## Mapa de responsabilidades

| Pieza | Responsabilidad permitida | No debería hacer |
|------|----------------------------|------------------|
| React Component | render, interacción UI, estado visual | lógica de negocio real, acceso directo a Prisma |
| Hook de UI | composición de estado y UX | reglas de negocio core |
| Server Action | adapter web, auth web, validación, delegación a caso de uso | contener reglas compartidas con mobile |
| Route Handler | adapter HTTP, parseo request/response, auth API, delegación | lógica de negocio duplicada |
| Service / Use Case | reglas de aplicación y orquestación reutilizable | depender de Next.js, cookies, `Request`, `Response` |
| Repository / Port | contrato de acceso a datos | conocer UI o transporte |
| Prisma adapter | implementación concreta de persistencia | definir reglas del negocio |
| Auth adapter | resolver identidad/sesión/tenant | mezclar autorización de dominio con transporte |

---

## Regla 1 — Cuándo usar Server Actions

Usá **Server Action** cuando:

- el consumidor es la **app web**;
- el flujo está acoplado a App Router;
- no necesitás contrato HTTP reutilizable;
- la interacción es típicamente formulario, tabla, dashboard o mutation de UI.

### Ejemplos válidos

- guardar configuración desde una pantalla interna;
- crear/editar registros desde formularios web;
- cargar datos para una vista administrativa interna.

### No usar Server Action si…

- el mismo caso de uso será consumido por mobile;
- necesitás endpoint versionado;
- el consumidor está fuera de Next.js;
- el resultado depende de un contrato HTTP estable.

---

## Regla 2 — Cuándo usar Route Handlers

Usá **Route Handler** cuando:

- el consumidor es **mobile**;
- existe una **integración externa**;
- hay **webhooks**;
- hace falta un contrato HTTP público o versionado;
- el caso involucra archivos, callbacks o interoperabilidad explícita.

### Ejemplos válidos

- `/api/mobile/v1/**`
- autenticación para clientes no web;
- exportaciones consumidas desde fuera del cliente Next;
- endpoints de integración con terceros.

### Regla crítica

> Un Route Handler no debería “resolver el negocio”.  
> Debería traducir HTTP hacia un caso de uso o service reutilizable.

---

## Regla 3 — Cuándo extraer a Service / Use Case

Extraé a **service / use case** cuando se cumpla cualquiera de estas:

1. La lógica se usa en **web y mobile**.
2. El flujo tiene **más de una regla de negocio** real.
3. El caso toca **varias entidades** o coordina varias operaciones.
4. Hay validaciones de negocio que no pertenecen al transporte.
5. El código empieza a crecer más allá de una simple query/mutation.

### Señal roja

Si una Action o Route Handler:

- calcula,
- decide,
- compone varias consultas,
- valida reglas de dominio,
- o coordina varios pasos,

entonces probablemente **ya debería ser un use case**.

---

## Regla 4 — Dónde va la autenticación

La autenticación debe resolverse en una **capa reusable**, no duplicada por canal.

### Debe existir una única fuente de verdad para:

- validar JWT o sesión;
- resolver usuario activo;
- resolver tenant activo;
- calcular permisos;
- exponer contexto autenticado.

### Server Actions

Pueden usar helpers específicos del canal web, pero **sin redefinir las reglas de auth**.

### Route Handlers

Pueden adaptarse a headers/tokens HTTP, pero **sin redefinir las reglas de auth**.

### Regla

> Cambia el transporte; no cambia la semántica de autenticación.

---

## Regla 5 — Dónde va la lógica multi-tenant

Toda lógica multi-tenant debe ser **explícita**.

### Obligatorio

- requerir tenant cuando el caso lo necesite;
- filtrar por `tenantId` en acceso a datos;
- validar pertenencia del recurso al tenant actual;
- aplicar límites y features de plan en backend.

### No permitido

- asumir tenant implícito sin validarlo;
- confiar en filtros del cliente;
- dejar queries sin scope tenant en casos sensibles.

---

## Regla 6 — Dependencias entre features

Las features pueden colaborar, pero no de cualquier forma.

### Permitido

- usar contratos públicos;
- consumir services expuestos intencionalmente;
- compartir tipos o utilidades estables.

### Evitar

- importar componentes internos de otra feature;
- importar hooks internos de otra feature como dependencia estructural;
- depender de detalles de implementación o archivos “privados”.

### Regla práctica

> Si otra feature necesita algo tuyo, exponelo como contrato estable o movelo a una capa compartida.

---

## Regla 7 — Prisma no es el dominio

Prisma es una herramienta de persistencia, no el lenguaje del negocio.

### Sí

- adapters de repositorio;
- implementación de consultas;
- mapeo entre storage y modelos de aplicación.

### No

- reglas de negocio metidas en queries gigantes;
- actions que son poco más que “Prisma procedural script”;
- usar directamente modelos Prisma como si fueran la API del dominio.

---

## Regla 8 — Contrato para web + mobile

Cuando un flujo exista en web y mobile:

1. Definí el **caso de uso**.
2. Aislá input/output del negocio.
3. Hacé que web lo consuma vía Action adapter.
4. Hacé que mobile lo consuma vía HTTP adapter.

### Patrón recomendado

```text
UI Web -> Server Action -> Use Case -> Repository Port -> Prisma Adapter
Mobile -> Route Handler -> Use Case -> Repository Port -> Prisma Adapter
```

---

## Regla 9 — Qué debe testear cada capa

| Capa | Test recomendado |
|------|------------------|
| Use case / service | unitario |
| Repository adapter | integración |
| Server Action | unitario / contrato del wrapper |
| Route Handler | integración / contrato HTTP |
| Flujo web crítico | E2E |

### Regla

> Los tests más valiosos deberían vivir donde está la lógica, no donde está el framework.

---

## Regla 10 — Criterios de extracción hacia hexagonal

No hace falta reescribir todo. Extraé primero donde más duele.

### Prioridad alta

- auth y tenant context;
- flujos usados por web y mobile;
- módulos con archivos gigantes;
- lógica de coordinación entre varias entidades;
- integraciones externas.

### Prioridad media

- repositorios explícitos;
- puertos para storage/correo/upload;
- mapeos entre modelos de Prisma y modelos de aplicación.

### Prioridad baja

- casos triviales solo-web y muy locales.

---

## Checklist de decisión rápida

Antes de crear código nuevo, chequeá esto:

- [ ] ¿El consumidor es solo web?
- [ ] ¿El consumidor incluye mobile o terceros?
- [ ] ¿La lógica se reutilizará en más de un canal?
- [ ] ¿Estoy metiendo reglas de negocio dentro del transporte?
- [ ] ¿Estoy acoplando una feature a detalles internos de otra?
- [ ] ¿Estoy usando Prisma como si fuera mi capa de dominio?
- [ ] ¿Este cambio acerca o aleja el objetivo hexagonal?

---

## Anti-patrones

### 1. Action gorda
Server Action con validaciones, reglas, coordinación, Prisma y respuestas mezcladas.

### 2. Route Handler gorda
HTTP handler convertido en mini-backend independiente.

### 3. Prisma como caso de uso
La lógica se expresa solo mediante consultas y updates sin abstracción.

### 4. Auth duplicada
Web y API resolviendo distinto el mismo concepto de usuario autenticado.

### 5. Feature spaghetti
Features importándose entre sí por componentes, hooks y utilidades internas.

---

## Next step

Después de este documento, el siguiente paso sano es definir una convención de carpetas para la transición hexagonal, por ejemplo:

```text
src/features/<feature>/
  actions/
  api/
  application/
  domain/
  infrastructure/
  components/
```

No porque la carpeta mágicamente arregle la arquitectura, sino porque **te obliga a pensar las fronteras antes de mezclar todo**.
