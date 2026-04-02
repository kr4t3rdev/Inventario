# Delta para notifications / forms

## Contexto

Extiende `openspec/specs/migracion-sonner-sileo/spec.md`.
La migración previa cubrió el mapeo de métodos. Este delta agrega:
- Los forms de negocio aún no migrados
- El patrón `onInvalid` para feedback en submit fallido

---

## ADDED Requirements

### Requirement: Cobertura Completa de Forms de Negocio

Todos los forms de negocio del proyecto DEBEN usar `sileo` como sistema de notificaciones. Ningún form en `src/components/` SHALL importar desde `'sonner'`.

**Forms con migración pendiente:**
`servicios-form`, `servicios-prestados-form`, `servicios-recibidos-form`, `compra-producto-form`, `transferencias-form`, `cuenta-bancaria-form`, `ajuste-bancario-form`, `enhanced-form-wrapper`

#### Scenario: Form de negocio sin sonner

- GIVEN cualquier archivo en `src/components/` que usa notificaciones
- WHEN se guarda o ocurre un error en el submit
- THEN la notificación se muestra con `sileo.success` o `sileo.error`
- AND NO existe `import { toast } from 'sonner'` en el archivo

#### Scenario: Verificación post-migración

- GIVEN el proyecto compilado
- WHEN se ejecuta `grep -r "from 'sonner'" src/components`
- THEN el resultado es vacío (0 matches)

---

### Requirement: Feedback de Submit Inválido (onInvalid)

Todo form que use `zodResolver` DEBE proveer un segundo argumento a `form.handleSubmit` para notificar al usuario cuando la validación falla antes de ejecutar `onSubmit`.

#### Scenario: Submit con campos requeridos vacíos

- GIVEN un form con campos obligatorios sin completar
- WHEN el usuario hace click en el botón de submit
- THEN el submit NO se ejecuta
- AND aparece un toast `sileo.error` con mensaje de orientación
- AND los `<FormMessage />` de cada campo inválido muestran su error específico

#### Scenario: Submit con todos los campos válidos

- GIVEN un form con todos los campos requeridos completos y válidos
- WHEN el usuario hace click en el botón de submit
- THEN `onSubmit` se ejecuta normalmente
- AND el callback `onInvalid` NO se dispara

#### Scenario: Submit parcialmente inválido

- GIVEN un form con algunos campos válidos y al menos uno inválido
- WHEN el usuario hace click en el botón de submit
- THEN el form hace scroll/foco al primer campo inválido (comportamiento RHF)
- AND aparece toast `sileo.error` orientativo
- AND NO se realiza ninguna llamada a la API
