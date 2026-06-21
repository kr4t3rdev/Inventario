# Guía de Deployment: Dashboard de Inteligencia Cambiaria

## Requisitos del Sistema

### Servidor
- **Node.js**: Versión 18.17 o superior
- **NPM/Yarn/PNPM**: Gestor de paquetes actualizado
- **PostgreSQL**: Versión 13 o superior
- **Redis**: Versión 6 o superior (opcional, para cache)

### Recursos Mínimos
- **RAM**: 2GB mínimo, 4GB recomendado
- **CPU**: 1 core mínimo, 2 cores recomendado
- **Almacenamiento**: 500MB para aplicación, más para base de datos

## Variables de Entorno

### Base de Datos
```env
DATABASE_URL="postgresql://username:password@localhost:5432/exchange_db?schema=public"
DIRECT_URL="postgresql://username:password@localhost:5432/exchange_db?schema=public"
```

### Autenticación
```env
JWT_SECRET="your-super-secure-jwt-secret-key-here"
NEXTAUTH_SECRET="your-nextauth-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

### APIs Externas
```env
EXCHANGE_RATE_API_KEY="your-exchange-rate-api-key"
EXCHANGE_RATE_API_URL="https://api.exchangerate-api.com/v4/latest"
```

### Configuración de Aplicación
```env
NODE_ENV="production"
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
NEXT_PUBLIC_APP_NAME="Exchange Intelligence Dashboard"
```

### Monitoreo y Logging
```env
LOG_LEVEL="info"
SENTRY_DSN="your-sentry-dsn-here"
PROMETHEUS_METRICS_ENABLED="true"
```

## Instalación y Configuración

### 1. Clonar Repositorio
```bash
git clone <repository-url>
cd exchange-intelligence-dashboard
```

### 2. Instalar Dependencias
```bash
# Usando pnpm (recomendado)
pnpm install

# O usando npm
npm install

# O usando yarn
yarn install
```

### 3. Configurar Base de Datos
```bash
# Crear base de datos
createdb exchange_db

# Ejecutar migraciones
npx prisma migrate deploy

# Ejecutar seeders (datos iniciales)
npx prisma db seed
```

### 4. Configurar Variables de Entorno
```bash
cp .env.example .env.local
# Editar .env.local con los valores apropiados
```

### 5. Build de Producción
```bash
pnpm build
```

### 6. Iniciar Aplicación
```bash
# Modo desarrollo
pnpm dev

# Modo producción
pnpm start
```

## Deployment en Producción

### Opción 1: Vercel (Recomendado)
```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### Opción 2: Docker
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# Build y run
docker build -t exchange-dashboard .
docker run -p 3000:3000 exchange-dashboard
```

### Opción 3: Servidor Tradicional
```bash
# Instalar PM2 para gestión de procesos
npm install -g pm2

# Configurar PM2
pm2 start ecosystem.config.js

# Configurar nginx como proxy reverso
sudo cp nginx.conf /etc/nginx/sites-available/exchange-dashboard
sudo ln -s /etc/nginx/sites-available/exchange-dashboard /etc/nginx/sites-enabled/
sudo nginx -t && sudo nginx -s reload
```

## Configuración de Monitoreo

### 1. Logging
```javascript
// next.config.js
const withLogging = require('@your/logging-plugin')

module.exports = withLogging({
  // configuración de logging
})
```

### 2. Métricas de Performance
```javascript
// pages/_app.js
import { metrics } from '@your/metrics-plugin'

export default function App({ Component, pageProps }) {
  useEffect(() => {
    metrics.init()
  }, [])

  return <Component {...pageProps} />
}
```

### 3. Alertas de Error
```javascript
// lib/error-handler.js
import * as Sentry from '@sentry/nextjs'

export function reportError(error, context) {
  Sentry.captureException(error, {
    tags: {
      component: context.component,
      user: context.user?.id
    }
  })
}
```

## Health Checks

### Endpoint de Salud
```javascript
// pages/api/health.js
export default async function handler(req, res) {
  try {
    // Verificar conexión a base de datos
    await prisma.$queryRaw`SELECT 1`

    // Verificar servicios externos
    const exchangeRateResponse = await fetch(process.env.EXCHANGE_RATE_API_URL)
    const exchangeRateOk = exchangeRateResponse.ok

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: true,
        exchangeRateApi: exchangeRateOk
      }
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    })
  }
}
```

## Backup y Recovery

### Backup Automático
```bash
# Script de backup diario
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump exchange_db > backup_$DATE.sql

# Comprimir
gzip backup_$DATE.sql

# Subir a cloud storage
aws s3 cp backup_$DATE.sql.gz s3://your-backup-bucket/
```

### Recovery
```bash
# Restaurar desde backup
gunzip backup_20231201_120000.sql.gz
psql exchange_db < backup_20231201_120000.sql
```

## Optimización de Performance

### 1. Configuración de Build
```javascript
// next.config.js
module.exports = {
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  },
  experimental: {
    optimizeCss: true,
    scrollRestoration: true
  }
}
```

### 2. Cache de API
```javascript
// lib/api-cache.js
import { unstable_cache } from 'next/cache'

export const getCachedExchangeRates = unstable_cache(
  async () => {
    const response = await fetch(EXCHANGE_RATE_API_URL)
    return response.json()
  },
  ['exchange-rates'],
  { revalidate: 3600 } // 1 hora
)
```

### 3. Optimización de Imágenes
```javascript
// components/optimized-image.js
import Image from 'next/image'

export default function OptimizedImage({ src, alt, ...props }) {
  return (
    <Image
      src={src}
      alt={alt}
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+IRjWjBqO6O2mhP//Z"
      {...props}
    />
  )
}
```

## Seguridad

### Configuración de Headers
```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      }
    ]
  }
}
```

### Rate Limiting
```javascript
// middleware.js
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
})
```

## Monitoreo en Producción

### Dashboards de Métricas
- **Response Time**: < 500ms para APIs
- **Error Rate**: < 1% de requests
- **Uptime**: > 99.9%
- **Memory Usage**: < 80% de límite
- **Database Connections**: < 90% de pool máximo

### Alertas Configuradas
- Error rate > 5%
- Response time > 2s
- Memory usage > 90%
- Database connections > 95%
- Failed login attempts > 10/min

## Troubleshooting de Producción

### Problemas Comunes

#### Alta Latencia
```bash
# Verificar logs de aplicación
pm2 logs exchange-dashboard

# Verificar métricas de base de datos
psql -c "SELECT * FROM pg_stat_activity;"

# Verificar uso de CPU/memoria
htop
```

#### Errores 500
```bash
# Verificar logs detallados
tail -f /var/log/exchange-dashboard/error.log

# Verificar variables de entorno
env | grep -E "(DATABASE|JWT|API)"

# Verificar conectividad a servicios externos
curl -I https://api.exchangerate-api.com/v4/latest/USD
```

#### Memoria Llena
```bash
# Verificar leaks de memoria
node --inspect --max-old-space-size=4096

# Reiniciar aplicación
pm2 restart exchange-dashboard

# Verificar configuración de garbage collector
NODE_OPTIONS="--max-old-space-size=2048 --optimize-for-size"
```

## Actualizaciones y Mantenimiento

### Estrategia de Deployment
1. **Desarrollo**: Rama `develop`
2. **Staging**: Rama `staging`
3. **Producción**: Rama `main`

### Proceso de Release
```bash
# Crear rama de release
git checkout -b release/v1.1.0

# Ejecutar tests completos
pnpm test
pnpm build

# Deploy a staging
git push origin release/v1.1.0
# CI/CD despliega automáticamente a staging

# Después de pruebas en staging
git checkout main
git merge release/v1.1.0
git push origin main
# CI/CD despliega automáticamente a producción
```

### Rollback Plan
```bash
# Revertir a versión anterior
git revert HEAD~1
git push origin main

# O rollback manual
pm2 stop exchange-dashboard
pm2 start ecosystem.config.js.backup
```

---

*Esta guía se mantiene actualizada con cada deployment. Para soporte adicional, contactar al equipo de DevOps.*