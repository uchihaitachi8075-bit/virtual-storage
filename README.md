# Storage Server

A self-hosted personal file storage server (Google Drive/Dropbox style) —
Node.js + Express + PostgreSQL, built to run on your laptop first and be
deployable to a VPS later.

## 1. Prerequisites

- Node.js v18+ (`node -v` to check)
- PostgreSQL installed and running locally
  - Windows/Mac: install Postgres.app or the official installer
  - Linux: `sudo apt install postgresql`

## 2. Project setup

```bash
cd storage-server
npm install
```

Create the database (run once):

```bash
# opens the psql shell
psql -U postgres
```
Inside the `psql` prompt:
```sql
CREATE DATABASE storage_server;
\q
```

Load the schema (tables):

```bash
psql -U postgres -d storage_server -f sql/schema.sql
```

Create your `.env` file from the example and fill in your real Postgres
password:

```bash
cp .env.example .env
```

## 3. Run it

```bash
npm run dev
```

You should see:
```
Storage server running at http://localhost:4000
Health check: http://localhost:4000/health
```

## 4. Try the API (using curl)

**Sign up:**
```bash
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"password123"}'
```
This returns an `accessToken` — copy it, you'll need it for every request below.

**Log in** (once you already have an account):
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"password123"}'
```

**Upload a file (simple, single-request upload):**
```bash
curl -X POST http://localhost:4000/files/upload \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "file=@/path/to/some-file.pdf"
```

**List your files:**
```bash
curl http://localhost:4000/files \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Download a file:**
```bash
curl http://localhost:4000/files/1/download \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -o downloaded-file.pdf
```

**Delete a file:**
```bash
curl -X DELETE http://localhost:4000/files/1 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Check your storage usage:**
```bash
curl http://localhost:4000/user/storage-usage \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Create a shareable link for a file:**
```bash
curl -X POST http://localhost:4000/files/1/share \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```
Anyone can then download it at `http://localhost:4000/share/<token>` — no
login required. Revoke it with `DELETE /files/1/share`.

## 5. Using the built-in web UI (recommended for everyday use)

Instead of curl, just open your browser and go to:

```
http://localhost:4000
```

You'll see a simple file manager: sign up / log in, then use **Upload files**
(opens your Mac's native file picker — Finder), **New folder**, and per-file
**Download / Share / Delete** buttons. It talks to the same API described
above, so both can be used interchangeably.

Note: folders in this app are "virtual" — they only really exist once a file
has been uploaded into them. Clicking "New folder" pins an empty folder in
your browser's local storage so it stays visible until you put a file in it.

## 6. Chunked / resumable upload (for big files)

Instead of `/files/upload`, use this 3-step flow — useful once files get
large enough that you'd want to resume an interrupted upload rather than
start over:

1. `POST /files/upload/init` → `{ "uploadId": "..." }`
2. For each chunk (e.g. split the file into 5MB pieces client-side):
   `POST /files/upload/chunk/:uploadId` with form fields `chunk` (the binary
   piece) and `chunkIndex` (0, 1, 2, ...)
3. Once every chunk is sent:
   `POST /files/upload/complete/:uploadId` with JSON body
   `{ "originalName": "movie.mp4", "totalChunks": 12, "mimeType": "video/mp4" }`

If the connection drops mid-upload, call
`GET /files/upload/status/:uploadId` — it returns the list of chunk indexes
already saved, so the client only needs to resend the missing ones.

## 6. Project structure

```
src/
  config/       env variables, database connection pool
  models/       raw SQL for each table (users, files)
  services/     auth logic (JWT/bcrypt) and storage logic (disk I/O)
  middleware/   auth check, multer upload handling, centralized error handler
  controllers/  request handlers — call services/models, format the response
  routes/       maps URLs -> controller functions
  app.js        assembles the Express app (middleware + routes)
  server.js     actually starts the HTTP server
sql/schema.sql  run once to create your database tables
```

## 7. Why it's structured this way (for later)

- **`storage.service.js` is the only file that touches the local disk.**
  Every controller calls it by function name (`saveFinalFile`,
  `readFileStream`, `deleteFile`, ...). When you're ready to move to
  MinIO/Backblaze B2, you write a new service with the same function names
  using the AWS S3 SDK, then change one `require()` line in the file
  controller — no other file needs to know storage moved.
- **Storage path is saved in the database** (`files.storage_path`) rather
  than assumed from the filename, so it doesn't matter whether that path
  later becomes a local path or an S3 object key.
- **`subscription_plans` table already exists** (unused for now) so billing
  can be bolted on later without a schema migration mid-project.

## 8. Future scope (not built yet, on purpose)

- Deploy to a VPS behind Nginx + PM2
- Swap `storage.service.js` for an S3/MinIO-backed version
- Add Stripe/Razorpay billing tied to `subscription_plans`
- Build a React frontend that talks to this API
