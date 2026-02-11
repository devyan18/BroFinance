# BroFinance API - Guía para Frontend

## Base URL

```
http://localhost:4000/api/v1
```

## Formato de Respuesta

Todas las respuestas siguen este formato:

**Éxito:**

```typescript
{
  success: true,
  data: any,
  message?: string
}
```

**Error:**

```typescript
{
  success: false,
  error: string,
  errors?: Array<{ path: string, message: string }>
}
```

---

## Endpoints

### 1. Registro de Usuario

**POST** `/auth/local/sign-up`

**Body:**

```typescript
{
  username: string,  // min 3 caracteres
  email: string,     // email válido
  password: string   // min 5 caracteres
}
```

**Respuesta (201):**

```typescript
{
  success: true,
  data: {
    user: {
      _id: string,
      username: string,
      email: string,
      avatarUrl?: string,
      provider: string[],
      balance: number,
      createdAt: string,
      updatedAt: string
    },
    tokens: {
      accessToken: string,   // Guardar - expira en 15 min
      refreshToken: string   // Guardar - expira en 30 días
    }
  },
  message: "User registered successfully"
}
```

**Errores:**

- `409` - Email ya existe
- `400` - Validación fallida

---

### 2. Inicio de Sesión

**POST** `/auth/local/sign-in`

**Body:**

```typescript
{
  email: string,
  password: string
}
```

**Respuesta (200):**

```typescript
{
  success: true,
  data: {
    user: {
      _id: string,
      username: string,
      email: string,
      avatarUrl?: string,
      provider: string[],
      balance: number,
      createdAt: string,
      updatedAt: string
    },
    tokens: {
      accessToken: string,
      refreshToken: string
    }
  },
  message: "Signed in successfully"
}
```

**Errores:**

- `401` - Email o contraseña incorrectos

---

### 3. Login con Google

**POST** `/auth/google/callback`

**Body:**

```typescript
{
  token: string; // ID Token de Google
}
```

**Respuesta (200):**

```typescript
{
  success: true,
  data: {
    user: {
      _id: string,
      username: string,
      email: string,
      avatarUrl: string,
      provider: string[], // incluirá 'google'
      balance: number,
      createdAt: string,
      updatedAt: string
    },
    tokens: {
      accessToken: string,
      refreshToken: string
    }
  },
  message: "Authenticated with Google successfully"
}
```

**Errores:**

- `401` - Token de Google inválido

---

### 4. Obtener Usuario Actual

**GET** `/auth/me`

**Headers requeridos:**

```typescript
{
  "Authorization": "Bearer <accessToken>",
  "x-refresh-token": "Bearer <refreshToken>"
}
```

**Respuesta (200):**

```typescript
{
  success: true,
  data: {
    user: {
      _id: string,
      username: string,
      email: string,
      avatarUrl?: string,
      provider: string[],
      balance: number,
      createdAt: string,
      updatedAt: string
    }
  }
}
```

**Errores:**

- `401` - Tokens inválidos o expirados
- `404` - Usuario no encontrado

**Nota:** Si el accessToken expiró, el servidor automáticamente genera uno nuevo y lo devuelve en la respuesta. Actualiza tu token almacenado.

---

### 5. Cerrar Sesión

**POST** `/auth/sign-out`

**Headers requeridos:**

```typescript
{
  "Authorization": "Bearer <accessToken>",
  "x-refresh-token": "Bearer <refreshToken>"
}
```

**Respuesta (200):**

```typescript
{
  success: true,
  data: null,
  message: "Signed out successfully"
}
```

**Errores:**

- `401` - Tokens inválidos

---

### 6. Refrescar Token

**POST** `/auth/refresh`

**Headers requeridos:**

```typescript
{
  "x-refresh-token": "Bearer <refreshToken>"
}
```

**Respuesta (200):**

```typescript
{
  success: true,
  data: {
    accessToken: string
  },
  message: "Token refreshed successfully"
}
```

**Errores:**

- `401` - Refresh token inválido o revocado

---

### 7. Health Check

**GET** `/health`

**Respuesta (200):**

```typescript
{
  success: true,
  message: "Server is healthy",
  timestamp: string
}
```

---

## Manejo de Autenticación en el Frontend

### 1. Almacenar Tokens

Después de login/registro:

```typescript
const { data } = await response.json();

if (data.success) {
  localStorage.setItem('accessToken', data.data.tokens.accessToken);
  localStorage.setItem('refreshToken', data.data.tokens.refreshToken);
  localStorage.setItem('user', JSON.stringify(data.data.user));
}
```

### 2. Hacer Peticiones Autenticadas

```typescript
const accessToken = localStorage.getItem('accessToken');
const refreshToken = localStorage.getItem('refreshToken');

const response = await fetch('http://localhost:4000/api/v1/auth/me', {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'x-refresh-token': `Bearer ${refreshToken}`,
  },
});

const data = await response.json();

// Si el servidor refrescó el token, actualízalo
if (response.headers.get('x-new-access-token')) {
  localStorage.setItem('accessToken', response.headers.get('x-new-access-token'));
}
```

### 3. Manejar Errores 401

```typescript
if (response.status === 401) {
  // Token expirado o inválido
  localStorage.clear();
  window.location.href = '/login';
}
```

### 4. Cerrar Sesión

```typescript
const logout = async () => {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');

  await fetch('http://localhost:4000/api/v1/auth/sign-out', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-refresh-token': `Bearer ${refreshToken}`,
    },
  });

  localStorage.clear();
  window.location.href = '/login';
};
```

---

## Códigos de Estado HTTP

| Código | Significado                     |
| ------ | ------------------------------- |
| 200    | Éxito                           |
| 201    | Recurso creado                  |
| 400    | Datos inválidos                 |
| 401    | No autenticado                  |
| 404    | No encontrado                   |
| 409    | Conflicto (ej: email duplicado) |
| 429    | Demasiadas peticiones           |
| 500    | Error del servidor              |

---

## Validaciones

### Registro (sign-up)

- `username`: mínimo 3 caracteres
- `email`: formato de email válido
- `password`: mínimo 5 caracteres

### Login (sign-in)

- `email`: formato de email válido
- `password`: mínimo 5 caracteres

---

## Rate Limiting

- **Límite:** 500 peticiones por IP
- **Ventana:** 15 minutos
- **Respuesta cuando se excede:**

```typescript
{
  success: false,
  error: "Too many requests, please try again later"
}
```

---

## Ejemplo Completo en TypeScript

```typescript
// types.ts
export interface User {
  _id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  provider: string[];
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Array<{ path: string; message: string }>;
}

// api.ts
const API_BASE_URL = 'http://localhost:4000/api/v1';

export const api = {
  // Registro
  signUp: async (username: string, email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/local/sign-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    return response.json();
  },

  // Login
  signIn: async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/local/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  },

  // Login con Google
  signInWithGoogle: async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/google/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return response.json();
  },

  // Obtener usuario actual
  getMe: async () => {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-refresh-token': `Bearer ${refreshToken}`,
      },
    });
    return response.json();
  },

  // Cerrar sesión
  signOut: async () => {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');

    const response = await fetch(`${API_BASE_URL}/auth/sign-out`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-refresh-token': `Bearer ${refreshToken}`,
      },
    });
    return response.json();
  },
};

// Uso en componentes
const handleSignUp = async () => {
  const result = await api.signUp('johndoe', 'john@example.com', 'password123');

  if (result.success) {
    localStorage.setItem('accessToken', result.data.tokens.accessToken);
    localStorage.setItem('refreshToken', result.data.tokens.refreshToken);
    localStorage.setItem('user', JSON.stringify(result.data.user));
    // Redirigir al dashboard
  } else {
    console.error(result.error);
    // Mostrar error al usuario
  }
};
```

---

## Variables de Entorno Recomendadas (Frontend)

```env
VITE_API_BASE_URL=http://localhost:4000/api/v1
# o
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
```

---

## Notas Importantes

1. **Tokens:** Siempre envía ambos tokens (access y refresh) en peticiones autenticadas
2. **Refresh automático:** El servidor refresca el accessToken automáticamente si expiró
3. **Seguridad:** En producción, usa HTTPS y considera httpOnly cookies para los tokens
4. **CORS:** El backend acepta peticiones desde cualquier origen en desarrollo
5. **Errores de validación:** Revisa el array `errors` para mostrar mensajes específicos por campo

