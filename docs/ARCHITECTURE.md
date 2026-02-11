# Architecture Documentation

## Overview

BroFinance backend is built using a **modular, layered architecture** following REST API best practices. The application is designed to be scalable, maintainable, and secure.

## Technology Stack

### Core

- **Runtime:** Node.js 18+
- **Language:** TypeScript
- **Framework:** Express.js 5.x
- **Database:** MongoDB with Mongoose ODM

### Security & Middleware

- **Authentication:** JWT (JSON Web Tokens)
- **Password Hashing:** bcrypt
- **Security Headers:** Helmet
- **CORS:** cors middleware
- **Rate Limiting:** express-rate-limit
- **Validation:** Zod

### Development

- **Package Manager:** pnpm
- **Environment Variables:** env-var
- **Logging:** morgan

## Architecture Patterns

### 1. Layered Architecture

The application follows a clear separation of concerns with distinct layers:

```
┌─────────────────────────────────────┐
│         HTTP Layer (Routes)         │  ← API endpoints
├─────────────────────────────────────┤
│      Controller Layer               │  ← Request/Response handling
├─────────────────────────────────────┤
│      Service Layer                  │  ← Business logic
├─────────────────────────────────────┤
│      Data Layer (Models)            │  ← Database interaction
└─────────────────────────────────────┘
```

**Benefits:**

- Clear separation of concerns
- Easy to test each layer independently
- Maintainable and scalable
- Follows Single Responsibility Principle

### 2. Module Pattern

Each feature is organized as a self-contained module:

```
auth/
├── auth.routes.ts        # HTTP routes
├── auth.controllers.ts   # Request handlers
├── auth.services.ts      # Business logic
├── auth.validations.ts   # Input validation
└── *.model.ts           # Data models (if needed)
```

**Benefits:**

- Feature-based organization
- Easy to locate related code
- Promotes code reusability
- Simplifies testing

### 3. Middleware Pipeline

Request processing follows a middleware pipeline:

```
Request
  ↓
Rate Limiting
  ↓
Body Parsing
  ↓
CORS
  ↓
Helmet (Security)
  ↓
Logging
  ↓
Route Matching
  ↓
Validation Middleware
  ↓
Authentication Middleware (if protected)
  ↓
Controller
  ↓
Service
  ↓
Model
  ↓
Response / Error Handler
```

## Directory Structure

```
back/
├── src/
│   ├── app.ts                    # Application entry point
│   ├── types/
│   │   └── index.ts             # TypeScript type definitions
│   ├── utils/
│   │   ├── errors.ts            # Custom error classes
│   │   └── response.ts          # Response utilities
│   ├── middlewares/
│   │   ├── authenticate.ts      # Authentication middleware
│   │   └── errorHandler.ts     # Global error handler
│   ├── modules/
│   │   ├── auth/                # Authentication module
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controllers.ts
│   │   │   ├── auth.services.ts
│   │   │   ├── auth.route.validations.ts
│   │   │   └── blacklistToken.model.ts
│   │   ├── usuarios/            # Users module
│   │   │   └── usuario.model.ts
│   │   ├── compras/             # Purchases module
│   │   │   └── compras.model.ts
│   │   └── middlewares/         # Module-specific middlewares
│   │       └── validateRoute.ts
│   └── settings/
│       ├── connectDb.ts         # Database connection
│       └── environments.ts      # Environment config
├── docs/
│   └── API.md                   # API documentation
├── .env.example                 # Environment template
├── package.json
└── README.md
```

## Core Components

### 1. Application Entry Point (app.ts)

Responsibilities:

- Initialize Express application
- Configure middleware
- Register routes
- Setup error handlers
- Connect to database
- Start server

### 2. Routes Layer

**Purpose:** Define API endpoints and map them to controllers

**Example:**

```typescript
router.post('/auth/local/sign-in', validateData(signInLocalSchema), asyncHandler(signInController));
```

**Best Practices:**

- Use descriptive route paths
- Apply appropriate middleware
- Document routes with comments
- Group related routes

### 3. Controllers Layer

**Purpose:** Handle HTTP requests and responses

**Responsibilities:**

- Extract data from request
- Call appropriate service
- Format and send response
- Handle errors

**Example:**

```typescript
export const signInController = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  const result = await signInService(email, password);
  sendSuccess(res, result, 'Signed in successfully');
};
```

**Best Practices:**

- Keep controllers thin
- Don't put business logic in controllers
- Use response utilities
- Throw custom errors

### 4. Services Layer

**Purpose:** Implement business logic

**Responsibilities:**

- Validate business rules
- Interact with models
- Perform calculations
- Handle complex operations

**Example:**

```typescript
export const signInService = async (email: string, password: string): Promise<AuthResponse> => {
  const user = await UsuarioModel.findOne({ email }, '+password');

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Business logic...

  return { user, tokens };
};
```

**Best Practices:**

- Pure functions when possible
- Throw custom errors
- Don't handle HTTP concerns
- Return typed data

### 5. Models Layer

**Purpose:** Define data schemas and interact with database

**Responsibilities:**

- Define Mongoose schemas
- Add validation rules
- Implement hooks (pre/post)
- Define instance methods

**Example:**

```typescript
const UsuarioSchema = new Schema<IUsuario>({
  username: {
    type: String,
    required: [true, 'Username is required'],
    minlength: [3, 'Username must be at least 3 characters'],
  },
  // ...
});

UsuarioSchema.pre<IUsuario>('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await genSalt(10);
  this.password = await hash(this.password, salt);
});
```

## Authentication Flow

### 1. Registration (Sign Up)

```
Client                    Server                    Database
  │                         │                          │
  ├─ POST /auth/sign-up ───→│                          │
  │                         ├─ Validate input          │
  │                         ├─ Check existing user ───→│
  │                         │←─ No user found ─────────┤
  │                         ├─ Hash password           │
  │                         ├─ Create user ───────────→│
  │                         │←─ User created ──────────┤
  │                         ├─ Generate tokens         │
  │←─ User + Tokens ────────┤                          │
```

### 2. Login (Sign In)

```
Client                    Server                    Database
  │                         │                          │
  ├─ POST /auth/sign-in ───→│                          │
  │                         ├─ Validate input          │
  │                         ├─ Find user ─────────────→│
  │                         │←─ User found ────────────┤
  │                         ├─ Verify password         │
  │                         ├─ Generate tokens         │
  │←─ User + Tokens ────────┤                          │
```

### 3. Protected Request

```
Client                    Server                    Database
  │                         │                          │
  ├─ GET /auth/me ─────────→│                          │
  │  (with tokens)          ├─ Verify access token     │
  │                         ├─ If expired:             │
  │                         │   - Verify refresh token │
  │                         │   - Generate new access  │
  │                         ├─ Find user ─────────────→│
  │                         │←─ User found ────────────┤
  │←─ User data ────────────┤                          │
  │  (+ new access token)   │                          │
```

### 4. Logout (Sign Out)

```
Client                    Server                    Database
  │                         │                          │
  ├─ POST /auth/sign-out ──→│                          │
  │  (with tokens)          ├─ Verify tokens           │
  │                         ├─ Blacklist refresh ─────→│
  │                         │←─ Token blacklisted ─────┤
  │←─ Success ──────────────┤                          │
```

## Token Management

### Access Token

- **Purpose:** Authenticate API requests
- **Lifetime:** 15 minutes
- **Storage:** Client-side (memory/localStorage)
- **Transmission:** `Authorization: Bearer <token>`

### Refresh Token

- **Purpose:** Generate new access tokens
- **Lifetime:** 30 days
- **Storage:** Client-side (httpOnly cookie recommended)
- **Transmission:** `x-refresh-token: Bearer <token>`
- **Blacklist:** On logout

### Token Refresh Strategy

1. Client sends both tokens with each request
2. Server verifies access token
3. If expired:
   - Verify refresh token
   - Generate new access token
   - Return new token in response
4. Client updates stored access token

## Error Handling

### Error Hierarchy

```
Error
  └── AppError (base custom error)
      ├── BadRequestError (400)
      ├── UnauthorizedError (401)
      ├── ForbiddenError (403)
      ├── NotFoundError (404)
      ├── ConflictError (409)
      └── InternalServerError (500)
```

### Error Flow

```
Controller/Service
  │
  ├─ Throw custom error
  │
  ↓
asyncHandler
  │
  ├─ Catch error
  ├─ Pass to next()
  │
  ↓
Global Error Handler
  │
  ├─ Identify error type
  ├─ Format response
  ├─ Log error
  │
  ↓
Client receives error response
```

## Security Measures

### 1. Authentication

- JWT-based authentication
- Secure password hashing (bcrypt)
- Token expiration
- Refresh token rotation

### 2. Input Validation

- Zod schema validation
- Request sanitization
- Type checking

### 3. HTTP Security

- Helmet middleware (security headers)
- CORS configuration
- Rate limiting
- Request size limits

### 4. Database Security

- Mongoose schema validation
- Password field exclusion (select: false)
- Input sanitization

### 5. Error Handling

- No sensitive data in errors
- Consistent error format
- Proper status codes

## Performance Considerations

### 1. Database

- Indexes on frequently queried fields
- Lean queries when possible
- Connection pooling (Mongoose default)

### 2. Caching

- Consider Redis for session storage
- Cache frequently accessed data
- Implement cache invalidation

### 3. Rate Limiting

- Protect against DDoS
- Per-IP limits
- Configurable thresholds

## Scalability

### Horizontal Scaling

- Stateless authentication (JWT)
- No server-side sessions
- Database connection pooling

### Vertical Scaling

- Efficient queries
- Minimal middleware
- Async/await patterns

## Future Enhancements

### Short Term

- [ ] Add unit and integration tests
- [ ] Implement refresh token rotation
- [ ] Add request logging
- [ ] Implement API documentation (Swagger/OpenAPI)

### Medium Term

- [ ] Add Redis for caching
- [ ] Implement WebSocket support
- [ ] Add file upload functionality
- [ ] Implement email verification

### Long Term

- [ ] Microservices architecture
- [ ] GraphQL API
- [ ] Real-time notifications
- [ ] Advanced analytics

## Monitoring & Logging

### Recommended Tools

- **Application Monitoring:** PM2, New Relic
- **Error Tracking:** Sentry
- **Logging:** Winston, Pino
- **Database Monitoring:** MongoDB Atlas

### Metrics to Track

- Request rate
- Response time
- Error rate
- Database query performance
- Memory usage
- CPU usage

## Deployment

### Environment Setup

1. Set environment variables
2. Configure database connection
3. Set up reverse proxy (nginx)
4. Enable HTTPS
5. Configure firewall

### Recommended Platforms

- **Cloud:** AWS, Google Cloud, Azure
- **PaaS:** Heroku, Railway, Render
- **Database:** MongoDB Atlas

## Conclusion

This architecture provides a solid foundation for a scalable, maintainable REST API. It follows industry best practices and can be extended to support future requirements.

