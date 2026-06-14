# FinanceMDM - Sistema de Gestión Financiera e Inventario

![FinanceMDM Logo](public/images/Finanzas.jpg)

FinanceMDM es una plataforma integral de gestión financiera y control de inventario diseñada para empresas de todos los tamaños. La aplicación automatiza procesos financieros, optimiza la gestión de stock y transforma datos en decisiones estratégicas.

## 🚀 Características Principales

### 💰 Gestión Financiera
- **Control de Ingresos y Gastos**: Registro completo de todas las transacciones financieras
- **Múltiples Monedas**: Soporte para CUP, USD, EUR con tasas de cambio automáticas
- **Reconciliación Bancaria**: Conciliación automática de cuentas bancarias
- **Proyecciones Financieras**: Modelos predictivos basados en datos históricos
- **Reportes Personalizados**: Informes adaptados a necesidades específicas

### 📦 Gestión de Inventario
- **Control de Stock**: Seguimiento en tiempo real de inventario
- **Alertas de Stock Mínimo**: Notificaciones automáticas para reposición
- **Gestión de Categorías**: Sistema jerárquico de categorías y subcategorías
- **Transferencias**: Control de movimientos entre almacenes y puntos de venta
- **Control de Mermas**: Registro y análisis de pérdidas

### 👥 Gestión de Recursos Humanos
- **Empleados**: Control completo de personal
- **Nómina**: Cálculo automático de salarios y deducciones
- **Comisiones**: Sistema de incentivos por ventas

### 📊 Ventas y Servicios
- **Punto de Venta**: Sistema POS integrado
- **Gestión de Servicios**: Control de servicios ofrecidos
- **Clientes**: Base de datos de clientes corporativos
- **Facturación**: Generación automática de facturas

### 🏪 Puntos de Venta y Almacenes
- **Múltiples Ubicaciones**: Gestión de varios puntos de venta
- **Transferencias**: Movimientos entre ubicaciones
- **Reportes por Ubicación**: Análisis específico por tienda

### 💱 Contabilidad Avanzada
- **Plan Contable**: Estructura contable completa
- **Asientos Automáticos**: Registro automático de transacciones
- **Libros Contables**: Mayor, Diario, Balance
- **Análisis de Rentabilidad**: Control de márgenes y rentabilidad

## 🛠️ Tecnologías Utilizadas

### Frontend
- **Next.js 15**: Framework React con App Router
- **React 19**: Biblioteca de interfaz de usuario
- **TypeScript**: Tipado estático
- **TailwindCSS**: Framework de CSS
- **shadcn/ui**: Componentes UI modernos
- **Radix UI**: Componentes accesibles
- **Lucide React**: Iconos SVG
- **Recharts**: Gráficos y visualizaciones

### Backend
- **Next.js API Routes**: Endpoints de API
- **Prisma**: ORM para base de datos
- **PostgreSQL**: Base de datos principal
- **Neon**: Hosting de base de datos

### Autenticación y Seguridad
- **NextAuth**: Sistema de autenticación
- **JWT**: Tokens de sesión
- **bcrypt**: Hash de contraseñas
- **Clerk**: Autenticación alternativa

### Estado y Datos
- **Redux Toolkit**: Gestión de estado global
- **React Query**: Gestión de estado del servidor
- **Zod**: Validación de esquemas

### Herramientas de Desarrollo
- **TypeScript**: Tipado estático
- **ESLint**: Linting de código
- **Vitest**: Framework de testing
- **Testing Library**: Testing de componentes

## 📋 Prerrequisitos

Antes de instalar FinanceMDM, asegúrate de tener instalado:

- **Node.js** (versión 18 o superior)
- **npm** o **yarn**
- **PostgreSQL** (versión 13 o superior)
- **Git**

## 🚀 Instalación

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/tu-usuario/financemdm.git
   cd financemdm
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   # o
   yarn install
   ```

3. **Configurar variables de entorno**

   Crea un archivo `.env.local` en la raíz del proyecto:
   ```bash
   # Base de datos
   DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/financemdm"

   # NextAuth
   NEXTAUTH_SECRET="tu-secreto-nextauth"
   NEXTAUTH_URL="http://localhost:3000"

   # Autenticación alternativa (opcional)
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
   CLERK_SECRET_KEY="sk_test_..."

   # Configuración de moneda
   DEFAULT_CURRENCY="CUP"
   EXCHANGE_API_URL="https://api.exchangerate-api.com/v4/latest/USD"
   ```

4. **Configurar la base de datos**
   ```bash
   # Generar cliente de Prisma
   npx prisma generate

   # Ejecutar migraciones
   npx prisma db push

   # (Opcional) Poblar con datos de prueba
   npx prisma db seed
   ```

5. **Iniciar el servidor de desarrollo**
   ```bash
   npm run dev
   # o
   yarn dev
   ```

6. **Acceder a la aplicación**

   Abre tu navegador y ve a [http://localhost:3000](http://localhost:3000)

## 📁 Estructura del Proyecto

```
financemdm/
├── src/
│   ├── app/                    # App Router de Next.js
│   │   ├── api/               # Endpoints de API
│   │   ├── busy/              # Dashboard administrativo
│   │   ├── login/             # Página de login
│   │   └── register/          # Página de registro
│   ├── components/            # Componentes React
│   │   ├── ui/               # Componentes base (shadcn/ui)
│   │   ├── admin/            # Componentes administrativos
│   │   ├── categorias/       # Gestión de categorías
│   │   ├── contabilidad/     # Módulo contable
│   │   ├── economia/         # Análisis económico
│   │   ├── reportes/         # Reportes y estadísticas
│   │   ├── servicios/        # Gestión de servicios
│   │   └── transferencias/   # Sistema de transferencias
│   ├── contexts/             # Contextos de React
│   ├── hooks/                # Custom hooks
│   ├── lib/                  # Utilidades y configuraciones
│   │   ├── redux/           # Configuración de Redux
│   │   └── prisma.ts        # Cliente de Prisma
│   └── generated/            # Archivos generados
│       └── prisma/          # Cliente de Prisma
├── public/                   # Archivos estáticos
├── prisma/                   # Esquema y migraciones de Prisma
└── package.json
```

## 🔧 Configuración

### Variables de Entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Conexión a PostgreSQL | `postgresql://user:pass@localhost:5432/db` |
| `NEXTAUTH_SECRET` | Secreto para NextAuth | `random-string-secret` |
| `NEXTAUTH_URL` | URL base de la aplicación | `http://localhost:3000` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clave pública de Clerk | `pk_test_...` |
| `CLERK_SECRET_KEY` | Clave secreta de Clerk | `sk_test_...` |

### Configuración de Base de Datos

El proyecto utiliza Prisma como ORM. Para modificar el esquema:

1. Edita `prisma/schema.prisma`
2. Ejecuta `npx prisma db push` para aplicar cambios
3. Regenera el cliente con `npx prisma generate`

## 🎯 Uso

### Primeros Pasos

1. **Registro de Usuario**: Crea una cuenta administrador
2. **Configuración Inicial**: Configura monedas, cuentas bancarias
3. **Catálogo**: Crea categorías y productos
4. **Inventario**: Registra stock inicial
5. **Usuarios**: Crea usuarios para el equipo

### Módulos Principales

#### Dashboard
- Resumen financiero
- Alertas de stock
- Indicadores clave
- Gráficos de rendimiento

#### Productos
- CRUD de productos
- Gestión de categorías
- Control de inventario
- Historial de cambios

#### Ventas
- Registro de ventas
- Punto de venta
- Facturación
- Reportes de ventas

#### Contabilidad
- Plan contable
- Asientos automáticos
- Conciliación bancaria
- Reportes financieros

#### Reportes
- Ventas por período
- Análisis de rentabilidad
- Control de inventario
- Estados financieros


## 📱 Mobile API

- [`mobile-api-contract.md`](./mobile-api-contract.md) — contrato mobile-first v1, storage seguro de tokens, rollout por módulos y nota de futura extracción a NestJS.

## 🧪 Testing

Ejecuta los tests del proyecto:

```bash
# Tests unitarios
npm run test

# Tests de integración
npm run test:integration

# Cobertura de tests
npm run test:coverage

# Tests en modo watch
npm run test:watch
```

## 🚀 Deployment

### Vercel (Recomendado)

1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno
3. Deploy automático en cada push

### Docker

```bash
# Construir imagen
docker build -t financemdm .

# Ejecutar contenedor
docker run -p 3000:3000 financemdm
```

### Manual

```bash
# Build de producción
npm run build

# Iniciar en producción
npm start
```

## 📊 Monitoreo y Logs

La aplicación incluye:
- **Logs de aplicación**: Registros detallados
- **Métricas de rendimiento**: Tiempo de respuesta
- **Alertas**: Notificaciones de errores
- **Analytics**: Uso y comportamiento de usuarios

## 🔒 Seguridad

- **Autenticación JWT**: Tokens seguros
- **Encriptación**: Contraseñas hasheadas
- **Validación**: Validación de datos con Zod
- **Roles**: Sistema de permisos por usuario
- **CORS**: Configuración segura de APIs

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Guías de Desarrollo

- Usa TypeScript para todo el código
- Sigue las convenciones de ESLint
- Escribe tests para nuevas funcionalidades
- Documenta APIs complejas

## 📝 Changelog

### v1.0.0 (2025-01-15)
- ✨ Lanzamiento inicial
- 🎯 Módulo de gestión de inventario
- 💰 Sistema contable completo
- 📊 Dashboard con métricas en tiempo real
- 🔐 Sistema de autenticación robusto

## 🆘 Soporte
