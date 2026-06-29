# OSWMS — Setup Guide (Step by Step)

**Online Sports Week Management System** for Nepal Engineering College.

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| npm | 9+ |
| MySQL | 8.0 (or Docker) |

---

## Step 1: Clone / open the project

```bash
cd /home/dharmdev/Documents/app_development/web/oswms
```

---

## Step 2: Start MySQL database

### Option A — Docker (recommended)

```bash
docker compose up -d
```

Wait ~30 seconds for MySQL to initialize. The database container exposes MySQL on host port `3307`.

> **Note:** Docker maps MySQL to host port **3307** (to avoid conflict if XAMPP already uses `3306`). In `backend/.env`, set:
>
> ```bash
> DB_HOST=127.0.0.1
> DB_PORT=3307
> DB_PASSWORD=root
> ```

After the container is running, initialize the schema and seed data with:

```bash
cd backend
npm install
npm run db:init
```

### Option B — XAMPP / local MySQL

1. Start MySQL from XAMPP control panel.
2. Open phpMyAdmin or MySQL CLI.
3. Import the schema:

```bash
mysql -u root -p < database/schema.sql
```

If root has **no password**, set in `backend/.env`:

```
DB_PASSWORD=""
```

---

## Step 3: Configure backend environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` if needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | localhost | MySQL host |
| `DB_PORT` | 3307 | MySQL host port for Docker Compose |
| `DB_USER` | root | MySQL user |
| `DB_PASSWORD` | root | MySQL password (`""` for XAMPP empty-root) |
| `DB_NAME` | oswms_db | Database name |
| `AUTH_USER` | admin | Admin login username |
| `AUTH_PASSWORD` | admin123 | Admin login password |

**Re-initialize database manually (optional):**

```bash
cd backend && npm run db:init
```

---

## Step 4: Install backend dependencies & run API

```bash
cd backend
npm install
npm start
```

Expected output:

```
OSWMS backend running on port 5000
```

Verify: open http://localhost:5000/api/health

---

## Step 5: Install frontend dependencies & run React app

Open a **new terminal**:

```bash
cd frontend
npm install
npm start
```

Browser opens at **http://localhost:3000**

The `proxy` in `frontend/package.json` forwards `/api` requests to port 5000.

---

## Step 6: Login

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Demo player | `dharmdev` | `player123` |
| Demo player | `kushmakar` | `player123` (pending team request) |

- **Admin** → `/admin`
- **Participant** → `/dashboard`

New users: http://localhost:3000/signup

---

## Step 7: Use the system (workflow)

### Public (no login)

| Page | URL | Action |
|------|-----|--------|
| Home | `/` | Overview |
| **Announcements** | `/announcements` | **Public notifications (no login)** |
| Events | `/events` | View games |
| Schedule | `/schedule` | Live-updating match fixtures & scores |
| Leaderboard | `/leaderboard` | Team rankings |
| Teams | `/teams` | Browse teams (login to join/create) |
| Complaints | `/complaints` | Submit complaints |

### Participant (`/dashboard`)

1. **Sign up** at `/signup`
2. **Create team** or **request to join** at `/teams`
3. Wait for **admin approval** — notification appears on dashboard
4. View **my matches**, **live scores**, **progress stats**
5. Get alerts for team requests, approvals, and score updates

### Admin (`/admin`)

1. **Approve/reject** pending team join requests
2. **Resolve schedule conflicts** (double-booked players)
3. **Create games** and **generate fixtures** (skips conflicting slots)
4. **Publish live scores** — notifies all team members instantly
5. **Broadcast** public announcements (visible on `/announcements`)
6. Resolve complaints

---

## API endpoints (reference)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health |
| POST | `/api/login` | Admin login |
| GET | `/api/games` | List games |
| POST | `/api/games` | Create game (admin) |
| GET | `/api/teams` | List teams |
| POST | `/api/teams` | Register team |
| GET | `/api/matches` | List matches |
| POST | `/api/matches/generate-fixtures` | Auto-generate fixtures (admin) |
| PATCH | `/api/matches/:id/score` | Update live score (admin) |
| GET | `/api/leaderboard` | Standings |
| GET/POST | `/api/complaints` | Complaints |
| GET/POST | `/api/notifications` | Notifications |
| GET | `/api/dashboard/stats` | Admin statistics |

---

## Troubleshooting

### Database shows "Disconnected" on admin panel

- Ensure MySQL is running: `docker compose ps` or XAMPP MySQL started
- Check `backend/.env` credentials
- Run: `cd backend && npm run db:init`

### Frontend cannot reach API

- Backend must run on port **5000**
- Or set `REACT_APP_API_BASE_URL=http://localhost:5000/api` in `frontend/.env`

### `ECONNREFUSED` on API calls

```bash
cd backend && npm start
```

### Port 3000 or 5000 already in use

```bash
# Linux
lsof -i :5000
kill <PID>
```

---

## Project structure

```
oswms/
├── backend/          # Express + MySQL API
├── frontend/         # React + Bootstrap UI
├── database/         # schema.sql, init.js
├── docker-compose.yml
└── SETUP.md
```

---

## Team

- Dharmdev Chai (023-348)
- Kushmakar Joshi (023-331)
- Lepmuhang Sherma (023-332)

Nepal Engineering College — BE Computer Engineering
