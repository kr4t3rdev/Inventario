# Perfil de Usuario (Profile)

> Permite que cada usuario revise y actualice su identidad básica dentro del sistema, incluyendo nombre y avatar.

## Qué hace

Este módulo trabaja sobre la cuenta autenticada actual. Expone datos de perfil, estado de cuenta, expiración, avatar y nombre, y ofrece una edición directa sin pasar por paneles administrativos.

## Qué incluye

- lectura del perfil autenticado
- actualización de nombre
- actualización de avatar
- visualización de rol, estado y expiración
- soporte de upload de avatar según feature del plan

## Cuándo usarlo

- Cuando el usuario necesita cambiar su nombre visible.
- Cuando quiere actualizar foto de perfil.
- Cuando quiere revisar el estado y vigencia de su cuenta.

## Reglas importantes

- El perfil que se edita es siempre el del usuario autenticado.
- El avatar puede depender de la feature `upload-profile-avatar`.
- La actualización del avatar usa reemplazo de asset en Cloudinary.
- No es un módulo de administración de usuarios del tenant; eso vive en configuración de usuarios.

## Qué conviene cuidar

- No confundas perfil personal con ficha de empleado o permisos del tenant.
- Si la cuenta está por expirar, esta vista sirve más para diagnóstico que para resolver licencias.

## Rutas y referencias

- `/busy/perfil`
- `src/features/profile/actions.ts`

## En una frase

Es la ficha personal del usuario autenticado dentro del sistema.
