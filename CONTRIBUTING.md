# Contributing to BroFinance Backend

Thank you for your interest in contributing to BroFinance! This document provides guidelines and best practices for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Project Structure](#project-structure)
- [REST API Best Practices](#rest-api-best-practices)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js >= 18.x
- MongoDB >= 6.x
- pnpm (recommended) or npm
- Git

### Setup

1. Fork the repository
2. Clone your fork:

   ```bash
   git clone https://github.com/your-username/bro-finances.git
   cd bro-finances/back
   ```

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Copy environment variables:

   ```bash
   cp .env.example .env.local
   ```

5. Start development server:
   ```bash
   pnpm dev
   ```

## Development Workflow

### Branch Naming

- `feature/` - New features (e.g., `feature/add-user-profile`)
- `fix/` - Bug fixes (e.g., `fix/auth-token-expiry`)
- `refactor/` - Code refactoring (e.g., `refactor/auth-service`)
- `docs/` - Documentation updates (e.g., `docs/api-endpoints`)

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(auth): add Google OAuth integration

fix(users): resolve balance calculation bug

docs(api): update authentication endpoints
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Define proper types and interfaces
- Avoid using `any` unless absolutely necessary
- Use `const` for immutable values, `let` for mutable

### File Organization

```
src/
├── modules/              # Feature modules
│   ├── auth/            # Authentication module
│   │   ├── auth.controllers.ts
│   │   ├── auth.services.ts
│   │   ├── auth.routes.ts
│   │   └── auth.route.validations.ts
│   └── usuarios/        # Users module
│       └── usuario.model.ts
├── middlewares/         # Global middlewares
├── utils/              # Utility functions
├── types/              # TypeScript types
└── settings/           # Configuration
```

### Naming Conventions

- **Files:** `camelCase.ts` (e.g., `auth.services.ts`)
- **Classes:** `PascalCase` (e.g., `UsuarioModel`)
- **Functions:** `camelCase` (e.g., `signInService`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `JWT_SECRET`)
- **Interfaces:** `IPascalCase` (e.g., `IUsuario`)
- **Types:** `PascalCase` (e.g., `AuthResponse`)

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add semicolons at the end of statements
- Maximum line length: 100 characters
- Add JSDoc comments for public functions

**Example:**

```typescript
/**
 * Sign in a user with email and password
 * @param email - User's email address
 * @param password - User's password
 * @returns User data and authentication tokens
 */
export const signInService = async (email: string, password: string): Promise<AuthResponse> => {
  // Implementation
};
```

## Project Structure

### Module Pattern

Each feature should be organized as a module with the following structure:

```
module-name/
├── module-name.model.ts        # Mongoose models
├── module-name.controllers.ts  # HTTP request handlers
├── module-name.services.ts     # Business logic
├── module-name.routes.ts       # Route definitions
└── module-name.validations.ts  # Zod validation schemas
```

### Separation of Concerns

- **Models:** Define database schemas and models
- **Controllers:** Handle HTTP requests and responses
- **Services:** Contain business logic
- **Routes:** Define API endpoints
- **Validations:** Define request validation schemas

## REST API Best Practices

### 1. Use Proper HTTP Methods

- `GET` - Retrieve resources
- `POST` - Create new resources
- `PUT` - Update entire resources
- `PATCH` - Partially update resources
- `DELETE` - Delete resources

### 2. Use Proper Status Codes

- `200 OK` - Successful GET, PUT, PATCH
- `201 Created` - Successful POST
- `204 No Content` - Successful DELETE
- `400 Bad Request` - Invalid request
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict
- `500 Internal Server Error` - Server error

### 3. Consistent Response Format

Always use the standard response format:

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}

// Error
{
  "success": false,
  "error": "Error message",
  "errors": [ ... ] // Optional validation errors
}
```

### 4. Use Custom Error Classes

```typescript
import { UnauthorizedError, NotFoundError } from '../utils/errors.ts';

// Instead of:
throw new Error('User not found');

// Use:
throw new NotFoundError('User not found');
```

### 5. Use asyncHandler for Controllers

```typescript
import { asyncHandler } from '../middlewares/errorHandler.ts';

// Wrap controllers with asyncHandler
router.get('/users', asyncHandler(getUsersController));
```

### 6. Validate Input Data

```typescript
import { z } from 'zod';

export const createUserSchema = {
  body: z.object({
    username: z.string().min(3),
    email: z.string().email(),
    password: z.string().min(5),
  }),
};
```

### 7. API Versioning

All routes should be under `/api/v1`:

```typescript
app.use('/api/v1', authRouter);
app.use('/api/v1', usersRouter);
```

## Testing

### Unit Tests

- Test individual functions and methods
- Mock external dependencies
- Use descriptive test names

### Integration Tests

- Test complete API endpoints
- Use a test database
- Clean up after each test

### Running Tests

```bash
pnpm test          # Run all tests
pnpm test:watch    # Run tests in watch mode
pnpm test:coverage # Generate coverage report
```

## Pull Request Process

### Before Submitting

1. **Update documentation** if you've changed APIs
2. **Add tests** for new features
3. **Run linter** and fix any issues:
   ```bash
   pnpm lint
   ```
4. **Ensure all tests pass**:
   ```bash
   pnpm test
   ```

### PR Description Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

Describe how you tested your changes

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated
- [ ] All tests passing
```

### Review Process

1. At least one maintainer must approve
2. All CI checks must pass
3. No merge conflicts
4. Branch is up to date with main

## Questions?

If you have questions, please:

1. Check existing documentation
2. Search existing issues
3. Create a new issue with the `question` label

Thank you for contributing! 🎉

