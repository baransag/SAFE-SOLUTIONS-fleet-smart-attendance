import prisma from '../config/prisma';
import { Role } from '@prisma/client';

export interface NotificationParams {
  recipientId?: string;
  recipientRoles?: Role[];
  type: string;
  title: string;
  message: string;
  entityName?: string;
  entityId?: string;
}

/**
 * Creates notifications for a single user or a group of roles (e.g. BOSS, CONTROLLER, MANAGER).
 */
export async function sendNotification(params: NotificationParams): Promise<void> {
  try {
    const recipientIds: string[] = [];

    if (params.recipientId) {
      recipientIds.push(params.recipientId);
    }

    if (params.recipientRoles && params.recipientRoles.length > 0) {
      const usersInRoles = await prisma.user.findMany({
        where: {
          role: { in: params.recipientRoles },
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      for (const u of usersInRoles) {
        if (!recipientIds.includes(u.id)) {
          recipientIds.push(u.id);
        }
      }
    }

    if (recipientIds.length === 0) return;

    await prisma.notification.createMany({
      data: recipientIds.map((rId) => ({
        recipientId: rId,
        type: params.type,
        title: params.title,
        message: params.message,
        entityName: params.entityName,
        entityId: params.entityId,
        isRead: false,
      })),
    });
  } catch (error) {
    console.error('⚠️ Failed to dispatch notification:', error);
  }
}
