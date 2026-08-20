# SAFE SOLUTIONS — Fleet Management & Smart Attendance System

An enterprise-grade full-stack solution integrating verified employee attendance with comprehensive fleet lifecycle management, GPS geofencing, odometer OCR verification, and cryptographic audit trails.

---

## 🌟 Core Features

- 📍 **Smart Geofenced Attendance**: Real-time GPS verification via Haversine spherical math with automated breach flagging.
- 🚗 **Fleet Lifecycle Tracking**: Vehicle assignments, live odometer monitoring, and historical progression.
- 📸 **Evidence Pipeline**: Live camera selfie enforcement, odometer meter photo capture with OCR extraction (Tesseract.js).
- ⛽ **Fuel & Maintenance Management**: Fuel claims with receipt attachments, KM/L calculations, cost/KM metrics, and service alerts.
- 🛡️ **Zero-Trust RBAC**: Role-based access control across `BOSS`, `CONTROLLER`, `MANAGER`, and `EMPLOYEE`.
- 📋 **Immutable Audit Logs**: Comprehensive before/after logging of all state transitions.
- 📊 **Executive Reports**: Summary matrices, fleet utilization statistics, and instant CSV exports.

---

## 🛠️ Technology Stack

- **Runtime**: Node.js v18+ & TypeScript
- **Framework**: Express.js
- **Database & ORM**: PostgreSQL & Prisma ORM
- **OCR Engine**: Tesseract.js
- **Authentication**: JWT & bcryptjs
- **Containerization**: Docker & Docker Compose
- **Process Manager**: PM2

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v15 or higher)

### 2. Setup & Installation
```bash
# Clone the repository
git clone <YOUR_REPO_URL>
cd "SAFE SOLUTIONS — FLEET & SMART"

# Install backend dependencies
cd backend
npm install

# Setup environment variables
cp ../.env.example .env

# Initialize database schema & seed official master data
npm run prisma:push
npm run prisma:seed

# Verify seed integrity
npm run prisma:verify

# Run test suite
npm test

# Build & Start server
npm run build
npm start
```

---

## 🐳 Docker Deployment

```bash
docker compose up -d --build
```

---

## 📖 API Documentation & Specifications

Detailed documentation is available in the [`docs/`](./docs) folder:
- [API Specification](./docs/api.md)
- [Architecture Overview](./docs/architecture.md)
- [Business Rules & Workflows](./docs/business-rules.md)
- [Database Schema](./docs/database.md)
- [Deployment Guide](./docs/deployment.md)
- [Testing Matrix](./docs/testing.md)

---

## 📄 License
Proprietary — SAFE SOLUTIONS 2026. All rights reserved.
