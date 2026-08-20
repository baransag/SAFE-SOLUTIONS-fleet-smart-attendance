import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { createAuditLog } from '../utils/audit';

export const listOffices = async (req: Request, res: Response): Promise<void> => {
  try {
    const offices = await prisma.officeLocation.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: offices });
  } catch (error) {
    console.error('Error in listOffices:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

export const createOffice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, address, latitude, longitude, allowedRadiusMeters = 150, qrCodeIdentifier } = req.body;

    if (!name || !address || latitude === undefined || longitude === undefined) {
      res.status(400).json({ success: false, message: 'Name, address, latitude, and longitude are required.' });
      return;
    }

    const qrId = qrCodeIdentifier || `QR-OFFICE-${Date.now().toString().slice(-4)}`;

    const office = await prisma.officeLocation.create({
      data: {
        name,
        address,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        allowedRadiusMeters: parseFloat(allowedRadiusMeters),
        qrCodeIdentifier: qrId,
      },
    });

    await createAuditLog({
      action: 'OFFICE_CREATE',
      entityName: 'OfficeLocation',
      entityId: office.id,
      newValue: office,
      req,
    });

    res.status(201).json({ success: true, data: office });
  } catch (error) {
    console.error('Error in createOffice:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

export const listSites = async (req: Request, res: Response): Promise<void> => {
  try {
    const sites = await prisma.siteRegistry.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: sites });
  } catch (error) {
    console.error('Error in listSites:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

export const createSite = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, clientName, projectName, address, latitude, longitude, radiusMeters = 300 } = req.body;

    if (!name) {
      res.status(400).json({ success: false, message: 'Site name is required.' });
      return;
    }

    const site = await prisma.siteRegistry.create({
      data: {
        name,
        clientName: clientName || null,
        projectName: projectName || null,
        address: address || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        radiusMeters: radiusMeters ? parseFloat(radiusMeters) : 300,
        isActive: true,
      },
    });

    await createAuditLog({
      action: 'SITE_CREATE',
      entityName: 'SiteRegistry',
      entityId: site.id,
      newValue: site,
      req,
    });

    res.status(201).json({ success: true, data: site });
  } catch (error) {
    console.error('Error in createSite:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};
