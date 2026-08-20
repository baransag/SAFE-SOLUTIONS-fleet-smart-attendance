import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { FuelType, Role } from '@prisma/client';
import { createAuditLog } from '../utils/audit';
import { sendNotification } from '../utils/notification';
import { getFileUrl } from '../middleware/upload';

export const listFuelRecords = async (req: Request, res: Response): Promise<void> => {
  try {
    const { vehicleId, employeeId, startDate, endDate, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (vehicleId) where.vehicleId = String(vehicleId);
    if (employeeId) where.employeeId = String(employeeId);

    // Regular employee can only view their own fuel logs unless manager/boss/controller
    if (req.user?.role === Role.EMPLOYEE && req.user.employeeId) {
      where.employeeId = req.user.employeeId;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(String(startDate));
      if (endDate) {
        const end = new Date(String(endDate));
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    const [total, records] = await Promise.all([
      prisma.fuelRecord.count({ where }),
      prisma.fuelRecord.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { date: 'desc' },
        include: {
          vehicle: true,
          employee: true,
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
    console.error('Error in listFuelRecords:', error);
    res.status(500).json({ success: false, message: 'Internal server error while fetching fuel records.' });
  }
};

export const createFuelRecord = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const currentEmployeeId = req.user?.employeeId;

    const {
      vehicleId,
      employeeId,
      liters,
      amount,
      odometerReading,
      fuelType = FuelType.PETROL,
      fuelStation,
      notes,
    } = req.body;

    const targetEmployeeId = employeeId || currentEmployeeId;

    if (!vehicleId || !liters || !amount || !odometerReading) {
      res.status(400).json({
        success: false,
        message: 'vehicleId, liters, amount, and odometerReading are required.',
      });
      return;
    }

    if (!targetEmployeeId) {
      res.status(400).json({
        success: false,
        message: 'employeeId could not be identified for fuel logging.',
      });
      return;
    }

    const parsedLiters = parseFloat(liters);
    const parsedAmount = parseFloat(amount);
    const parsedOdometer = parseInt(odometerReading, 10);

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      res.status(404).json({ success: false, message: 'Vehicle not found.' });
      return;
    }

    const receiptFile = req.file;
    const receiptPhotoUrl = receiptFile ? getFileUrl(receiptFile) : req.body.receiptPhotoUrl || null;

    const fuelRecord = await prisma.fuelRecord.create({
      data: {
        vehicleId,
        employeeId: targetEmployeeId,
        fuelType: fuelType as FuelType,
        liters: parsedLiters,
        amount: parsedAmount,
        odometerReading: parsedOdometer,
        receiptPhotoUrl,
        fuelStation: fuelStation || null,
        notes: notes || null,
        createdById: userId,
      },
      include: {
        vehicle: true,
        employee: true,
      },
    });

    // Update vehicle's current odometer if new reading is higher
    if (parsedOdometer > vehicle.currentOdometer) {
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: { currentOdometer: parsedOdometer },
      });
    }

    // Audit and Notify
    await createAuditLog({
      action: 'FUEL_LOG_CREATE',
      entityName: 'FuelRecord',
      entityId: fuelRecord.id,
      newValue: {
        vehiclePlate: vehicle.registrationNumber,
        liters: parsedLiters,
        amount: parsedAmount,
        odometer: parsedOdometer,
      },
      req,
    });

    await sendNotification({
      recipientRoles: [Role.BOSS, Role.CONTROLLER],
      type: 'FUEL_CLAIM_SUBMITTED',
      title: 'Fuel Claim Submitted',
      message: `${fuelRecord.employee.name} logged ${parsedLiters}L (PKR ${parsedAmount}) for ${vehicle.registrationNumber}.`,
      entityName: 'FuelRecord',
      entityId: fuelRecord.id,
    });

    res.status(201).json({
      success: true,
      message: 'Fuel record logged successfully.',
      data: fuelRecord,
    });
  } catch (error) {
    console.error('Error in createFuelRecord:', error);
    res.status(500).json({ success: false, message: 'Internal server error while logging fuel.' });
  }
};

export const getMileageAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { vehicleId } = req.query;

    const vehicles = await prisma.vehicle.findMany({
      where: vehicleId ? { id: String(vehicleId) } : {},
      include: {
        fuelRecords: {
          orderBy: { odometerReading: 'asc' },
        },
        assignments: {
          where: { status: 'ACTIVE' },
          include: { employee: true },
        },
      },
    });

    const analytics = vehicles.map((v) => {
      const records = v.fuelRecords;
      const totalFuelLiters = records.reduce((sum, r) => sum + r.liters, 0);
      const totalFuelCost = records.reduce((sum, r) => sum + r.amount, 0);

      let totalDistanceKm = 0;
      let kmPerLiter = 0;
      let costPerKm = 0;

      if (records.length >= 2) {
        const minOdo = records[0].odometerReading;
        const maxOdo = records[records.length - 1].odometerReading;
        totalDistanceKm = Math.max(0, maxOdo - minOdo);
        
        // Sum liters excluding the first full-tank/entry for standard delta calculation or total
        if (totalFuelLiters > 0 && totalDistanceKm > 0) {
          kmPerLiter = Math.round((totalDistanceKm / totalFuelLiters) * 100) / 100;
          costPerKm = Math.round((totalFuelCost / totalDistanceKm) * 100) / 100;
        }
      } else if (records.length === 1) {
        totalDistanceKm = Math.max(0, v.currentOdometer - v.initialOdometer);
        if (totalFuelLiters > 0 && totalDistanceKm > 0) {
          kmPerLiter = Math.round((totalDistanceKm / totalFuelLiters) * 100) / 100;
          costPerKm = Math.round((totalFuelCost / totalDistanceKm) * 100) / 100;
        }
      }

      return {
        vehicleId: v.id,
        vehicleCode: v.vehicleCode,
        registrationNumber: v.registrationNumber,
        vehicleType: v.vehicleType,
        assignedEmployee: v.assignments[0]?.employee.name || 'Unassigned',
        initialOdometer: v.initialOdometer,
        currentOdometer: v.currentOdometer,
        totalFuelEntries: records.length,
        totalFuelLiters: Math.round(totalFuelLiters * 100) / 100,
        totalFuelCost: Math.round(totalFuelCost * 100) / 100,
        totalDistanceKm,
        kmPerLiter,
        costPerKm,
      };
    });

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Error in getMileageAnalytics:', error);
    res.status(500).json({ success: false, message: 'Internal server error calculating analytics.' });
  }
};
