# SAFE SOLUTIONS — FLEET & SMART ATTENDANCE SYSTEM
## Testing Strategy & QA Plan

### 1. Verification Matrix
The system is tested across 6 testing tiers:

| Tier | Focus Area | Verification Method |
|---|---|---|
| 1. DB Integrity | 11 Official Employees, Zero Duplicate records, Incomplete fields preserved, Vehicle linkages | Prisma Seed Automated Assertions |
| 2. Auth & RBAC | JWT validation, bcrypt hash, forced first-time password reset, Role hierarchy, IDOR prevention | API Integration Tests |
| 3. Attendance Pipeline | Submission $\to$ `PENDING_APPROVAL`, GPS Geofence Haversine math, Monotonic Odometer check, Monotonic Timestamp freeze | Backend Business Logic Tests |
| 4. Fleet Operations | Assignment history persistence, KM/L math, Overdue maintenance alerts | Service Unit Tests |
| 5. Web Portal UI | Responsive dashboard, live approval modal, evidence viewer, CSV export | Playwright / Browser Subagent Tests |
| 6. Flutter Mobile | Clean architecture models, QR scanning parser, GPS accuracy warning, dynamic vehicle workflow | Flutter Test Suite |

---

### 2. Automated Test Commands
- **Backend Tests**: `npm test` inside `backend/`
- **Database Seed Verification**: `npx ts-node prisma/verify-seed.ts`
- **Web Portal Build Validation**: `npm run build` inside `web/`
