import { Request } from 'express';
import prisma from '../config/prisma';

export interface AuditParams {
  actorId?: string | null;
  action: string;
  entityName: string;
  entityId: string;
  oldValue?: any;
  newValue?: any;
  req?: Request;
}

/**
 * Creates an immutable AuditLog entry in the database.
 */
export async function createAuditLog(params: AuditParams): Promise<void> {
  try {
    const ipAddress = params.req
      ? (params.req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        params.req.socket?.remoteAddress ||
        params.req.ip ||
        'UNKNOWN_IP'
      : undefined;

    const userAgent = params.req
      ? (params.req.headers['user-agent'] as string) || 'UNKNOWN_USER_AGENT'
      : undefined;

    const actorId = params.actorId || (params.req?.user?.id ?? null);

    await prisma.auditLog.create({
      data: {
        actorId,
        action: params.action,
        entityName: params.entityName,
        entityId: params.entityId,
        oldValue: params.oldValue ? JSON.parse(JSON.stringify(params.oldValue)) : undefined,
        newValue: params.newValue ? JSON.parse(JSON.stringify(params.newValue)) : undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error('⚠️ Failed to write audit log:', error);
  }
}
