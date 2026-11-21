# Secure Notes API (Backend)

A production-grade, API-only REST backend service built with Node.js, Express, and MongoDB/Mongoose. Features JWT authentication, role-based access control (RBAC), owner-scoped notes, and optimized MongoDB aggregation pipelines with a minimal indexing strategy.

- **GitHub Repository**: [https://github.com/ZamanAsad007/secure-notes-backend](https://github.com/ZamanAsad007/secure-notes-backend)
- **Live API Endpoint**: `https://YOUR-API.onrender.com` (Render Web Service)
- **Frontend Repository**: [https://github.com/ZamanAsad007/secure-notes-frontend](https://github.com/ZamanAsad007/secure-notes-frontend)
- **Live Frontend Application**: `https://YOUR-APP.vercel.app` (Vercel)

> **Render Free Tier Note**: Free Render web services spin down after periods of inactivity. If the service is sleeping, the first request may take 30–60 seconds to complete while the container boots up.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js (>=18.x)
- **Framework**: Express 4.x
- **Database**: MongoDB with Mongoose 9.x
- **Authentication**: JSON Web Tokens (`jsonwebtoken` with HS256)
- **Password Security**: `bcryptjs` (Cost factor 12)
- **Security & Middleware**: `helmet`, `cors`, `zod` input validation schemas

---

## 🔒 Security Architecture

| Security Domain | Implementation Details |
| :--- | :--- |
| **Authentication** | JSON Web Tokens (JWT) signed with pinned `HS256` algorithm; verified on all authenticated routes via Bearer token. |
| **Password Security** | Passwords hashed using `bcryptjs` with cost factor 12; `passwordHash` field has `select: false` in Mongoose schema to prevent accidental leaks. |
| **Authorization (RBAC)** | Role distinction (`user` vs `admin`). Administrative endpoints enforce `authorize('admin')` middleware, rejecting unauthorized requests with HTTP 403 Forbidden. |
| **Owner Scoping** | Regular users can only read, update, or delete notes they own. Admins can view all notes for auditing, but cannot edit or delete notes belonging to other users. |
| **Security Headers** | Hardened with `helmet` middleware setting strict Content Security Policy, X-Frame-Options, DNS prefetch control, and HSTS headers. |
| **CORS Policy** | Whitelist-based CORS allowing requests from `CLIENT_URL` (e.g. Vercel deployment) and local `http://localhost:5173`. Non-browser API tools (Postman, curl) are permitted. |
| **Payload Limiting** | Express JSON body parser strictly capped at `100kb` to protect against DoS attacks. |
| **Input Validation** | Request payloads validated using `zod` schemas before hitting controllers. |
| **Secret Isolation** | Fail-fast validation crashes the server on bootstrap if secrets are missing or `JWT_SECRET` is shorter than 32 characters. |

---

## ⚡ MongoDB Minimal Indexing Strategy

The database uses **exactly 4 custom indexes** to maintain maximum write throughput and minimize index memory footprint:

| # | Collection | Custom Index Definition | Type | Target Application Query | Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `User` | `{ email: 1 }` (unique: true) | Unique B-Tree | `User.findOne({ email })` | Enforces email uniqueness and provides $O(1)$ fast lookup during registration and login. |
| **2** | `User` | `{ interests: 1 }` | Multikey | `User.aggregate([{ $match: { interests } }, ...])` | Optimizes Scenario 1 directory queries filtering community members by interest tag. |
| **3** | `Note` | `{ owner: 1, _id: -1 }` | Compound | `Note.find({ owner }).sort({ _id: -1 })` | Satisfies Equality-Sort-Range (ESR) rule for owner-scoped note listing and cursor pagination with zero in-memory sort. |
| **4** | `Post` | `{ author: 1, _id: -1 }` | Compound | `Post.find({ author }).sort({ _id: -1 })` | Supports Scenario 2 user posts timeline aggregation and pagination with zero in-memory sort. |

Verify indexes against your active database:
```bash
npm run check:indexes
```

---

## 📊 Aggregation Pipelines

### Scenario 1: Users by Interests (`GET /api/users/by-interests`)
Groups all users by distinct interests using a single `User.aggregate()` pipeline:
- **Filtering**: Optional `$match` stage using index #2 (`interests_1`).
- **Unwinding**: `$unwind: '$interests'` normalizes interest arrays into individual stream items.
- **Grouping**: `$group: { _id: '$interests', count: { $sum: 1 }, users: { $push: ... } }`.
- **Pagination**: Single `$facet` stage computes both total interest categories count and paginated items in one roundtrip.

### Scenario 2: Posts by User (`GET /api/users/:id/posts`)
Performs a single-pipeline lookup from the `users` collection to `posts`:
- **Identity Check**: Matches user by `_id`, email, or name.
- **Lookup Pipeline**: Joins `posts` matching `author: $$userId`, sorted by `_id: -1` (using compound index #4 `author_1__id_-1`), with `skip` and `limit: limit + 1`.
- **Cursor Pagination**: Inspects `posts.length > limit` to determine `hasMore: true/false` without running an expensive `$count` aggregation over the posts collection.

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/secure_notes?retryWrites=true&w=majority
JWT_SECRET=your_32_character_long_secret_key_here
JWT_EXPIRES_IN=7d
ADMIN_NAME=Admin User
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=AdminSecurePassword123!
BCRYPT_ROUNDS=12
```

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Optional | `5000` | Port for the HTTP server |
| `CLIENT_URL` | Optional | `""` | Comma-separated allowed frontend origins for CORS |
| `MONGODB_URI` | **Required** | — | MongoDB connection string (Atlas or local) |
| `JWT_SECRET` | **Required** | — | Secret key for JWT signing (>= 32 chars) |
| `JWT_EXPIRES_IN`| Optional | `1h` | Expiration time for JWT tokens |
| `BCRYPT_ROUNDS` | Optional | `12` | Salt rounds for bcrypt hashing |
| `ADMIN_NAME` | Optional | `Admin` | Initial admin account name for seed scripts |
| `ADMIN_EMAIL` | Optional | `admin@example.com` | Initial admin email address for seed scripts |
| `ADMIN_PASSWORD`| Optional | — | Initial admin password for seed scripts |

---

## 🚀 Local Setup & Installation

### 1. Clone & Install
```bash
git clone https://github.com/ZamanAsad007/secure-notes-backend.git
cd secure-notes-backend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your MongoDB Atlas URI and secrets
```

### 3. Seed Database
```bash
# Seed initial admin account
npm run seed:admin

# Seed sample users, notes, and posts
npm run seed:data
```

### 4. Run Automated Tests
```bash
# Executes both index verification and 25-step end-to-end integration test
npm test
```

### 5. Run Server
```bash
# Production start
npm start

# Development mode with nodemon
npm run dev
```

---

## 🔑 Demo Credentials

After running `npm run seed:data`:

| Role | Email | Password | Clearance |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@example.com` | `AdminSecurePassword123!` | Full admin audit, user management, and interest directories |
| **User** | `alice@example.com` | `Password123!` | Owner-scoped notes and timeline author |
| **User** | `bob@example.com` | `Password123!` | Owner-scoped notes and timeline author |

---

## 📡 REST API Reference

### Health Checks
- `GET /` — Returns `{ status: "ok" }`
- `GET /api/health` — Returns `{ status: "ok" }`

### Authentication
| Method | Endpoint | Clearance | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register new user account (`name`, `email`, `password`, `interests`). |
| `POST` | `/api/auth/login` | Public | Authenticate with credentials and receive signed JWT. |

### Notes (Vault)
| Method | Endpoint | Clearance | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/notes` | User / Admin | List notes with pagination. Regular users see only their notes; Admins see all notes or filter by `?owner=<id>` or `?owner=me`. |
| `POST` | `/api/notes` | User / Admin | Create a new note owned by authenticated user (`title`, `content`). |
| `GET` | `/api/notes/:id` | User / Admin | Retrieve a specific note by ID (owner-scoped or admin read). |
| `PATCH` | `/api/notes/:id` | Owner Only | Update note title and/or content (only the note owner can modify). |
| `DELETE` | `/api/notes/:id` | Owner Only | Permanently delete note (only the note owner can delete). |

### Users & Directory
| Method | Endpoint | Clearance | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users/me` | Authenticated | Retrieve profile information for the authenticated user. |
| `PATCH` | `/api/users/me` | Authenticated | Update authenticated user's name and/or interests array. |
| `GET` | `/api/users` | Admin Only | List all registered users with pagination and optional `?role=` filter. |
| `POST` | `/api/users` | Admin Only | Create a new user with assigned role (`user` or `admin`). |
| `GET` | `/api/users/:id` | Self or Admin | Profile by ID. |
| `PATCH` | `/api/users/:id` | Admin Only | Update a user's name, role, or interests. |
| `DELETE` | `/api/users/:id` | Admin Only | Delete user account and cascade delete their notes and posts (prevents self-deletion). |
| `GET` | `/api/users/by-interests` | Admin Only | Scenario 1: Group users by interests with single aggregation pipeline (`?interest=`, `?page=`, `?limit=`). |

### Posts (Timeline)
| Method | Endpoint | Clearance | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/posts` | Authenticated | Publish a public timeline post (`title`, `content`). |
| `GET` | `/api/posts/authors` | Authenticated | Discover active community authors with names, emails, and post counts. |
| `GET` | `/api/users/:id/posts` | Authenticated | Scenario 2: Aggregated posts lookup by user with `hasMore` cursor pagination (`?page=`, `?limit=`). Accepts ObjectId, email, or author name. |
