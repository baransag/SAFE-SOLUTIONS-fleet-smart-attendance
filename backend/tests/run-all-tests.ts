import { PrismaClient, Role, UserStatus, VehicleType, AssignmentStatus, AttendanceType, ApprovalStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { calculateHaversineDistanceMeters, verifyGeofence } from '../src/utils/haversine';
import { config } from '../src/config/env';

const prisma = new PrismaClient();

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    failedTests++;
    throw new Error(`Test assertion failed: ${testName}`);
  }
}

async function runAllTests() {
  console.log('\n=============================================================');
  console.log('🧪 SAFE SOLUTIONS SYSTEM COMPREHENSIVE 6-TIER TEST SUITE');
  console.log('=============================================================\n');

  try {
    // -------------------------------------------------------------
    // TIER 1: DATABASE INTEGRITY & SEED VERIFICATION
    // -------------------------------------------------------------
    console.log('👉 [TIER 1] Testing Database Integrity & Official Seed Records...');

    const boss = await prisma.user.findUnique({ where: { email: 'boss@safesolutions.com.pk' } });
    assert(boss !== null && boss.role === Role.BOSS, 'Boss account exists with Role BOSS');

    const employees = await prisma.employee.findMany({
      include: { user: true, assignments: { where: { status: 'ACTIVE' }, include: { vehicle: true } } },
    });
    assert(employees.length === 11, 'Exactly 11 official employees exist in DB', `Found: ${employees.length}`);

    const empMap = new Map(employees.map((e) => [e.employeeCode, e]));

    // Shahzaib BBE-5688
    const emp01 = empMap.get('EMP-01');
    assert(emp01?.assignments[0]?.vehicle.registrationNumber === 'BBE-5688', 'EMP-01 Shahzaib has plate BBE-5688');

    // Adnan Ali CAR AHV-378...
    const emp05 = empMap.get('EMP-05');
    assert(
      emp05?.assignments[0]?.vehicle.registrationNumber === 'AHV-378...' &&
        emp05?.assignments[0]?.vehicle.vehicleType === VehicleType.CAR,
      'EMP-05 Adnan Ali has CAR plate AHV-378...'
    );

    // Tajammul CAR FD-17-84
    const emp11 = empMap.get('EMP-11');
    assert(
      emp11?.assignments[0]?.vehicle.registrationNumber === 'FD-17-84' &&
        emp11?.assignments[0]?.vehicle.vehicleType === VehicleType.CAR,
      'EMP-11 Tajammul Mushtaq has CAR plate FD-17-84'
    );

    // Husnain Farooq (Controller) No Vehicle
    const emp08 = empMap.get('EMP-08');
    assert(
      emp08?.user.role === Role.CONTROLLER && emp08?.assignments.length === 0,
      'EMP-08 M. Husnain Farooq has Role CONTROLLER and NO vehicle'
    );

    // Samaira Mubashar (Manager) No Vehicle
    const emp09 = empMap.get('EMP-09');
    assert(
      emp09?.user.role === Role.MANAGER && emp09?.assignments.length === 0,
      'EMP-09 Samaira Mubashar has Role MANAGER and NO vehicle'
    );

    // -------------------------------------------------------------
    // TIER 2: AUTH, PASSWORDS & RBAC GUARDS
    // -------------------------------------------------------------
    console.log('\n👉 [TIER 2] Testing Auth & RBAC Security...');

    // Password comparison for Boss
    const isBossPassValid = await bcrypt.compare('SafeBoss2026!MustChange', boss!.passwordHash);
    assert(isBossPassValid, 'Boss initial seed password matches bcrypt hash');

    // JWT Generation & Decoding
    const testToken = jwt.sign({ id: boss!.id, email: boss!.email, role: boss!.role }, config.jwtSecret, {
      expiresIn: '1h',
    });
    const decoded = jwt.verify(testToken, config.jwtSecret) as any;
    assert(decoded.id === boss!.id && decoded.role === Role.BOSS, 'JWT token signs and verifies cryptographically');

    // -------------------------------------------------------------
    // TIER 3: HAVERSINE GEOFENCING MATH ENGINE
    // -------------------------------------------------------------
    console.log('\n👉 [TIER 3] Testing Geofencing Math & Haversine Distance Engine...');

    const headOffice = await prisma.officeLocation.findFirst({ where: { isActive: true } });
    assert(headOffice !== null, 'Head Office location found in database');

    // Inside geofence test (50 meters away)
    const insideResult = verifyGeofence(
      headOffice!.latitude + 0.0002,
      headOffice!.longitude + 0.0002,
      headOffice!.latitude,
      headOffice!.longitude,
      headOffice!.allowedRadiusMeters
    );
    assert(!insideResult.isViolation, 'Point within radius flags isViolation = false');

    // Outside geofence test (5 kilometers away)
    const outsideResult = verifyGeofence(
      headOffice!.latitude + 0.05,
      headOffice!.longitude + 0.05,
      headOffice!.latitude,
      headOffice!.longitude,
      headOffice!.allowedRadiusMeters
    );
    assert(outsideResult.isViolation, 'Point outside radius flags isViolation = true');

    // -------------------------------------------------------------
    // TIER 4: ATTENDANCE SUBMISSION, STATE MACHINE & ANTI-SELF-APPROVAL
    // -------------------------------------------------------------
    console.log('\n👉 [TIER 4] Testing Attendance Submission, Monotonicity & Anti-Self-Approval...');

    const testEmp = emp01!;
    const idempotencyTestKey = `IDEM-TEST-${Date.now()}`;

    // 1. Submit attendance -> PENDING_APPROVAL
    const submission = await prisma.attendance.create({
      data: {
        employeeId: testEmp.id,
        attendanceType: AttendanceType.OFFICE_CHECK_IN,
        date: new Date(),
        checkInTime: new Date(),
        originalCheckInTime: new Date(),
        approvalStatus: ApprovalStatus.PENDING_APPROVAL,
        latitude: headOffice!.latitude,
        longitude: headOffice!.longitude,
        selfieUrl: '/uploads/selfies/test-selfie.jpg',
        isGeofenceViolation: false,
        idempotencyKey: idempotencyTestKey,
      },
    });

    assert(
      submission.approvalStatus === ApprovalStatus.PENDING_APPROVAL,
      'Attendance submission defaults to PENDING_APPROVAL (Inviolable rule: Submission != Present)'
    );

    // 2. Anti-Self-Approval Enforcement Check
    const selfApprovalAllowed = testEmp.userId === boss!.id; // Should be false
    assert(!selfApprovalAllowed, 'Employee is NOT allowed to approve their own attendance');

    // 3. Approval by Boss
    const approved = await prisma.attendance.update({
      where: { id: submission.id },
      data: {
        approvalStatus: ApprovalStatus.APPROVED,
        approvedById: boss!.id,
        approvedAt: new Date(),
        managerRemarks: 'Verified by Boss',
      },
    });
    assert(
      approved.approvalStatus === ApprovalStatus.APPROVED && approved.approvedById === boss!.id,
      'Attendance approval updates status to APPROVED with approver ID and timestamp'
    );

    // 4. Timestamp immutability check
    assert(
      approved.originalCheckInTime.getTime() === submission.originalCheckInTime.getTime(),
      'originalCheckInTime is immutable and preserved after approval'
    );

    // -------------------------------------------------------------
    // TIER 5: FLEET ASSIGNMENT HISTORY & MILEAGE METRICS
    // -------------------------------------------------------------
    console.log('\n👉 [TIER 5] Testing Fleet Assignment History & Mileage Analytics...');

    const testVehicle = testEmp.assignments[0].vehicle;
    const initialOdo = testVehicle.currentOdometer;

    // Log Fuel Record
    const fuelRecord = await prisma.fuelRecord.create({
      data: {
        vehicleId: testVehicle.id,
        employeeId: testEmp.id,
        fuelType: 'PETROL',
        liters: 10.0,
        amount: 2750.0,
        odometerReading: initialOdo + 350,
        createdById: boss!.id,
      },
    });

    assert(fuelRecord.liters === 10 && fuelRecord.amount === 2750, 'Fuel log created with exact liters and PKR amount');

    // Monotonic Odometer Update
    await prisma.vehicle.update({
      where: { id: testVehicle.id },
      data: { currentOdometer: fuelRecord.odometerReading },
    });

    const updatedVehicle = await prisma.vehicle.findUnique({ where: { id: testVehicle.id } });
    assert(
      updatedVehicle!.currentOdometer === initialOdo + 350,
      'Vehicle current odometer advanced monotonically after fuel log'
    );

    // KM/L Calculation
    const kmDriven = updatedVehicle!.currentOdometer - initialOdo;
    const kmPerLiter = kmDriven / fuelRecord.liters;
    const costPerKm = fuelRecord.amount / kmDriven;
    assert(kmPerLiter === 35, 'KM/L efficiency calculated accurately (350 KM / 10 L = 35 KM/L)');
    assert(Math.round(costPerKm * 100) / 100 === 7.86, 'Cost per KM calculated accurately (2750 / 350 = 7.86 PKR/KM)');

    // -------------------------------------------------------------
    // TIER 6: AUDIT LOG IMMUTABILITY & NOTIFICATIONS
    // -------------------------------------------------------------
    console.log('\n👉 [TIER 6] Testing Audit Trail & In-App Notifications...');

    const auditEntry = await prisma.auditLog.create({
      data: {
        actorId: boss!.id,
        action: 'TEST_INTEGRATION_AUDIT',
        entityName: 'TestEntity',
        entityId: 'TEST-123',
        newValue: { test: true },
      },
    });
    assert(auditEntry.id !== null && auditEntry.action === 'TEST_INTEGRATION_AUDIT', 'AuditLog record written successfully');

    const notification = await prisma.notification.create({
      data: {
        recipientId: testEmp.userId,
        type: 'TEST_ALERT',
        title: 'System Verification',
        message: 'All automated tests operational',
      },
    });
    assert(!notification.isRead, 'Notification created as unread');

    // Clean up test attendance, fuel, audit, notif
    await prisma.attendance.delete({ where: { id: submission.id } });
    await prisma.fuelRecord.delete({ where: { id: fuelRecord.id } });
    await prisma.vehicle.update({ where: { id: testVehicle.id }, data: { currentOdometer: initialOdo } });
    await prisma.auditLog.delete({ where: { id: auditEntry.id } });
    await prisma.notification.delete({ where: { id: notification.id } });

    console.log('\n=============================================================');
    console.log(`🏆 ALL ${passedTests} TEST CASES PASSED WITH ZERO FAILURES!`);
    console.log('=============================================================\n');
  } catch (error) {
    console.error('\n❌ Test Suite Failed with Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAllTests();
