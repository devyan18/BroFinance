# Quick Start Guide - BroFinance Backend

Get up and running with the BroFinance backend in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- MongoDB 6+ running locally or MongoDB Atlas account
- pnpm installed (or npm)

## Installation

### 1. Install Dependencies

```bash
cd back
pnpm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://localhost:27017/bro-finances
JWT_SECRET=your-super-secret-jwt-key-change-this
CORS_ORIGIN=http://localhost:3000
```

### 3. Start the Server

```bash
pnpm dev
```

You should see:

```
🚀 Server running on port 4000
📝 Environment: development
🔗 API Base URL: http://localhost:4000/api/v1
Connected to MongoDB: bro-finances
```

## Test the API

### 1. Health Check

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{
  "success": true,
  "message": "Server is healthy",
  "timestamp": "2026-02-10T14:00:00.000Z"
}
```

### 2. Register a User

```bash
curl -X POST http://localhost:4000/api/v1/auth/local/sign-up \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

Expected response:

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "...",
      "username": "testuser",
      "email": "test@example.com",
      "provider": ["local"],
      "balance": 0,
      "createdAt": "...",
      "updatedAt": "..."
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  },
  "message": "User registered successfully"
}
```

**Save the tokens!** You'll need them for authenticated requests.

### 3. Get Current User

Replace `<access_token>` and `<refresh_token>` with the tokens from step 2:

```bash
curl http://localhost:4000/api/v1/auth/me \
  -H "Authorization: Bearer <access_token>" \
  -H "x-refresh-token: Bearer <refresh_token>"
```

Expected response:

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "...",
      "username": "testuser",
      "email": "test@example.com",
      "provider": ["local"],
      "balance": 0,
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
}
```

## Available Endpoints

| Method | Endpoint                     | Description      | Auth Required |
| ------ | ---------------------------- | ---------------- | ------------- |
| GET    | `/health`                    | Health check     | No            |
| POST   | `/api/v1/auth/local/sign-up` | Register user    | No            |
| POST   | `/api/v1/auth/local/sign-in` | Login user       | No            |
| POST   | `/api/v1/auth/refresh`       | Refresh token    | No            |
| GET    | `/api/v1/auth/me`            | Get current user | Yes           |
| POST   | `/api/v1/auth/sign-out`      | Logout user      | Yes           |

## Project Structure

```
back/
├── src/
│   ├── app.ts                    # Main application
│   ├── types/                    # TypeScript types
│   ├── utils/                    # Utilities
│   ├── middlewares/              # Global middlewares
│   ├── modules/                  # Feature modules
│   │   ├── auth/                # Authentication
│   │   ├── usuarios/            # Users
│   │   └── compras/             # Purchases
│   └── settings/                # Configuration
├── docs/                         # Documentation
├── .env.example                  # Environment template
└── package.json
```

## Common Commands

```bash
# Development
pnpm dev              # Start dev server with hot reload

# Production
pnpm build            # Build TypeScript
pnpm start            # Start production server

# Other
pnpm lint             # Run linter (not configured yet)
pnpm test             # Run tests (not configured yet)
```

## Troubleshooting

### MongoDB Connection Error

**Problem:** `Error connecting to MongoDB`

**Solution:**

1. Make sure MongoDB is running
2. Check your `MONGODB_URI` in `.env.local`
3. For local MongoDB: `mongodb://localhost:27017/bro-finances`
4. For MongoDB Atlas: Use your connection string

### Port Already in Use

**Problem:** `Error: listen EADDRINUSE: address already in use :::4000`

**Solution:**

1. Change `PORT` in `.env.local` to another port (e.g., 4001)
2. Or kill the process using port 4000:
   ```bash
   lsof -ti:4000 | xargs kill
   ```

### JWT Secret Error

**Problem:** `JWT_SECRET is required`

**Solution:**

1. Make sure `.env.local` exists
2. Add `JWT_SECRET=your-secret-key` to `.env.local`

## Next Steps

1. **Read the documentation:**
   - [README.md](../README.md) - Complete project documentation
   - [API.md](./API.md) - Detailed API documentation
   - [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture

2. **Explore the code:**
   - Start with `src/app.ts`
   - Check out `src/modules/auth/`
   - Review the middleware in `src/middlewares/`

3. **Test with a client:**
   - Use Postman or Insomnia
   - Build a frontend application
   - Try the cURL examples in the docs

4. **Contribute:**
   - Read [CONTRIBUTING.md](../CONTRIBUTING.md)
   - Check open issues
   - Submit a pull request

## Need Help?

- Check the [README.md](../README.md) for detailed documentation
- Review [API.md](./API.md) for endpoint specifications
- Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- Open an issue on GitHub

---

**Happy coding! 🚀**

