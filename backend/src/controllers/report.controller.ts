import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { ApprovalStatus } from '@prisma/client';

export const getAttendanceSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, department } = req.query;

    const where: any = {};
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(String(startDate));
      if (endDate) where.date.lte = new Date(String(endDate));
    }

    if (department) {
      where.employee = { department: { equals: String(department), mode: 'insensitive' } };
    }

    const [total, approved, pending, rejected, geofenceViolations, byDepartment] = await Promise.all([
      prisma.attendance.count({ where }),
      prisma.attendance.count({ where: { ...where, approvalStatus: ApprovalStatus.APPROVED } }),
      prisma.attendance.count({ where: { ...where, approvalStatus: ApprovalStatus.PENDING_APPROVAL } }),
      prisma.attendance.count({ where: { ...where, approvalStatus: ApprovalStatus.REJECTED } }),
      prisma.attendance.count({ where: { ...where, isGeofenceViolation: true } }),
      prisma.attendance.groupBy({
        by: ['attendanceType', 'approvalStatus'],
        where,
        _count: { _all: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalSubmissions: total,
        approvedCount: approved,
        pendingCount: pending,
        rejectedCount: rejected,
        geofenceViolationsCount: geofenceViolations,
        breakdown: byDepartment,
      },
    });
  } catch (error) {
    console.error('Error in getAttendanceSummary:', error);
    res.status(500).json({ success: false, message: 'Internal server error generating attendance summary.' });
  }
};

export const getFleetUtilization = async (req: Request, res: Response): Promise<void> => {
  try {
    const [vehicles, fuelRecords, maintenanceRecords] = await Promise.all([
      prisma.vehicle.findMany({
        include: {
          assignments: { where: { status: 'ACTIVE' }, include: { employee: true } },
        },
      }),
      prisma.fuelRecord.findMany(),
      prisma.maintenanceRecord.findMany(),
    ]);

    const totalVehicles = vehicles.length;
    const activeAssignedVehicles = vehicles.filter((v) => v.assignments.length > 0).length;
    const totalKmDriven = vehicles.reduce((sum, v) => sum + Math.max(0, v.currentOdometer - v.initialOdometer), 0);
    const totalFuelCost = fuelRecords.reduce((sum, f) => sum + f.amount, 0);
    const totalFuelLiters = fuelRecords.reduce((sum, f) => sum + f.liters, 0);
    const totalMaintenanceCost = maintenanceRecords.reduce((sum, m) => sum + m.cost, 0);

    const avgKmPerLiter = totalFuelLiters > 0 && totalKmDriven > 0
      ? Math.round((totalKmDriven / totalFuelLiters) * 100) / 100
      : 0;

    res.json({
      success: true,
      data: {
        totalVehicles,
        activeAssignedVehicles,
        unassignedVehicles: totalVehicles - activeAssignedVehicles,
        totalKmDriven,
        totalFuelCost,
        totalFuelLiters,
        totalMaintenanceCost,
        totalFleetOperatingExpense: totalFuelCost + totalMaintenanceCost,
        avgKmPerLiter,
      },
    });
  } catch (error) {
    console.error('Error in getFleetUtilization:', error);
    res.status(500).json({ success: false, message: 'Internal server error calculating fleet utilization.' });
  }
};

export const exportCsv = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type = 'attendance', startDate, endDate } = req.query;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="safe_solutions_${type}_export_${Date.now()}.csv"`
    );

    if (type === 'attendance') {
      const records = await prisma.attendance.findMany({
        orderBy: { checkInTime: 'desc' },
        include: { employee: true, vehicle: true, office: true, site: true },
      });

      const header = 'Attendance ID,Employee Code,Employee Name,Department,Type,Date,CheckIn Time,Status,Geofence Violation,Distance (Meters),Odometer Reading\n';
      const rows = records.map((r) =>
        [
          r.id,
          `"${r.employee.employeeCode}"`,
          `"${r.employee.name}"`,
          `"${r.employee.department}"`,
          r.attendanceType,
          r.date.toISOString().slice(0, 10),
          r.checkInTime.toISOString(),
          r.approvalStatus,
          r.isGeofenceViolation ? 'YES' : 'NO',
          r.distanceFromTargetMeters || 0,
          r.odometerReading || 'N/A',
        ].join(',')
      );

      res.send(header + rows.join('\n'));
      return;
    }

    if (type === 'fuel') {
      const records = await prisma.fuelRecord.findMany({
        orderBy: { date: 'desc' },
        include: { employee: true, vehicle: true },
      });

      const header = 'Fuel Record ID,Date,Vehicle Plate,Employee Code,Employee Name,Fuel Type,Liters,Amount (PKR),Odometer Reading,Station\n';
      const rows = records.map((r) =>
        [
          r.id,
          r.date.toISOString().slice(0, 10),
          `"${r.vehicle.registrationNumber}"`,
          `"${r.employee.employeeCode}"`,
          `"${r.employee.name}"`,
          r.fuelType,
          r.liters,
          r.amount,
          r.odometerReading,
          `"${r.fuelStation || 'N/A'}"`,
        ].join(',')
      );

      res.send(header + rows.join('\n'));
      return;
    }

    if (type === 'fleet' || type === 'vehicles') {
      const records = await prisma.vehicle.findMany({
        include: {
          assignments: { where: { status: 'ACTIVE' }, include: { employee: true } },
        },
      });

      const header = 'Vehicle ID,Vehicle Code,Registration Plate,Type,Status,Initial Odometer,Current Odometer,Total KM Driven,Assigned Employee\n';
      const rows = records.map((r) =>
        [
          r.id,
          r.vehicleCode,
          `"${r.registrationNumber}"`,
          r.vehicleType,
          r.status,
          r.initialOdometer,
          r.currentOdometer,
          Math.max(0, r.currentOdometer - r.initialOdometer),
          `"${r.assignments[0]?.employee.name || 'Unassigned'}"`,
        ].join(',')
      );

      res.send(header + rows.join('\n'));
      return;
    }

    res.status(400).json({ success: false, message: 'Invalid export type. Allowed: attendance, fuel, fleet.' });
  } catch (error) {
    console.error('Error in exportCsv:', error);
    res.status(500).json({ success: false, message: 'Internal server error exporting CSV.' });
  }
};
