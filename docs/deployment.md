# SAFE SOLUTIONS — FLEET & SMART ATTENDANCE SYSTEM
## Production Deployment Guide

### 1. Deployment Status
- **Local Live Backend**: Active & Healthy at `http://localhost:5000/api/v1`
- **Health Check Endpoint**: `http://localhost:5000/api/v1/health`
- **Database Engine**: PostgreSQL connected via Prisma ORM
- **Upload Directory**: `./uploads/`

---

### 2. Deployment Options

#### Option A: Docker Compose (Full Stack Containerized)
```bash
# Start PostgreSQL and Backend in background
docker compose up -d --build

# View logs
docker compose logs -f backend

# Stop services
docker compose down
```

#### Option B: PM2 Process Manager (VPS / Production Linux)
```bash
cd backend
npm run build
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

#### Option C: Direct Node.js Production Run
```bash
cd backend
npm run build
npm start
```

---

### 3. Production Environment Variables Checklist
- [x] Set strong random string for `JWT_SECRET` ($\ge 32$ chars).
- [x] Configure dedicated private directory for file uploads (`UPLOAD_PATH`).
- [x] Ensure HTTPS is enabled for camera and GPS geolocation APIs.
- [x] Verify CORS configuration restricts origins to authorized domain names.
