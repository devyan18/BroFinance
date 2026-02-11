# BroFinance - Backend API

## 📋 Descripción

API RESTful para la gestión de finanzas compartidas entre usuarios. Permite el registro, autenticación y gestión de compras compartidas con sistema de acreedores y deudores.

## 🚀 Tecnologías

- **Node.js** con **TypeScript**
- **Express.js** - Framework web
- **MongoDB** con **Mongoose** - Base de datos
- **JWT** - Autenticación basada en tokens
- **Bcrypt** - Encriptación de contraseñas
- **Zod** - Validación de datos
- **Helmet** - Seguridad HTTP
- **CORS** - Control de acceso
- **Rate Limiting** - Protección contra ataques

## 📁 Estructura del Proyecto

```
back/
├── src/
│   ├── app.ts                          # Configuración principal de Express
│   ├── modules/
│   │   ├── auth/                       # Módulo de autenticación
│   │   │   ├── auth.routes.ts         # Rutas de autenticación
│   │   │   ├── auth.services.ts       # Lógica de negocio
│   │   │   ├── auth.route.validations.ts  # Validaciones Zod
│   │   │   └── blacklistToken.model.ts    # Modelo de tokens revocados
│   │   ├── usuarios/                   # Módulo de usuarios
│   │   │   └── usuario.model.ts       # Modelo de usuario
│   │   ├── compras/                    # Módulo de compras
│   │   │   └── compras.model.ts       # Modelos de compras y tipos
│   │   └── middlewares/                # Middlewares compartidos
│   │       └── validateRoute.ts       # Middleware de validación
│   └── settings/                       # Configuraciones
│       ├── connectDb.ts               # Conexión a MongoDB
│       └── environments.ts            # Variables de entorno
├── .env.local                          # Variables de entorno locales
├── package.json
└── README.md
```

## 🔧 Instalación

### Prerrequisitos

- Node.js >= 18.x
- MongoDB >= 6.x
- pnpm (recomendado) o npm

### Pasos

1. **Clonar el repositorio**

   ```bash
   git clone <repository-url>
   cd bro-finances/back
   ```

2. **Instalar dependencias**

   ```bash
   pnpm install
   ```

3. **Configurar variables de entorno**

   Crear archivo `.env.local` en la raíz del proyecto:

   ```env
   PORT=4000
   MONGODB_URI=mongodb://localhost:27017/bro-finances
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   ```

4. **Iniciar el servidor**

   **Desarrollo (con hot-reload):**

   ```bash
   pnpm dev
   ```

   **Producción:**

   ```bash
   pnpm start
   ```

## 📚 API Endpoints

### Base URL

```
http://localhost:4000/api
```

### 🔐 Autenticación

#### 1. Registro Local (Sign Up)

**Endpoint:** `POST /api/auth/local/sign-up`

**Descripción:** Registra un nuevo usuario con email y contraseña.

**Request Body:**

```json
{
  "username": "string (min 3 caracteres)",
  "email": "string (email válido)",
  "password": "string (min 5 caracteres)"
}
```

**Response Success (200):**

```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "email": "john@example.com",
    "provider": ["local"],
    "balance": 0,
    "createdAt": "2026-02-10T14:00:00.000Z",
    "updatedAt": "2026-02-10T14:00:00.000Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response Error (400):**

```json
{
  "error": "Bad Request"
}
```

**Validaciones:**

- `username`: mínimo 3 caracteres
- `email`: formato de email válido
- `password`: mínimo 5 caracteres
- Email único (no puede estar registrado)

---

#### 2. Inicio de Sesión Local (Sign In)

**Endpoint:** `POST /api/auth/local/sign-in`

**Descripción:** Autentica un usuario existente.

**Request Body:**

```json
{
  "email": "string (email válido)",
  "password": "string (min 5 caracteres)"
}
```

**Response Success (200):**

```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "email": "john@example.com",
    "avatarUrl": "https://example.com/avatar.jpg",
    "provider": ["local"],
    "balance": 150.5,
    "createdAt": "2026-02-10T14:00:00.000Z",
    "updatedAt": "2026-02-10T14:00:00.000Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response Error (401):**

```json
{
  "error": "Unauthorized"
}
```

---

#### 3. Cerrar Sesión (Sign Out)

**Endpoint:** `POST /api/auth/sign-out`

**Descripción:** Revoca el refresh token del usuario.

**Headers:**

```
Authorization: Bearer <accessToken>
x-refresh-token: Bearer <refreshToken>
```

**Response Success (200):**

```json
{
  "message": "Successfully signed out"
}
```

**Response Error (400):**

```json
{
  "error": "Bad Request"
}
```

---

#### 4. Obtener Usuario Actual (Me)

**Endpoint:** `GET /api/auth/me`

**Descripción:** Obtiene la información del usuario autenticado.

**Headers:**

```
Authorization: Bearer <accessToken>
x-refresh-token: Bearer <refreshToken>
```

**Response Success (200):**

```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "email": "john@example.com",
    "avatarUrl": "https://example.com/avatar.jpg",
    "provider": ["local"],
    "balance": 150.5,
    "createdAt": "2026-02-10T14:00:00.000Z",
    "updatedAt": "2026-02-10T14:00:00.000Z"
  }
}
```

**Response Error (401):**

```json
{
  "error": "Unauthorized"
}
```

**Response Error (404):**

```json
{
  "error": "Not Found"
}
```

---

## 🔑 Sistema de Autenticación

### Tokens JWT

La API utiliza un sistema de **doble token**:

1. **Access Token**
   - Duración: 15 minutos
   - Se envía en el header `Authorization: Bearer <token>`
   - Se usa para autenticar cada petición

2. **Refresh Token**
   - Duración: 30 días
   - Se envía en el header `x-refresh-token: Bearer <token>`
   - Se usa para renovar el access token cuando expira

### Flujo de Autenticación

1. Usuario se registra o inicia sesión
2. Recibe ambos tokens (access y refresh)
3. Almacena los tokens en el cliente (localStorage/sessionStorage)
4. Envía ambos tokens en cada petición protegida
5. Si el access token expira, el servidor automáticamente genera uno nuevo usando el refresh token
6. El nuevo access token se devuelve en `res.locals.accessToken`

### Middleware de Validación

El middleware `validateRequest` verifica:

- Presencia de ambos tokens
- Validez del access token
- Si el access token expiró, intenta renovarlo con el refresh token
- Si el refresh token también expiró o es inválido, retorna 401

### Blacklist de Tokens

Cuando un usuario cierra sesión:

- El refresh token se agrega a una blacklist en MongoDB
- Tokens en blacklist no pueden ser usados para renovar access tokens
- Esto previene el uso de tokens robados después del logout

---

## 📊 Modelos de Datos

### Usuario (Usuario)

```typescript
{
  _id: ObjectId,
  username: string,          // Nombre de usuario
  avatarUrl?: string,        // URL del avatar (opcional)
  email: string,             // Email único
  password: string,          // Hash bcrypt (select: false)
  provider: Provider[],      // ['local', 'google', 'github']
  balance: number,           // Balance actual (default: 0)
  createdAt: Date,
  updatedAt: Date
}
```

### Compra (Compra)

```typescript
{
  _id: ObjectId,
  descripcion: string,       // Descripción de la compra
  montoTotal: number,        // Monto total de la compra
  montoAcreedor: number,     // Monto que pagó el acreedor
  montoDeudor: number,       // Monto que debe el deudor
  tipo: ObjectId,            // Referencia a TipoCompra
  acreedorId: ObjectId,      // Usuario que pagó
  deudorId: ObjectId,        // Usuario que debe
  createdAt: Date,
  updatedAt: Date
}
```

**Hooks:**

- `pre('save')`: Actualiza automáticamente el balance de acreedor y deudor

### Tipo de Compra (TipoCompra)

```typescript
{
  _id: ObjectId,
  descripcion: string,       // Descripción única del tipo
  createdAt: Date,
  updatedAt: Date
}
```

### Token en Blacklist (BlacklistToken)

```typescript
{
  _id: ObjectId,
  token: string,             // Refresh token revocado (único)
  blacklistedAt: Date,       // Fecha de revocación
  user: ObjectId,            // Referencia al usuario
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🛡️ Seguridad

### Medidas Implementadas

1. **Helmet**: Headers de seguridad HTTP
2. **CORS**: Control de acceso configurado
3. **Rate Limiting**: 500 peticiones por IP cada 15 minutos
4. **Bcrypt**: Hash de contraseñas con salt de 10 rounds
5. **JWT**: Tokens firmados con secret
6. **Password Select**: Campo password no se devuelve por defecto
7. **Blacklist**: Tokens revocados no pueden ser reutilizados

### Recomendaciones para Producción

- [ ] Cambiar `JWT_SECRET` a un valor aleatorio y seguro
- [ ] Configurar CORS con origins específicos (no usar `*`)
- [ ] Usar HTTPS en producción
- [ ] Implementar rate limiting más estricto
- [ ] Agregar logging de seguridad
- [ ] Implementar refresh token rotation
- [ ] Agregar validación de fuerza de contraseña
- [ ] Implementar 2FA (autenticación de dos factores)
- [ ] Agregar captcha en registro/login
- [ ] Monitorear intentos de login fallidos

---

## 🧪 Testing

### Pruebas con cURL

**Registro:**

```bash
curl -X POST http://localhost:4000/api/auth/local/sign-up \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Login:**

```bash
curl -X POST http://localhost:4000/api/auth/local/sign-in \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Obtener usuario actual:**

```bash
curl -X GET http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer <accessToken>" \
  -H "x-refresh-token: Bearer <refreshToken>"
```

### Pruebas con Postman/Insomnia

1. Importar la colección de endpoints
2. Configurar variables de entorno:
   - `baseUrl`: `http://localhost:4000/api`
   - `accessToken`: (se actualiza después del login)
   - `refreshToken`: (se actualiza después del login)

---

## 🐛 Troubleshooting

### Error: "Cannot connect to MongoDB"

**Solución:**

- Verificar que MongoDB esté corriendo
- Verificar la URI en `.env.local`
- Verificar permisos de red/firewall

### Error: "JWT malformed"

**Solución:**

- Verificar que el token se envíe correctamente en el header
- Verificar que el formato sea `Bearer <token>`
- Verificar que `JWT_SECRET` sea el mismo que generó el token

### Error: "Validation failed"

**Solución:**

- Revisar el formato de los datos enviados
- Verificar que cumplan con las validaciones Zod
- Revisar el mensaje de error específico en `errors` array

---

## 📝 Changelog

### v1.0.0 (2026-02-10)

- ✅ Sistema de autenticación con JWT
- ✅ Registro e inicio de sesión local
- ✅ Middleware de validación con Zod
- ✅ Modelos de Usuario, Compra y TipoCompra
- ✅ Sistema de blacklist para tokens
- ✅ Rate limiting y seguridad básica
- ✅ Documentación completa

---

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📄 Licencia

ISC

---

## 👥 Autores

- **BroFinance Team**

---

## 📞 Soporte

Para reportar bugs o solicitar features, por favor abre un issue en el repositorio.

