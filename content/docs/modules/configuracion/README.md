# Configuración

> Reúne submódulos de configuración del tenant como Mi Empresa, usuarios, contratos, series de facturación y catálogo técnico.

## Qué hace

Este módulo no es una única entidad de datos: funciona como paraguas de ajustes operativos del tenant. Desde aquí se accede a configuración contractual, series de facturación, usuarios del tenant, Mi Empresa y catálogos específicos del taller.

## Qué incluye

- `Mi Empresa`
- `Usuarios`
- `Series de Facturación`
- `Configuración de Contratos`
- `Catálogo de Reparaciones`

## Cuándo usarlo

- Cuando querés preparar el tenant antes de operar.
- Cuando necesitás tocar reglas o maestros que impactan varios módulos.
- Cuando el problema no está en la operación diaria sino en la base configurativa.

## Reglas importantes

- Cada subruta de configuración tiene sus propios permisos y features.
- No todos los cambios son cosméticos: varios afectan ventas, contratos o inventario.
- El módulo es más un hub de configuración que un formulario único.

## Qué conviene cuidar

- Antes de cambiar algo acá, conviene entender qué otro módulo consume esa configuración.
- Muchos problemas “misteriosos” de operación vienen de parámetros mal configurados aquí.

## Rutas y referencias

- `/busy/configuracion/mi-empresa`
- `/busy/configuracion/usuarios`
- `/busy/configuracion/series-facturacion`
- `/busy/configuracion/contratos`
- `/busy/configuracion/catalogo`

## En una frase

Es el tablero de ajustes estructurales del tenant para que los demás módulos funcionen como corresponde.
