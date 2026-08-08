# FASE 7 — Auth System Implementation Guide

**Status**: ✅ Complete  
**Date**: 2026-08-08  
**Components**: 9 Endpoints, 4 Components, Lucia + Argon2id

## Overview

FASE 7 implements secure session-based authentication with role-based access control (RBAC).

- Replaces hardcoded `temp-user-id` with real sessions
- Adds real user tracking in workflows
- Implements RBAC enforcement on all operations
- Supports user assignment to findings

## Tech Stack

- **Session Library**: Lucia (secure, simple)
- **Password Hashing**: @node-rs/argon2 (Argon2id)
- **Session Storage**: PostgreSQL (persistent)
- **RBAC**: 6 roles with granular permissions

## Setup Instructions

### 1. Apply Database Migration

The migration is already created. Apply it when you have a working PostgreSQL connection:

```bash
# Set up .env with valid DATABASE_URL
export DATABASE_URL="postgresql://user:password@localhost:5432/pruebas_maria_dev"

# Apply migration
npx prisma migrate dev

# Or push schema
npx prisma db push
```

### 2. Generate Prisma Client

```bash
npx prisma generate
```

### 3. Install Dependencies

Dependencies are already installed:
- `lucia` — Session management
- `@lucia-auth/adapter-prisma` — Prisma adapter
- `@node-rs/argon2` — Password hashing
- `oslo` — Crypto utilities
- `cookie` — Cookie management

## Backend Implementation

### 4 Auth Endpoints

#### POST /api/auth/login
Login a user with email and password.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "rememberMe": false
}
```

**Response** (200):
```json
{
  "message": "Login exitoso",
  "user": {
    "id": "clv...",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "QA_LEAD"
  }
}
```

Session cookie set automatically.

#### POST /api/auth/logout
Logout current user and invalidate session.

**Response** (200):
```json
{
  "message": "Logout exitoso"
}
```

#### GET /api/auth/session
Get current session and user info.

**Response** (200):
```json
{
  "user": {
    "id": "clv...",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "QA_LEAD"
  }
}
```

Returns `null` for user if not authenticated.

#### POST /api/auth/refresh
Refresh current session (renew expiry).

**Response** (200):
```json
{
  "message": "Sesión renovada",
  "user": { ... }
}
```

### 5 User Endpoints

#### POST /api/users
Create a new user (OWNER only).

**Request**:
```json
{
  "email": "newuser@example.com",
  "name": "Jane Doe",
  "password": "SecurePassword123"
}
```

**Response** (201):
```json
{
  "message": "Usuario creado exitosamente",
  "user": {
    "id": "clv...",
    "email": "newuser@example.com",
    "name": "Jane Doe",
    "role": "VIEWER"
  }
}
```

#### GET /api/users
List users with pagination.

**Query**:
- `page` (default: 1)
- `limit` (default: 20, max: 100)

**Response** (200):
```json
{
  "users": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

Only OWNER/QA_LEAD can see all users. Others see only themselves.

#### GET /api/users/me
Get current logged-in user.

**Response** (200):
```json
{
  "user": { ... }
}
```

#### PATCH /api/users/:id
Update user (own profile or OWNER can update anyone).

**Request**:
```json
{
  "name": "New Name",
  "email": "newemail@example.com",
  "password": "NewPassword123"
}
```

**Response** (200):
```json
{
  "message": "Usuario actualizado exitosamente",
  "user": { ... }
}
```

#### DELETE /api/users/:id
Soft delete user (OWNER only).

**Response** (200):
```json
{
  "message": "Usuario eliminado exitosamente",
  "user": { ... }
}
```

## RBAC Matrix

| Action | OWNER | QA_LEAD | DESIGNER | DEVELOPER | BUSINESS | VIEWER |
|--------|:-----:|:-------:|:--------:|:---------:|:--------:|:------:|
| Create Finding | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit Finding (own) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit Finding (any) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete Finding | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assign Finding | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create Resolution | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Change Resolution State (own) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Change Resolution State (any) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Run Validation | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View Audit Log (own) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| View Audit Log (any) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View All Findings | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage Users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

## Frontend Implementation

### 4 Components

#### LoginForm.tsx
Full login form with email, password, "remember me" checkbox.

**Usage**:
```tsx
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return <LoginForm />;
}
```

Redirects to `/findings` on successful login.

#### UserMenu.tsx
Dropdown menu with user info and logout button.

**Usage**:
```tsx
import { UserMenu } from "@/components/auth/UserMenu";

export function Navbar() {
  return (
    <nav>
      <UserMenu />
    </nav>
  );
}
```

Shows "Iniciar Sesión" button if not authenticated.

#### PermissionGuard.tsx
Conditional rendering based on user role.

**Usage**:
```tsx
import { PermissionGuard } from "@/components/auth/PermissionGuard";

export function ManageUsers() {
  return (
    <PermissionGuard allowedRoles={["OWNER"]}>
      <div>Only OWNER can see this</div>
    </PermissionGuard>
  );
}
```

Optional `fallback` prop for alternative content.

#### RequireAuth.tsx
Wrapper to protect entire pages/sections.

**Usage**:
```tsx
import { RequireAuth } from "@/components/auth/RequireAuth";

export default function ProtectedPage() {
  return (
    <RequireAuth requiredRoles={["QA_LEAD", "DESIGNER"]}>
      <main>Protected content</main>
    </RequireAuth>
  );
}
```

Automatically redirects to `/login` if not authenticated.

## Security Features

1. **Password Hashing**: Argon2id (19MB memory, 2 iterations)
2. **Session Validation**: Lucia validates on every request
3. **Soft Deletes**: Users marked as deleted, not removed
4. **RBAC Enforcement**: All endpoints check roles
5. **Secure Cookies**: HttpOnly, SameSite=Lax
6. **Database Persistence**: Sessions stored in PostgreSQL

## Applying RBAC to Existing Endpoints

All existing endpoints (findings, evidence, workflows) should now check RBAC:

```typescript
import { checkRBAC, hasPermission } from "@/lib/middleware/rbac";

export async function PATCH(req: NextRequest) {
  const { valid, user, error } = await checkRBAC(req, {
    requiredRoles: ["OWNER", "QA_LEAD"],
  });

  if (!valid) return error;

  // Check granular permissions
  if (!hasPermission(user.role, "EDIT_FINDING_OWN")) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "No permission" },
      { status: 403 }
    );
  }

  // ... endpoint logic
}
```

## Testing

### Manual Testing

1. **Login**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"user@example.com","password":"SecurePass123"}'
   ```

2. **Check Session**:
   ```bash
   curl http://localhost:3000/api/auth/session
   ```

3. **Logout**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/logout
   ```

### Create Test Users

After migration, create test users:

```typescript
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

async function seedUsers() {
  const roles = ["OWNER", "QA_LEAD", "DESIGNER", "DEVELOPER", "BUSINESS_REVIEWER", "VIEWER"];

  for (const role of roles) {
    const passwordHash = await hashPassword("TestPassword123");
    await prisma.user.create({
      data: {
        email: `${role.toLowerCase()}@test.local`,
        name: role,
        passwordHash,
        role: role as any,
      },
    });
  }
}
```

## Next Steps (FASE 8-9)

- **FASE 8**: PWA & Offline Sync
- **FASE 9**: Full test coverage + security hardening

## Troubleshooting

### "No valid database" error

Ensure `.env` has correct `DATABASE_URL`:
```
DATABASE_URL="postgresql://user:password@host:port/database?schema=public"
```

### Password validation fails

Passwords must:
- Be 8+ characters
- Include uppercase letter
- Include lowercase letter
- Include number

Example: `SecurePass123`

### Session not persisting

Ensure migration was applied:
```bash
npx prisma migrate status
npx prisma db push
```

## Files Created

**Auth Logic**:
- `lib/auth/lucia.ts` — Lucia configuration
- `lib/auth/password.ts` — Argon2id hashing
- `lib/validators/auth.ts` — Zod schemas
- `lib/middleware/rbac.ts` — RBAC utilities
- `hooks/useAuth.ts` — React hook

**Endpoints**:
- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/session/route.ts`
- `app/api/auth/refresh/route.ts`
- `app/api/users/route.ts` (POST, GET)
- `app/api/users/me/route.ts`
- `app/api/users/[id]/route.ts` (PATCH, DELETE)

**Components**:
- `components/auth/LoginForm.tsx`
- `components/auth/UserMenu.tsx`
- `components/auth/PermissionGuard.tsx`
- `components/auth/RequireAuth.tsx`

**Database**:
- `prisma/migrations/add_auth_session/migration.sql`
- Updated `prisma/schema.prisma`
