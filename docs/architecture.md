# SAFE SOLUTIONS — FLEET & SMART ATTENDANCE SYSTEM
## Architecture Documentation

### 1. System Overview
SAFE SOLUTIONS Fleet & Smart Attendance System is an enterprise-grade full-stack solution integrating employee attendance verification with complete fleet lifecycle management. The system guarantees cryptographic and evidence-based integrity across all attendance submissions, vehicle assignments, odometer progressions, fuel records, and maintenance activities.

```
+-------------------------------------------------------------------------------+
|                                CLIENT LAYER                                   |
|  +-------------------------------------+  +--------------------------------+  |
|  |     Flutter Mobile Application      |  | Next.js 14 Operations Portal   |  |
|  | (Android / iOS / Clean Arch)        |  | (Boss / Controller / Manager)  |  |
|  | - Camera, QR Scanner, GPS Geo       |  | - Live KPIs, Approvals, Fleet  |  |
|  | - Meter OCR, Offline Queue, Sync    |  | - Evidence Viewer, Reports     |  |
|  +------------------+------------------+  +---------------+----------------+  |
+---------------------|-------------------------------------|-------------------+
                      | HTTPS / REST API / WebSockets       |
+---------------------v-------------------------------------v-------------------+
|                            APPLICATION BACKEND                                |
|  +-------------------------------------------------------------------------+  |
|  | Node.js + TypeScript REST API Server                                    |  |
|  | - Authentication & RBAC Guard (JWT + bcrypt)                           |  |
|  | - Idempotency & Rate Limiting Middleware                                |  |
|  | - Haversine Geofencing Engine & GPS Accuracy Validator                  |  |
|  | - Odometer OCR Engine & Monotonicity Verification                       |  |
|  | - Private File Storage & Evidence Pipeline (Multer)                    |  |
|  | - Audit Trail Subsystem & In-App Notification Dispatcher                |  |
|  +-------------------------------------+-----------------------------------+  |
+----------------------------------------|--------------------------------------+
                                         | Prisma ORM (Type-Safe Query Layer)
+----------------------------------------v--------------------------------------+
|                              DATABASE LAYER                                   |
|  +-------------------------------------------------------------------------+  |
|  | PostgreSQL Normalized Relational Database                               |  |
|  | - 11 Core Entities with Foreign Keys & Constraints                       |  |
|  | - Historical Vehicle Assignment Tables (Never Overwritten)              |  |
|  | - Immutable Original Check-in/Out Timestamps                            |  |
|  | - Full Audit Logs & Idempotency Storage                                 |  |
|  +-------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------+
```

---

### 2. Core Architectural Principles
1. **Server-Authoritative Validation**: Role permissions, GPS geofence checks, and business rules are strictly calculated and enforced on the server. Client assertions are never trusted without cryptographic/server verification.
2. **Immutable Audit Trail**: All state transitions (Check-in, Check-out, Approval, Rejection, Vehicle Assignment, Odometer update, Fuel logging) write an immutable record to the `AuditLog` table capturing actor, timestamp, IP, before-state, and after-state.
3. **Evidence-Based Attendance**: Every attendance record requires verified proof:
   - **Office Attendance**: Office QR validation + GPS coordinates within configured radius + Live camera selfie.
   - **Vehicle Attendance**: Assigned vehicle QR + GPS coordinates + Live camera selfie + Live odometer photo + OCR parsed reading.
   - **Site Attendance**: Site selection from registry + GPS coordinates + Live camera selfie + Site photo (NO QR required).
4. **Zero-Trust Role-Based Access Control (RBAC)**:
   - `BOSS`: Unrestricted business visibility, user management, fleet configuration, and full approval authority.
   - `CONTROLLER`: Operational fleet management, attendance approvals, fuel/maintenance management, reports.
   - `MANAGER`: Attendance review and approvals within assigned department/scope.
   - `EMPLOYEE`: Personal profile, assigned vehicle view, attendance submissions, fuel logging (zero approval rights).
