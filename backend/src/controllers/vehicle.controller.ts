import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { VehicleType, VehicleStatus, AssignmentStatus, Role } from '@prisma/client';
import { createAuditLog } from '../utils/audit';

export const listVehicles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, type, status, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (search) {
      const q = String(search).trim();
      where.OR = [
        { registrationNumber: { contains: q, mode: 'insensitive' } },
        { vehicleCode: { contains: q, mode: 'insensitive' } },
        { qrCodeIdentifier: { contains: q, mode: 'insensitive' } },
        { make: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (type) {
      where.vehicleType = type as VehicleType;
    }

    if (status) {
      where.status = status as VehicleStatus;
    }

    const [total, vehicles] = await Promise.all([
      prisma.vehicle.count({ where }),
      prisma.vehicle.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { vehicleCode: 'asc' },
        include: {
          assignments: {
            where: { status: AssignmentStatus.ACTIVE },
            include: {
              employee: {
                select: { id: true, employeeCode: true, name: true, phone: true, department: true },
              },
            },
          },
          _count: {
            select: {
              fuelRecords: true,
              maintenanceRecords: true,
              attendances: true,
            },
          },
        },
      }),
    ]);

    const formatted = vehicles.map((v) => {
      const activeAssign = v.assignments[0];
      return {
        id: v.id,
        vehicleCode: v.vehicleCode,
        registrationNumber: v.registrationNumber,
        vehicleType: v.vehicleType,
        make: v.make,
        model: v.model,
        color: v.color,
        initialOdometer: v.initialOdometer,
        currentOdometer: v.currentOdometer,
        status: v.status,
        qrCodeIdentifier: v.qrCodeIdentifier,
        notes: v.notes,
        currentAssignment: activeAssign
          ? {
              id: activeAssign.id,
              employeeId: activeAssign.employeeId,
              employeeCode: activeAssign.employee.employeeCode,
              employeeName: activeAssign.employee.name,
              department: activeAssign.employee.department,
              assignedAt: activeAssign.assignedAt,
            }
          : null,
        counts: v._count,
      };
    });

    res.json({
      success: true,
      data: formatted,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error in listVehicles:', error);
    res.status(500).json({ success: false, message: 'Internal server error while fetching vehicles.' });
  }
};

export const getVehicleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [{ id }, { vehicleCode: id }, { registrationNumber: id }, { qrCodeIdentifier: id }],
      },
      include: {
        assignments: {
          orderBy: { assignedAt: 'desc' },
          include: {
            employee: {
              select: { id: true, employeeCode: true, name: true, phone: true, department: true },
            },
            assignedBy: {
              select: { id: true, email: true },
            },
          },
        },
        fuelRecords: {
          orderBy: { date: 'desc' },
          take: 10,
          include: {
            employee: { select: { id: true, name: true, employeeCode: true } },
          },
        },
        maintenanceRecords: {
          orderBy: { serviceDate: 'desc' },
          take: 10,
        },
      },
    });

    if (!vehicle) {
      res.status(404).json({ success: false, message: 'Vehicle not found.' });
      return;
    }

    const activeAssignment = vehicle.assignments.find((a) => a.status === AssignmentStatus.ACTIVE);

    res.json({
      success: true,
      data: {
        ...vehicle,
        activeAssignment: activeAssignment || null,
      },
    });
  } catch (error) {
    console.error('Error in getVehicleById:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

export const createVehicle = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      vehicleCode,
      registrationNumber,
      vehicleType = VehicleType.BIKE,
      make,
      model,
      color,
      initialOdometer = 0,
      notes,
    } = req.body;

    if (!registrationNumber) {
      res.status(400).json({ success: false, message: 'Registration number is required.' });
      return;
    }

    const vCode = vehicleCode || `VEH-${Date.now().toString().slice(-4)}`;
    const qrIdentifier = `QR-VEH-${registrationNumber.replace(/[^a-zA-Z0-9]/g, '')}`;

    const existingPlate = await prisma.vehicle.findUnique({ where: { registrationNumber } });
    if (existingPlate) {
      res.status(400).json({ success: false, message: 'Vehicle with this registration plate already exists.' });
      return;
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        vehicleCode: vCode,
        registrationNumber,
        vehicleType: vehicleType as VehicleType,
        make,
        model,
        color,
        initialOdometer: parseInt(initialOdometer, 10) || 0,
        currentOdometer: parseInt(initialOdometer, 10) || 0,
        qrCodeIdentifier: qrIdentifier,
        notes,
      },
    });

    await createAuditLog({
      action: 'VEHICLE_CREATE',
      entityName: 'Vehicle',
      entityId: vehicle.id,
      newValue: vehicle,
      req,
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle created successfully.',
      data: vehicle,
    });
  } catch (error) {
    console.error('Error in createVehicle:', error);
    res.status(500).json({ success: false, message: 'Internal server error while creating vehicle.' });
  }
};

export const updateVehicle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { registrationNumber, vehicleType, make, model, color, status, currentOdometer, notes } = req.body;

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      res.status(404).json({ success: false, message: 'Vehicle not found.' });
      return;
    }

    const oldData = { ...vehicle };

    const updatedVehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        registrationNumber: registrationNumber !== undefined ? registrationNumber : vehicle.registrationNumber,
        vehicleType: vehicleType !== undefined ? (vehicleType as VehicleType) : vehicle.vehicleType,
        make: make !== undefined ? make : vehicle.make,
        model: model !== undefined ? model : vehicle.model,
        color: color !== undefined ? color : vehicle.color,
        status: status !== undefined ? (status as VehicleStatus) : vehicle.status,
        currentOdometer: currentOdometer !== undefined ? parseInt(currentOdometer, 10) : vehicle.currentOdometer,
        notes: notes !== undefined ? notes : vehicle.notes,
      },
    });

    await createAuditLog({
      action: 'VEHICLE_UPDATE',
      entityName: 'Vehicle',
      entityId: vehicle.id,
      oldValue: oldData,
      newValue: updatedVehicle,
      req,
    });

    res.json({
      success: true,
      message: 'Vehicle updated successfully.',
      data: updatedVehicle,
    });
  } catch (error) {
    console.error('Error in updateVehicle:', error);
    res.status(500).json({ success: false, message: 'Internal server error while updating vehicle.' });
  }
};

export const assignVehicle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // Vehicle ID
    const { employeeId, notes } = req.body;

    if (!employeeId) {
      res.status(400).json({ success: false, message: 'employeeId is required.' });
      return;
    }

    const [vehicle, employee] = await Promise.all([
      prisma.vehicle.findUnique({ where: { id } }),
      prisma.employee.findUnique({ where: { id: employeeId } }),
    ]);

    if (!vehicle) {
      res.status(404).json({ success: false, message: 'Vehicle not found.' });
      return;
    }

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    // Terminate any previous active assignments on this vehicle
    await prisma.vehicleAssignment.updateMany({
      where: { vehicleId: vehicle.id, status: AssignmentStatus.ACTIVE },
      data: {
        status: AssignmentStatus.TERMINATED,
        unassignedAt: new Date(),
        notes: 'Terminated due to reassignment',
      },
    });

    // Terminate any other vehicle assignment this employee might have
    await prisma.vehicleAssignment.updateMany({
      where: { employeeId: employee.id, status: AssignmentStatus.ACTIVE },
      data: {
        status: AssignmentStatus.TERMINATED,
        unassignedAt: new Date(),
        notes: 'Terminated due to new vehicle assignment',
      },
    });

    // Create new assignment
    const assignment = await prisma.vehicleAssignment.create({
      data: {
        vehicleId: vehicle.id,
        employeeId: employee.id,
        assignedById: req.user!.id,
        status: AssignmentStatus.ACTIVE,
        notes: notes || `Assigned to ${employee.name}`,
      },
      include: {
        vehicle: true,
        employee: true,
      },
    });

    await createAuditLog({
      action: 'VEHICLE_ASSIGN',
      entityName: 'VehicleAssignment',
      entityId: assignment.id,
      newValue: { vehicleId: vehicle.id, employeeId: employee.id, employeeName: employee.name },
      req,
    });

    res.json({
      success: true,
      message: `Vehicle [${vehicle.registrationNumber}] successfully assigned to ${employee.name}.`,
      data: assignment,
    });
  } catch (error) {
    console.error('Error in assignVehicle:', error);
    res.status(500).json({ success: false, message: 'Internal server error during vehicle assignment.' });
  }
};

export const unassignVehicle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const activeAssignment = await prisma.vehicleAssignment.findFirst({
      where: { vehicleId: id, status: AssignmentStatus.ACTIVE },
      include: { employee: true, vehicle: true },
    });

    if (!activeAssignment) {
      res.status(400).json({ success: false, message: 'Vehicle currently has no active assignment.' });
      return;
    }

    const updated = await prisma.vehicleAssignment.update({
      where: { id: activeAssignment.id },
      data: {
        status: AssignmentStatus.TERMINATED,
        unassignedAt: new Date(),
        notes: notes || 'Unassigned by management',
      },
    });

    await createAuditLog({
      action: 'VEHICLE_UNASSIGN',
      entityName: 'VehicleAssignment',
      entityId: activeAssignment.id,
      oldValue: activeAssignment,
      newValue: updated,
      req,
    });

    res.json({
      success: true,
      message: `Vehicle [${activeAssignment.vehicle.registrationNumber}] unassigned from ${activeAssignment.employee.name}.`,
      data: updated,
    });
  } catch (error) {
    console.error('Error in unassignVehicle:', error);
    res.status(500).json({ success: false, message: 'Internal server error while unassigning vehicle.' });
  }
};

export const getVehicleQr = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const vehicle = await prisma.vehicle.findFirst({
      where: { OR: [{ id }, { vehicleCode: id }, { registrationNumber: id }] },
      include: {
        assignments: {
          where: { status: AssignmentStatus.ACTIVE },
          include: { employee: true },
        },
      },
    });

    if (!vehicle) {
      res.status(404).json({ success: false, message: 'Vehicle not found.' });
      return;
    }

    const activeAssign = vehicle.assignments[0];

    res.json({
      success: true,
      data: {
        id: vehicle.id,
        vehicleCode: vehicle.vehicleCode,
        registrationNumber: vehicle.registrationNumber,
        vehicleType: vehicle.vehicleType,
        qrCodeIdentifier: vehicle.qrCodeIdentifier,
        currentAssignedEmployee: activeAssign ? activeAssign.employee.name : 'Unassigned',
        qrDataPayload: JSON.stringify({
          type: 'SAFE_SOLUTIONS_VEHICLE',
          qrCodeIdentifier: vehicle.qrCodeIdentifier,
          registrationNumber: vehicle.registrationNumber,
          vehicleId: vehicle.id,
        }),
      },
    });
  } catch (error) {
    console.error('Error in getVehicleQr:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

export const resolveQr = async (req: Request, res: Response): Promise<void> => {
  try {
    const { qrCode } = req.params;
    const currentEmployeeId = req.user?.employeeId;

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [{ qrCodeIdentifier: qrCode }, { registrationNumber: qrCode }],
      },
      include: {
        assignments: {
          where: { status: AssignmentStatus.ACTIVE },
          include: { employee: true },
        },
      },
    });

    if (!vehicle) {
      res.status(404).json({
        success: false,
        message: 'Invalid QR Code: Vehicle not found in system.',
      });
      return;
    }

    const activeAssign = vehicle.assignments[0];
    const isAssignedToCurrentUser = activeAssign?.employeeId === currentEmployeeId;

    res.json({
      success: true,
      data: {
        vehicleId: vehicle.id,
        vehicleCode: vehicle.vehicleCode,
        registrationNumber: vehicle.registrationNumber,
        vehicleType: vehicle.vehicleType,
        currentOdometer: vehicle.currentOdometer,
        qrCodeIdentifier: vehicle.qrCodeIdentifier,
        isAssignedToCurrentUser,
        assignedTo: activeAssign
          ? {
              employeeId: activeAssign.employee.id,
              employeeCode: activeAssign.employee.employeeCode,
              name: activeAssign.employee.name,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Error in resolveQr:', error);
    res.status(500).json({ success: false, message: 'Internal server error resolving QR code.' });
  }
};
