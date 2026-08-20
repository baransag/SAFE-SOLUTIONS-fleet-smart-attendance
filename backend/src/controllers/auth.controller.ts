import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { config } from '../config/env';
import { createAuditLog } from '../utils/audit';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        employee: {
          include: {
            assignments: {
              where: { status: 'ACTIVE' },
              include: { vehicle: true },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    if (user.status !== 'ACTIVE') {
      res.status(403).json({ success: false, message: 'Your account is deactivated or suspended.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
    );

    const activeAssignment = user.employee?.assignments?.[0];

    // Audit login
    await createAuditLog({
      actorId: user.id,
      action: 'USER_LOGIN',
      entityName: 'User',
      entityId: user.id,
      newValue: { email: user.email, role: user.role },
      req,
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        mustChangePassword: user.mustChangePassword,
        employee: user.employee
          ? {
              id: user.employee.id,
              employeeCode: user.employee.employeeCode,
              name: user.employee.name,
              phone: user.employee.phone,
              department: user.employee.department,
              designation: user.employee.designation,
              conveyanceType: user.employee.conveyanceType,
              profilePhotoUrl: user.employee.profilePhotoUrl,
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
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ success: false, message: 'Internal server error during login.' });
  }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, message: 'Current password and new password are required.' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    });

    await createAuditLog({
      actorId: userId,
      action: 'USER_CHANGE_PASSWORD',
      entityName: 'User',
      entityId: userId,
      req,
    });

    res.json({
      success: true,
      message: 'Password changed successfully. You can now access all features.',
    });
  } catch (error) {
    console.error('Error in changePassword:', error);
    res.status(500).json({ success: false, message: 'Internal server error while changing password.' });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        employee: {
          include: {
            assignments: {
              where: { status: 'ACTIVE' },
              include: { vehicle: true },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const activeAssignment = user.employee?.assignments?.[0];

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        mustChangePassword: user.mustChangePassword,
        employee: user.employee
          ? {
              id: user.employee.id,
              employeeCode: user.employee.employeeCode,
              name: user.employee.name,
              phone: user.employee.phone,
              personalEmail: user.employee.personalEmail,
              department: user.employee.department,
              designation: user.employee.designation,
              conveyanceType: user.employee.conveyanceType,
              profilePhotoUrl: user.employee.profilePhotoUrl,
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
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Error in getMe:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};
