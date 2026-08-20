import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AttendanceType, ApprovalStatus, Role, UserStatus } from '@prisma/client';
import { calculateHaversineDistanceMeters, verifyGeofence } from '../utils/haversine';
import { createAuditLog } from '../utils/audit';
import { sendNotification } from '../utils/notification';
import { parseOdometerImage } from '../utils/ocr';
import { getFileUrl } from '../middleware/upload';

export const submitAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const employeeId = req.user?.employeeId;

    if (!employeeId) {
      res.status(400).json({ success: false, message: 'User is not linked to an employee profile.' });
      return;
    }

    const {
      attendanceType = AttendanceType.OFFICE_CHECK_IN,
      latitude,
      longitude,
      gpsAccuracy,
      locationAddress,
      officeId,
      siteId,
      vehicleId,
      odometerReading,
      idempotencyKey,
    } = req.body;

    if (!latitude || !longitude) {
      res.status(400).json({ success: false, message: 'GPS coordinates (latitude, longitude) are required.' });
      return;
    }

    const parsedLat = parseFloat(latitude);
    const parsedLon = parseFloat(longitude);
    const parsedGpsAccuracy = gpsAccuracy ? parseFloat(gpsAccuracy) : null;
    const parsedOdometer = odometerReading ? parseInt(odometerReading, 10) : null;

    // Check Idempotency Key
    if (idempotencyKey) {
      const existing = await prisma.attendance.findUnique({
        where: { idempotencyKey },
        include: { employee: true, vehicle: true, office: true, site: true },
      });
      if (existing) {
        res.json({
          success: true,
          message: 'Attendance already submitted (idempotent duplicate request).',
          data: existing,
        });
        return;
      }
    }

    // Process Files
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const selfieFile = files?.['selfie']?.[0] || files?.['selfiePhoto']?.[0];
    const meterFile = files?.['meterPhoto']?.[0] || files?.['meter']?.[0];
    const siteFile = files?.['sitePhoto']?.[0] || files?.['site']?.[0];

    const selfieUrl = selfieFile ? getFileUrl(selfieFile) : req.body.selfieUrl;
    const meterPhotoUrl = meterFile ? getFileUrl(meterFile) : req.body.meterPhotoUrl;
    const sitePhotoUrl = siteFile ? getFileUrl(siteFile) : req.body.sitePhotoUrl;

    if (!selfieUrl) {
      res.status(400).json({ success: false, message: 'Live camera selfie is strictly required.' });
      return;
    }

    let isGeofenceViolation = false;
    let distanceFromTargetMeters: number | null = null;
    let resolvedOfficeId: string | null = officeId || null;
    let resolvedSiteId: string | null = siteId || null;
    let resolvedVehicleId: string | null = vehicleId || null;

    // Haversine Geofencing calculation
    if (
      attendanceType === AttendanceType.OFFICE_CHECK_IN ||
      attendanceType === AttendanceType.OFFICE_CHECK_OUT
    ) {
      let office = resolvedOfficeId
        ? await prisma.officeLocation.findUnique({ where: { id: resolvedOfficeId } })
        : await prisma.officeLocation.findFirst({ where: { isActive: true } });

      if (office) {
        resolvedOfficeId = office.id;
        const geofenceResult = verifyGeofence(
          parsedLat,
          parsedLon,
          office.latitude,
          office.longitude,
          office.allowedRadiusMeters
        );
        distanceFromTargetMeters = geofenceResult.distanceMeters;
        isGeofenceViolation = geofenceResult.isViolation;
      }
    } else if (attendanceType === AttendanceType.SITE_CHECK_IN && resolvedSiteId) {
      const site = await prisma.siteRegistry.findUnique({ where: { id: resolvedSiteId } });
      if (site && site.latitude && site.longitude) {
        const radius = site.radiusMeters || 300;
        const geofenceResult = verifyGeofence(
          parsedLat,
          parsedLon,
          site.latitude,
          site.longitude,
          radius
        );
        distanceFromTargetMeters = geofenceResult.distanceMeters;
        isGeofenceViolation = geofenceResult.isViolation;
      }
    }

    // OCR Meter Processing
    let ocrRawResult: string | null = null;
    let ocrConfidence: number | null = null;
    if (meterFile && meterFile.path) {
      const ocrResult = await parseOdometerImage(meterFile.path);
      ocrRawResult = ocrResult.rawText;
      ocrConfidence = ocrResult.confidence;
    }

    // If Vehicle attendance, ensure vehicleId is linked
    if (attendanceType === AttendanceType.VEHICLE_CHECK_IN && !resolvedVehicleId) {
      const activeAssign = await prisma.vehicleAssignment.findFirst({
        where: { employeeId, status: 'ACTIVE' },
      });
      if (activeAssign) {
        resolvedVehicleId = activeAssign.vehicleId;
      }
    }

    const now = new Date();
    const todayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // Create Attendance Record (Strictly PENDING_APPROVAL)
    const attendance = await prisma.attendance.create({
      data: {
        employeeId,
        attendanceType: attendanceType as AttendanceType,
        vehicleId: resolvedVehicleId,
        officeId: resolvedOfficeId,
        siteId: resolvedSiteId,
        date: todayDate,
        checkInTime: now,
        originalCheckInTime: now,
        approvalStatus: ApprovalStatus.PENDING_APPROVAL,
        latitude: parsedLat,
        longitude: parsedLon,
        gpsAccuracy: parsedGpsAccuracy,
        locationAddress: locationAddress || null,
        distanceFromTargetMeters,
        isGeofenceViolation,
        selfieUrl,
        meterPhotoUrl,
        sitePhotoUrl,
        odometerReading: parsedOdometer,
        ocrRawResult,
        ocrConfidence,
        idempotencyKey: idempotencyKey || null,
      },
      include: {
        employee: true,
        vehicle: true,
        office: true,
        site: true,
      },
    });

    // Notify Managers & Boss
    await sendNotification({
      recipientRoles: [Role.BOSS, Role.CONTROLLER, Role.MANAGER],
      type: 'ATTENDANCE_SUBMITTED',
      title: 'New Attendance Submission',
      message: `${attendance.employee.name} submitted ${attendance.attendanceType} (Pending Approval).`,
      entityName: 'Attendance',
      entityId: attendance.id,
    });

    // Audit submission
    await createAuditLog({
      action: 'ATTENDANCE_SUBMIT',
      entityName: 'Attendance',
      entityId: attendance.id,
      newValue: {
        employeeCode: attendance.employee.employeeCode,
        type: attendance.attendanceType,
        isGeofenceViolation,
        distanceFromTargetMeters,
      },
      req,
    });

    res.status(201).json({
      success: true,
      message: 'Attendance submitted successfully. Pending Manager / Controller approval.',
      data: attendance,
    });
  } catch (error) {
    console.error('Error in submitAttendance:', error);
    res.status(500).json({ success: false, message: 'Internal server error while submitting attendance.' });
  }
};

export const getTodayAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    const employeeId = req.user?.employeeId;

    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    // If regular Employee, show only their attendance today
    if (userRole === Role.EMPLOYEE && employeeId) {
      const records = await prisma.attendance.findMany({
        where: {
          employeeId,
          checkInTime: { gte: startOfToday, lte: endOfToday },
        },
        orderBy: { checkInTime: 'desc' },
        include: {
          employee: true,
          vehicle: true,
          office: true,
          site: true,
          approvedBy: { select: { id: true, email: true } },
        },
      });

      res.json({ success: true, count: records.length, data: records });
      return;
    }

    // If Manager/Controller/Boss, return all today attendance records
    const records = await prisma.attendance.findMany({
      where: {
        checkInTime: { gte: startOfToday, lte: endOfToday },
      },
      orderBy: { checkInTime: 'desc' },
      include: {
        employee: true,
        vehicle: true,
        office: true,
        site: true,
        approvedBy: { select: { id: true, email: true } },
      },
    });

    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    console.error('Error in getTodayAttendance:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

export const listAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      startDate,
      endDate,
      employeeId,
      status,
      type,
      department,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    // Filter by date range
    if (startDate || endDate) {
      where.checkInTime = {};
      if (startDate) where.checkInTime.gte = new Date(String(startDate));
      if (endDate) {
        const end = new Date(String(endDate));
        end.setHours(23, 59, 59, 999);
        where.checkInTime.lte = end;
      }
    }

    // Role-based scoping: regular employees only view their own records
    if (req.user?.role === Role.EMPLOYEE) {
      where.employeeId = req.user.employeeId;
    } else if (employeeId) {
      where.employeeId = String(employeeId);
    }

    if (status) {
      where.approvalStatus = status as ApprovalStatus;
    }

    if (type) {
      where.attendanceType = type as AttendanceType;
    }

    if (department) {
      where.employee = { department: { equals: String(department), mode: 'insensitive' } };
    }

    const [total, records] = await Promise.all([
      prisma.attendance.count({ where }),
      prisma.attendance.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { checkInTime: 'desc' },
        include: {
          employee: true,
          vehicle: true,
          office: true,
          site: true,
          approvedBy: { select: { id: true, email: true } },
        },
      }),
    ]);

    res.json({
      success: true,
      data: records,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error in listAttendance:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

export const approveAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    const approverUserId = req.user!.id;

    const attendance = await prisma.attendance.findUnique({
      where: { id },
      include: { employee: true, vehicle: true },
    });

    if (!attendance) {
      res.status(404).json({ success: false, message: 'Attendance record not found.' });
      return;
    }

    // Inviolable Rule: Anti-Self-Approval
    if (attendance.employee.userId === approverUserId) {
      res.status(403).json({
        success: false,
        message: 'Security Policy Violation: You cannot approve your own attendance record.',
      });
      return;
    }

    const oldState = { ...attendance };

    const approved = await prisma.attendance.update({
      where: { id },
      data: {
        approvalStatus: ApprovalStatus.APPROVED,
        approvedById: approverUserId,
        approvedAt: new Date(),
        managerRemarks: remarks || 'Approved',
        rejectionReason: null,
      },
      include: { employee: true, vehicle: true, approvedBy: { select: { id: true, email: true } } },
    });

    // If vehicle odometer reading is provided and monotonic, update vehicle's current odometer
    if (approved.vehicleId && approved.odometerReading) {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: approved.vehicleId } });
      if (vehicle && approved.odometerReading >= vehicle.currentOdometer) {
        await prisma.vehicle.update({
          where: { id: approved.vehicleId },
          data: { currentOdometer: approved.odometerReading },
        });
      }
    }

    // Notify Employee
    await sendNotification({
      recipientId: attendance.employee.userId,
      type: 'ATTENDANCE_APPROVED',
      title: 'Attendance Approved',
      message: `Your ${attendance.attendanceType} on ${attendance.date.toISOString().slice(0, 10)} has been approved.`,
      entityName: 'Attendance',
      entityId: attendance.id,
    });

    // Audit Approval
    await createAuditLog({
      action: 'ATTENDANCE_APPROVE',
      entityName: 'Attendance',
      entityId: attendance.id,
      oldValue: oldState,
      newValue: approved,
      req,
    });

    res.json({
      success: true,
      message: 'Attendance approved successfully.',
      data: approved,
    });
  } catch (error) {
    console.error('Error in approveAttendance:', error);
    res.status(500).json({ success: false, message: 'Internal server error while approving attendance.' });
  }
};

export const rejectAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason, remarks } = req.body;
    const rejectorUserId = req.user!.id;

    if (!reason && !remarks) {
      res.status(400).json({ success: false, message: 'Rejection reason or remarks are mandatory.' });
      return;
    }

    const attendance = await prisma.attendance.findUnique({
      where: { id },
      include: { employee: true },
    });

    if (!attendance) {
      res.status(404).json({ success: false, message: 'Attendance record not found.' });
      return;
    }

    // Anti-Self-Approval / Modification rule
    if (attendance.employee.userId === rejectorUserId) {
      res.status(403).json({
        success: false,
        message: 'Security Policy Violation: You cannot reject/alter your own attendance record.',
      });
      return;
    }

    const oldState = { ...attendance };

    const rejected = await prisma.attendance.update({
      where: { id },
      data: {
        approvalStatus: ApprovalStatus.REJECTED,
        approvedById: rejectorUserId,
        approvedAt: new Date(),
        rejectionReason: reason || remarks,
        managerRemarks: remarks || reason,
      },
      include: { employee: true, approvedBy: { select: { id: true, email: true } } },
    });

    // Notify Employee
    await sendNotification({
      recipientId: attendance.employee.userId,
      type: 'ATTENDANCE_REJECTED',
      title: 'Attendance Rejected',
      message: `Your ${attendance.attendanceType} was rejected. Reason: ${reason || remarks}`,
      entityName: 'Attendance',
      entityId: attendance.id,
    });

    // Audit Rejection
    await createAuditLog({
      action: 'ATTENDANCE_REJECT',
      entityName: 'Attendance',
      entityId: attendance.id,
      oldValue: oldState,
      newValue: rejected,
      req,
    });

    res.json({
      success: true,
      message: 'Attendance rejected.',
      data: rejected,
    });
  } catch (error) {
    console.error('Error in rejectAttendance:', error);
    res.status(500).json({ success: false, message: 'Internal server error while rejecting attendance.' });
  }
};

export const getAttendanceEvidence = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const record = await prisma.attendance.findUnique({
      where: { id },
      include: {
        employee: true,
        vehicle: true,
        office: true,
        site: true,
        approvedBy: { select: { id: true, email: true } },
      },
    });

    if (!record) {
      res.status(404).json({ success: false, message: 'Attendance record not found.' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: record.id,
        employee: {
          id: record.employee.id,
          employeeCode: record.employee.employeeCode,
          name: record.employee.name,
          department: record.employee.department,
        },
        attendanceType: record.attendanceType,
        approvalStatus: record.approvalStatus,
        date: record.date,
        checkInTime: record.checkInTime,
        originalCheckInTime: record.originalCheckInTime,
        coordinates: {
          latitude: record.latitude,
          longitude: record.longitude,
          gpsAccuracy: record.gpsAccuracy,
          locationAddress: record.locationAddress,
        },
        geofence: {
          isViolation: record.isGeofenceViolation,
          distanceFromTargetMeters: record.distanceFromTargetMeters,
          targetLocation: record.office?.name || record.site?.name || 'N/A',
        },
        evidenceMedia: {
          selfieUrl: record.selfieUrl,
          meterPhotoUrl: record.meterPhotoUrl,
          sitePhotoUrl: record.sitePhotoUrl,
        },
        meterOcr: {
          submittedReading: record.odometerReading,
          ocrRawResult: record.ocrRawResult,
          ocrConfidence: record.ocrConfidence,
        },
        approval: {
          status: record.approvalStatus,
          approvedBy: record.approvedBy?.email || null,
          approvedAt: record.approvedAt,
          managerRemarks: record.managerRemarks,
          rejectionReason: record.rejectionReason,
        },
      },
    });
  } catch (error) {
    console.error('Error in getAttendanceEvidence:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};
