# SAFE SOLUTIONS — FLEET & SMART ATTENDANCE SYSTEM
## REST API Specification

### Base URL: `/api/v1`

---

### 1. Authentication Endpoints (`/auth`)

#### `POST /auth/login`
- **Body**: `{ "email": "string", "password": "string" }`
- **Response**: `{ "token": "jwt", "user": { "id", "email", "role", "mustChangePassword", "employee": { "name", "employeeCode", "conveyanceType", ... } } }`

#### `POST /auth/change-password`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: `{ "currentPassword": "string", "newPassword": "string" }`
- **Response**: `{ "success": true, "message": "Password changed successfully" }`

#### `GET /auth/me`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: Full profile of authenticated user + employee record + active vehicle assignment.

---

### 2. Employee Management Endpoints (`/employees`)
- `GET /employees` (Query: `?search=&department=&role=&status=&page=&limit=`)
- `GET /employees/:id`
- `POST /employees` (Admin / Boss / Controller only)
- `PUT /employees/:id` (Admin only)
- `POST /employees/:id/reset-password` (Admin only)

---

### 3. Fleet & Vehicle Endpoints (`/vehicles`)
- `GET /vehicles` (Query: `?search=&type=&status=&page=&limit=`)
- `GET /vehicles/:id` (Includes assignment history, odometer history, fuel records, maintenance)
- `POST /vehicles` (Admin / Controller)
- `PUT /vehicles/:id` (Admin / Controller)
- `POST /vehicles/:id/assign` (Body: `{ "employeeId": "string", "notes": "string" }`)
- `POST /vehicles/:id/unassign` (Body: `{ "notes": "string" }`)
- `GET /vehicles/:id/qr` (Returns QR payload and printable format)
- `GET /vehicles/resolve-qr/:qrCode` (Scanned by mobile: validates vehicle and checks if assigned to current user)

---

### 4. Attendance Endpoints (`/attendance`)
- `GET /attendance/today` (For current employee or all employees for manager)
- `GET /attendance/list` (Filters: `?startDate=&endDate=&employeeId=&status=&type=&department=&page=&limit=`)
- `POST /attendance/submit` (Multipart: selfie, meterPhoto, sitePhoto + form data: `attendanceType`, `latitude`, `longitude`, `gpsAccuracy`, `officeId`/`siteId`/`vehicleId`, `odometerReading`, `idempotencyKey`)
- `POST /attendance/:id/approve` (Boss, Controller, Manager: Body: `{ "remarks": "string" }`)
- `POST /attendance/:id/reject` (Boss, Controller, Manager: Body: `{ "reason": "string", "remarks": "string" }`)
- `GET /attendance/:id/evidence` (Returns secured links for selfie, meter photo, OCR raw result, and map coordinates)

---

### 5. Fuel & Mileage Endpoints (`/fuel`)
- `GET /fuel` (Filters: `?vehicleId=&employeeId=&startDate=&endDate=`)
- `POST /fuel` (Multipart: receipt photo + form data: `vehicleId`, `liters`, `amount`, `odometerReading`, `fuelType`, `station`, `notes`)
- `GET /fuel/mileage-analytics` (Calculates KM/L, distance per period, cost per KM per vehicle)

---

### 6. Maintenance Endpoints (`/maintenance`)
- `GET /maintenance` (Filters: `?vehicleId=&status=&type=`)
- `POST /maintenance` (Multipart: invoice photo + form data: `vehicleId`, `maintenanceType`, `serviceDate`, `odometerReading`, `cost`, `vendorName`, `description`, `nextServiceDate`, `nextServiceOdometer`)
- `PUT /maintenance/:id`
- `GET /maintenance/alerts` (Returns overdue & upcoming maintenance based on date and current odometer readings)

---

### 7. Reports & Analytics Endpoints (`/reports`)
- `GET /reports/attendance-summary` (Daily, weekly, monthly attendance matrices)
- `GET /reports/fleet-utilization` (Vehicle usage, total kilometers traveled, fuel expense)
- `GET /reports/export-csv` (Permitted report export with query filters)

---

### 8. Audit & Notifications Endpoints (`/audit`, `/notifications`)
- `GET /audit` (Boss / Admin only: Filter by actor, entity, date range)
- `GET /notifications` (User's unread & read alerts)
- `PUT /notifications/:id/read`
- `PUT /notifications/read-all`
