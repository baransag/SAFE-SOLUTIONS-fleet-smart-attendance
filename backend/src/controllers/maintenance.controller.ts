import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { MaintenanceType, MaintenanceStatus, Role } from '@prisma/client';
import { createAuditLog } from '../utils/audit';
import { sendNotification } from '../utils/notification';
import { getFileUrl } from '../middleware/upload';

export const listMaintenance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { vehicleId, status, type, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (vehicleId) where.vehicleId = String(vehicleId);
    if (status) where.status = status as MaintenanceStatus;
    if (type) where.maintenanceType = type as MaintenanceType;

    const [total, records] = await Promise.all([
      prisma.maintenanceRecord.count({ where }),
      prisma.maintenanceRecord.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { serviceDate: 'desc' },
        include: {
          vehicle: {
            include: {
              assignments: {
                where: { status: 'ACTIVE' },
                include: { employee: true },
              },
            },
          },
          createdBy: { select: { id: true, email: true } },
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
    console.error('Error in listMaintenance:', error);
    res.status(500).json({ success: false, message: 'Internal server error while fetching maintenance records.' });
  }
};

export const createMaintenance = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const {
      vehicleId,
      maintenanceType = MaintenanceType.ROUTINE_SERVICE,
      serviceDate,
      odometerReading,
      cost,
      vendorName,
      description,
      nextServiceDate,
      nextServiceOdometer,
      status = MaintenanceStatus.COMPLETED,
    } = req.body;

    if (!vehicleId || !description || cost === undefined || odometerReading === undefined) {
      res.status(400).json({
        success: false,
        message: 'vehicleId, description, cost, and odometerReading are required.',
      });
      return;
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      res.status(404).json({ success: false, message: 'Vehicle not found.' });
      return;
    }

    const parsedOdometer = parseInt(odometerReading, 10);
    const parsedCost = parseFloat(cost);
    const parsedNextOdometer = nextServiceOdometer ? parseInt(nextServiceOdometer, 10) : null;
    const parsedServiceDate = serviceDate ? new Date(serviceDate) : new Date();
    const parsedNextDate = nextServiceDate ? new Date(nextServiceDate) : null;

    const invoiceFile = req.file;
    const invoicePhotoUrl = invoiceFile ? getFileUrl(invoiceFile) : req.body.invoicePhotoUrl || null;

    const record = await prisma.maintenanceRecord.create({
      data: {
        vehicleId,
        maintenanceType: maintenanceType as MaintenanceType,
        serviceDate: parsedServiceDate,
        odometerReading: parsedOdometer,
        cost: parsedCost,
        vendorName: vendorName || null,
        description,
        invoicePhotoUrl,
        nextServiceDate: parsedNextDate,
        nextServiceOdometer: parsedNextOdometer,
        status: status as MaintenanceStatus,
        createdById: userId,
      },
      include: {
        vehicle: true,
      },
    });

    // Update vehicle odometer if higher
    if (parsedOdometer > vehicle.currentOdometer) {
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: { currentOdometer: parsedOdometer },
      });
    }

    // Audit and Notify
    await createAuditLog({
      action: 'MAINTENANCE_RECORD_CREATE',
      entityName: 'MaintenanceRecord',
      entityId: record.id,
      newValue: {
        vehiclePlate: vehicle.registrationNumber,
        cost: parsedCost,
        type: maintenanceType,
        description,
      },
      req,
    });

    await sendNotification({
      recipientRoles: [Role.BOSS, Role.CONTROLLER],
      type: 'MAINTENANCE_LOGGED',
      title: 'Vehicle Maintenance Logged',
      message: `Maintenance (${maintenanceType}) logged for ${vehicle.registrationNumber} (Cost: PKR ${parsedCost}).`,
      entityName: 'MaintenanceRecord',
      entityId: record.id,
    });

    res.status(201).json({
      success: true,
      message: 'Maintenance record created successfully.',
      data: record,
    });
  } catch (error) {
    console.error('Error in createMaintenance:', error);
    res.status(500).json({ success: false, message: 'Internal server error while creating maintenance record.' });
  }
};

export const updateMaintenance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { cost, vendorName, description, nextServiceDate, nextServiceOdometer, status } = req.body;

    const existing = await prisma.maintenanceRecord.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Maintenance record not found.' });
      return;
    }

    const oldState = { ...existing };

    const updated = await prisma.maintenanceRecord.update({
      where: { id },
      data: {
        cost: cost !== undefined ? parseFloat(cost) : existing.cost,
        vendorName: vendorName !== undefined ? vendorName : existing.vendorName,
        description: description !== undefined ? description : existing.description,
        nextServiceDate: nextServiceDate !== undefined ? (nextServiceDate ? new Date(nextServiceDate) : null) : existing.nextServiceDate,
        nextServiceOdometer: nextServiceOdometer !== undefined ? (nextServiceOdometer ? parseInt(nextServiceOdometer, 10) : null) : existing.nextServiceOdometer,
        status: status !== undefined ? (status as MaintenanceStatus) : existing.status,
      },
    });

    await createAuditLog({
      action: 'MAINTENANCE_RECORD_UPDATE',
      entityName: 'MaintenanceRecord',
      entityId: id,
      oldValue: oldState,
      newValue: updated,
      req,
    });

    res.json({
      success: true,
      message: 'Maintenance record updated.',
      data: updated,
    });
  } catch (error) {
    console.error('Error in updateMaintenance:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

export const getMaintenanceAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    const vehicles = await prisma.vehicle.findMany({
      where: { status: 'ACTIVE' },
      include: {
        assignments: {
          where: { status: 'ACTIVE' },
          include: { employee: true },
        },
        maintenanceRecords: {
          orderBy: { serviceDate: 'desc' },
          take: 1,
        },
      },
    });

    const overdue: any[] = [];
    const upcoming: any[] = [];

    for (const v of vehicles) {
      const lastMaint = v.maintenanceRecords[0];
      if (!lastMaint) continue;

      const assignedEmployee = v.assignments[0]?.employee.name || 'Unassigned';

      // Check date alerts
      if (lastMaint.nextServiceDate) {
        if (lastMaint.nextServiceDate <= now) {
          overdue.push({
            vehicleId: v.id,
            registrationNumber: v.registrationNumber,
            vehicleCode: v.vehicleCode,
            assignedEmployee,
            reason: `Service overdue by date (Due: ${lastMaint.nextServiceDate.toISOString().slice(0, 10)})`,
            lastServiceDate: lastMaint.serviceDate,
            nextServiceDate: lastMaint.nextServiceDate,
            currentOdometer: v.currentOdometer,
            nextServiceOdometer: lastMaint.nextServiceOdometer,
          });
          continue;
        } else if (lastMaint.nextServiceDate <= in15Days) {
          upcoming.push({
            vehicleId: v.id,
            registrationNumber: v.registrationNumber,
            vehicleCode: v.vehicleCode,
            assignedEmployee,
            reason: `Service due soon on ${lastMaint.nextServiceDate.toISOString().slice(0, 10)}`,
            lastServiceDate: lastMaint.serviceDate,
            nextServiceDate: lastMaint.nextServiceDate,
            currentOdometer: v.currentOdometer,
            nextServiceOdometer: lastMaint.nextServiceOdometer,
          });
          continue;
        }
      }

      // Check odometer alerts
      if (lastMaint.nextServiceOdometer) {
        if (v.currentOdometer >= lastMaint.nextServiceOdometer) {
          overdue.push({
            vehicleId: v.id,
            registrationNumber: v.registrationNumber,
            vehicleCode: v.vehicleCode,
            assignedEmployee,
            reason: `Service overdue by mileage (Current: ${v.currentOdometer} KM, Due: ${lastMaint.nextServiceOdometer} KM)`,
            lastServiceDate: lastMaint.serviceDate,
            currentOdometer: v.currentOdometer,
            nextServiceOdometer: lastMaint.nextServiceOdometer,
          });
        } else if (lastMaint.nextServiceOdometer - v.currentOdometer <= 500) {
          upcoming.push({
            vehicleId: v.id,
            registrationNumber: v.registrationNumber,
            vehicleCode: v.vehicleCode,
            assignedEmployee,
            reason: `Service due within ${lastMaint.nextServiceOdometer - v.currentOdometer} KM`,
            lastServiceDate: lastMaint.serviceDate,
            currentOdometer: v.currentOdometer,
            nextServiceOdometer: lastMaint.nextServiceOdometer,
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        overdueCount: overdue.length,
        upcomingCount: upcoming.length,
        overdue,
        upcoming,
      },
    });
  } catch (error) {
    console.error('Error in getMaintenanceAlerts:', error);
    res.status(500).json({ success: false, message: 'Internal server error calculating maintenance alerts.' });
  }
};
