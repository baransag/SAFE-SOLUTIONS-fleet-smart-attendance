import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const listAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { actorId, entityName, action, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (actorId) where.actorId = String(actorId);
    if (entityName) where.entityName = String(entityName);
    if (action) where.action = { contains: String(action), mode: 'insensitive' };

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, email: true, role: true } },
        },
      }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error in listAuditLogs:', error);
    res.status(500).json({ success: false, message: 'Internal server error while fetching audit logs.' });
  }
};
