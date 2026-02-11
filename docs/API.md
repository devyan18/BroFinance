# API Documentation - BroFinance

## Base URL

```
Development: http://localhost:4000/api/v1
Production: https://your-domain.com/api/v1
```

## Authentication

All protected endpoints require authentication using JWT tokens. Include the following headers:

```
Authorization: Bearer <access_token>
x-refresh-token: Bearer <refresh_token>
```

## Response Format

All API responses follow this standard format:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "errors": [
    // Optional validation errors
    {
      "path": "field.name",
      "message": "Validation error message"
    }
  ]
}
```

## HTTP Status Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required or failed
- `403 Forbidden` - Authenticated but not authorized
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

## Endpoints

### Health Check

#### GET /health

Check if the server is running.

**Access:** Public

**Response:**

```json
{
  "success": true,
  "message": "Server is healthy",
  "timestamp": "2026-02-10T14:00:00.000Z"
}
```

---

### Authentication

#### POST /auth/local/sign-up

Register a new user with email and password.

**Access:** Public

**Request Body:**

```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Validation:**

- `username`: string, min 3 characters
- `email`: valid email format
- `password`: string, min 5 characters

**Success Response (201):**

```json
{
  "success": true,
  "data": {
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
  },
  "message": "User registered successfully"
}
```

**Error Response (409):**

```json
{
  "success": false,
  "error": "Email already in use"
}
```

---

#### POST /auth/local/sign-in

Sign in with email and password.

**Access:** Public

**Request Body:**

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Validation:**

- `email`: valid email format
- `password`: string, min 5 characters

**Success Response (200):**

```json
{
  "success": true,
  "data": {
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
  },
  "message": "Signed in successfully"
}
```

**Error Response (401):**

```json
{
  "success": false,
  "error": "Invalid email or password"
}
```

---

#### POST /auth/refresh

Refresh the access token using a refresh token.

**Access:** Public

**Headers:**

```
x-refresh-token: Bearer <refresh_token>
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Token refreshed successfully"
}
```

**Error Response (401):**

```json
{
  "success": false,
  "error": "Refresh token has been revoked"
}
```

---

#### POST /auth/sign-out

Sign out and blacklist the refresh token.

**Access:** Private (requires authentication)

**Headers:**

```
Authorization: Bearer <access_token>
x-refresh-token: Bearer <refresh_token>
```

**Success Response (200):**

```json
{
  "success": true,
  "data": null,
  "message": "Signed out successfully"
}
```

---

#### GET /auth/me

Get the current authenticated user's information.

**Access:** Private (requires authentication)

**Headers:**

```
Authorization: Bearer <access_token>
x-refresh-token: Bearer <refresh_token>
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
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
}
```

**Error Response (404):**

```json
{
  "success": false,
  "error": "User not found"
}
```

---

## Token Management

### Access Token

- **Lifetime:** 15 minutes
- **Usage:** Include in `Authorization` header for all protected endpoints
- **Format:** `Bearer <token>`

### Refresh Token

- **Lifetime:** 30 days
- **Usage:** Include in `x-refresh-token` header to refresh expired access tokens
- **Format:** `Bearer <token>`
- **Note:** Blacklisted on sign-out

### Automatic Token Refresh

The authentication middleware automatically refreshes the access token if it has expired. When this happens:

1. The new access token is returned in the response
2. The client should update the stored access token
3. The refresh token remains the same

---

## Rate Limiting

- **Limit:** 500 requests per IP address
- **Window:** 15 minutes
- **Response when exceeded:**

```json
{
  "success": false,
  "error": "Too many requests, please try again later"
}
```

---

## Error Handling

### Validation Errors

When request data fails validation:

```json
{
  "success": false,
  "error": "Validation failed",
  "errors": [
    {
      "path": "email",
      "message": "El correo electrónico no es válido"
    },
    {
      "path": "password",
      "message": "La contraseña debe tener al menos 5 caracteres"
    }
  ]
}
```

### Common Errors

| Error                 | Status Code | Description                                     |
| --------------------- | ----------- | ----------------------------------------------- |
| Invalid token         | 401         | JWT token is invalid or malformed               |
| Token expired         | 401         | JWT token has expired                           |
| Unauthorized          | 401         | Authentication required                         |
| Not Found             | 404         | Resource doesn't exist                          |
| Conflict              | 409         | Resource already exists (e.g., duplicate email) |
| Validation failed     | 400         | Request data doesn't meet requirements          |
| Internal Server Error | 500         | Unexpected server error                         |

---

## Security Best Practices

### For Clients

1. **Store tokens securely**
   - Use `httpOnly` cookies or secure storage
   - Never store in localStorage for production apps

2. **Handle token refresh**
   - Implement automatic token refresh logic
   - Update stored tokens when new ones are received

3. **Handle errors gracefully**
   - Redirect to login on 401 errors
   - Show user-friendly error messages

4. **Use HTTPS**
   - Always use HTTPS in production
   - Never send tokens over HTTP

### For Server

1. **Environment Variables**
   - Use strong, random `JWT_SECRET`
   - Configure `CORS_ORIGIN` to specific domains

2. **Rate Limiting**
   - Adjust limits based on your needs
   - Consider stricter limits for auth endpoints

3. **Monitoring**
   - Log failed authentication attempts
   - Monitor for suspicious activity

---

## Examples

### cURL Examples

**Sign Up:**

```bash
curl -X POST http://localhost:4000/api/v1/auth/local/sign-up \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Sign In:**

```bash
curl -X POST http://localhost:4000/api/v1/auth/local/sign-in \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Get Current User:**

```bash
curl -X GET http://localhost:4000/api/v1/auth/me \
  -H "Authorization: Bearer <access_token>" \
  -H "x-refresh-token: Bearer <refresh_token>"
```

**Sign Out:**

```bash
curl -X POST http://localhost:4000/api/v1/auth/sign-out \
  -H "Authorization: Bearer <access_token>" \
  -H "x-refresh-token: Bearer <refresh_token>"
```

### JavaScript/TypeScript Examples

**Sign Up:**

```typescript
const response = await fetch('http://localhost:4000/api/v1/auth/local/sign-up', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
  }),
});

const data = await response.json();
if (data.success) {
  // Store tokens
  localStorage.setItem('accessToken', data.data.tokens.accessToken);
  localStorage.setItem('refreshToken', data.data.tokens.refreshToken);
}
```

**Authenticated Request:**

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
```

---

## Changelog

### v1.0.0 (2026-02-10)

- Initial API release
- Authentication endpoints (sign-up, sign-in, sign-out, me)
- JWT token-based authentication
- Automatic token refresh
- Rate limiting
- Comprehensive error handling
- API versioning (v1)

