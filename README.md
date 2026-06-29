# OSWMS — Online Sports Week Management System

Web platform for managing college Sports Week: registration, scheduling, live scoring, leaderboards, notifications, and complaints.

**Nepal Engineering College** — BE Computer Engineering (Project I)

## Quick start

See **[SETUP.md](./SETUP.md)** for full step-by-step instructions.

```bash
# 1. Start the database (recommended via Docker Compose)
cd /workspaces/oswms
docker compose up -d

# 2. Configure and initialize backend
cd backend
cp .env.example .env
# Edit backend/.env if needed, then install and initialize the database
npm install
npm run db:init
npm start

# 3. Start frontend (new terminal)
cd ../frontend
npm install
npm start
```

If you use Docker Compose, the MySQL database is exposed on host port `3307` by default, so set `DB_PORT=3307` and `DB_HOST=127.0.0.1` in `backend/.env`.

**Admin login:** `admin` / `admin123`

## Features

- Game & team management
- Participant registration
- Round-robin & knockout fixture generation
- Live score updates & leaderboards
- Complaint & feedback module
- Admin dashboard with statistics
- Notifications

## Tech stack

| Layer | Stack |
|-------|--------|
| Frontend | React, Bootstrap, Axios |
| Backend | Node.js, Express |
| Database | MySQL |

## Team

- Dharmdev Chai (023-348)
- Kushmakar Joshi (023-331)
- Lepmuhang Sherma (023-332)
# oswms
"# oswms" 
