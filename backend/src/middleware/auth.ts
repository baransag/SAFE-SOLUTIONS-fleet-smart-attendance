import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import prisma from '../config/prisma';
import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  employeeId?: string;
  employeeCode?: string;
  employeeName?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret) as { id: string; email: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { employee: true },
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'User account not found or deactivated.' });
      return;
    }

    if (user.status !== 'ACTIVE') {
      res.status(403).json({ success: false, message: 'Your account is suspended or inactive.' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      employeeId: user.employee?.id,
      employeeCode: user.employee?.employeeCode,
      employeeName: user.employee?.name,
    };

    // If user must change password, allow only change-password and me endpoints
    if (user.mustChangePassword && !req.path.includes('/auth/change-password') && !req.path.includes('/auth/me')) {
      res.status(403).json({
        success: false,
        mustChangePassword: true,
        message: 'You must change your temporary password before accessing the system.',
      });
      return;
    }

    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired authentication token.' });
  }
};

export const requireRoles = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: You do not have permission. Required roles: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
};
