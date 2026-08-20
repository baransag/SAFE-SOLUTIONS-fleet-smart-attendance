import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import { Role, UserStatus, VehicleType, AssignmentStatus } from '@prisma/client';
import { createAuditLog } from '../utils/audit';

export const listEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, department, role, status, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (search) {
      const q = String(search).trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { employeeCode: { contains: q, mode: 'insensitive' } },
        { personalEmail: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { department: { contains: q, mode: 'insensitive' } },
        { designation: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (department) {
      where.department = { equals: String(department), mode: 'insensitive' };
    }

    if (status) {
      where.status = status as UserStatus;
    }

    if (role) {
      where.user = { role: role as Role };
    }

    const [total, employees] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { employeeCode: 'asc' },
        include: {
          user: {
            select: { id: true, email: true, role: true, status: true, mustChangePassword: true },
          },
          assignments: {
            where: { status: AssignmentStatus.ACTIVE },
            include: { vehicle: true },
          },
        },
      }),
    ]);

    const formatted = employees.map((emp) => {
      const activeAssignment = emp.assignments?.[0];
      return {
        id: emp.id,
        userId: emp.userId,
        employeeCode: emp.employeeCode,
        name: emp.name,
        phone: emp.phone,
        personalEmail: emp.personalEmail,
        department: emp.department,
        designation: emp.designation,
        conveyanceType: emp.conveyanceType,
        status: emp.status,
        profilePhotoUrl: emp.profilePhotoUrl,
        user: emp.user,
        activeVehicle: activeAssignment?.vehicle
          ? {
              id: activeAssignment.vehicle.id,
              vehicleCode: activeAssignment.vehicle.vehicleCode,
              registrationNumber: activeAssignment.vehicle.registrationNumber,
              vehicleType: activeAssignment.vehicle.vehicleType,
              currentOdometer: activeAssignment.vehicle.currentOdometer,
              qrCodeIdentifier: activeAssignment.vehicle.qrCodeIdentifier,
            }
          : null,
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
    console.error('Error in listEmployees:', error);
    res.status(500).json({ success: false, message: 'Internal server error while fetching employees.' });
  }
};

export const getEmployeeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const employee = await prisma.employee.findFirst({
      where: {
        OR: [{ id }, { employeeCode: id }],
      },
      include: {
        user: {
          select: { id: true, email: true, role: true, status: true, mustChangePassword: true, createdAt: true },
        },
        assignments: {
          orderBy: { assignedAt: 'desc' },
          include: {
            vehicle: true,
            assignedBy: { select: { id: true, email: true } },
          },
        },
        _count: {
          select: {
            attendances: true,
            fuelRecords: true,
          },
        },
      },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    const activeAssignment = employee.assignments.find((a) => a.status === AssignmentStatus.ACTIVE);

    res.json({
      success: true,
      data: {
        ...employee,
        activeVehicle: activeAssignment?.vehicle || null,
      },
    });
  } catch (error) {
    console.error('Error in getEmployeeById:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

export const createEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      employeeCode,
      email,
      phone,
      department,
      designation,
      conveyanceType = 'NONE',
      role = Role.EMPLOYEE,
      initialPassword,
      vehiclePlate,
      vehicleType,
    } = req.body;

    if (!name || !employeeCode || !email || !phone || !department || !designation) {
      res.status(400).json({
        success: false,
        message: 'Name, employeeCode, email, phone, department, and designation are required.',
      });
      return;
    }

    // Check unique conflicts
    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existingUser) {
      res.status(400).json({ success: false, message: 'A user with this email already exists.' });
      return;
    }

    const existingEmpCode = await prisma.employee.findUnique({ where: { employeeCode } });
    if (existingEmpCode) {
      res.status(400).json({ success: false, message: 'Employee code already in use.' });
      return;
    }

    const existingPhone = await prisma.employee.findUnique({ where: { phone } });
    if (existingPhone) {
      res.status(400).json({ success: false, message: 'Phone number already registered to another employee.' });
      return;
    }

    const tempPassword = initialPassword || `Safe@${employeeCode}!${phone.slice(-4)}`;
    const salt = await bcrypt.genSalt(12);
    const passHash = await bcrypt.hash(tempPassword, salt);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash: passHash,
        role: role as Role,
        status: UserStatus.ACTIVE,
        mustChangePassword: true,
      },
    });

    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        employeeCode,
        name,
        phone,
        personalEmail: email,
        department,
        designation,
        conveyanceType,
        joiningDate: new Date(),
        status: UserStatus.ACTIVE,
      },
    });

    // Optionally create and assign vehicle if provided
    let createdVehicle = null;
    if (vehiclePlate && vehicleType) {
      const vCode = `VEH-${employeeCode.replace(/[^a-zA-Z0-9]/g, '')}`;
      const qrId = `QR-VEH-${vehiclePlate.replace(/[^a-zA-Z0-9]/g, '')}`;

      createdVehicle = await prisma.vehicle.create({
        data: {
          vehicleCode: vCode,
          registrationNumber: vehiclePlate,
          vehicleType: vehicleType as VehicleType,
          initialOdometer: 0,
          currentOdometer: 0,
          qrCodeIdentifier: qrId,
          notes: `Created with employee ${name}`,
        },
      });

      await prisma.vehicleAssignment.create({
        data: {
          vehicleId: createdVehicle.id,
          employeeId: employee.id,
          assignedById: req.user!.id,
          status: AssignmentStatus.ACTIVE,
          notes: 'Initial assignment upon employee creation',
        },
      });
    }

    await createAuditLog({
      action: 'EMPLOYEE_CREATE',
      entityName: 'Employee',
      entityId: employee.id,
      newValue: { employeeCode, name, email, role, vehiclePlate },
      req,
    });

    res.status(201).json({
      success: true,
      message: 'Employee created successfully.',
      data: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        name: employee.name,
        email: user.email,
        temporaryPassword: tempPassword,
        role: user.role,
        vehicle: createdVehicle,
      },
    });
  } catch (error) {
    console.error('Error in createEmployee:', error);
    res.status(500).json({ success: false, message: 'Internal server error while creating employee.' });
  }
};

export const updateEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, phone, personalEmail, department, designation, conveyanceType, status, role } = req.body;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    const oldData = { ...employee };

    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: {
        name: name !== undefined ? name : employee.name,
        phone: phone !== undefined ? phone : employee.phone,
        personalEmail: personalEmail !== undefined ? personalEmail : employee.personalEmail,
        department: department !== undefined ? department : employee.department,
        designation: designation !== undefined ? designation : employee.designation,
        conveyanceType: conveyanceType !== undefined ? conveyanceType : employee.conveyanceType,
        status: status !== undefined ? (status as UserStatus) : employee.status,
      },
    });

    if (status !== undefined || role !== undefined) {
      await prisma.user.update({
        where: { id: employee.userId },
        data: {
          status: status !== undefined ? (status as UserStatus) : employee.user.status,
          role: role !== undefined ? (role as Role) : employee.user.role,
        },
      });
    }

    await createAuditLog({
      action: 'EMPLOYEE_UPDATE',
      entityName: 'Employee',
      entityId: employee.id,
      oldValue: oldData,
      newValue: updatedEmployee,
      req,
    });

    res.json({
      success: true,
      message: 'Employee updated successfully.',
      data: updatedEmployee,
    });
  } catch (error) {
    console.error('Error in updateEmployee:', error);
    res.status(500).json({ success: false, message: 'Internal server error while updating employee.' });
  }
};

export const resetEmployeePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    const tempPassword = newPassword || `Safe@${employee.employeeCode}!${employee.phone.slice(-4)}`;
    const salt = await bcrypt.genSalt(12);
    const passHash = await bcrypt.hash(tempPassword, salt);

    await prisma.user.update({
      where: { id: employee.userId },
      data: {
        passwordHash: passHash,
        mustChangePassword: true,
      },
    });

    await createAuditLog({
      action: 'EMPLOYEE_PASSWORD_RESET',
      entityName: 'User',
      entityId: employee.userId,
      newValue: { employeeCode: employee.employeeCode, resetBy: req.user?.id },
      req,
    });

    res.json({
      success: true,
      message: `Password reset successfully. Temporary password: ${tempPassword}`,
      temporaryPassword: tempPassword,
    });
  } catch (error) {
    console.error('Error in resetEmployeePassword:', error);
    res.status(500).json({ success: false, message: 'Internal server error while resetting password.' });
  }
};
