import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env';

// Ensure base upload directory exists
if (!fs.existsSync(config.uploadPath)) {
  fs.mkdirSync(config.uploadPath, { recursive: true });
}

// Subdirectories for organized storage
const subdirs = ['selfies', 'meters', 'sites', 'fuel', 'maintenance', 'profiles'];
for (const sub of subdirs) {
  const dir = path.join(config.uploadPath, sub);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subfolder = 'misc';
    if (file.fieldname === 'selfie' || file.fieldname === 'selfiePhoto') {
      subfolder = 'selfies';
    } else if (file.fieldname === 'meterPhoto' || file.fieldname === 'meter') {
      subfolder = 'meters';
    } else if (file.fieldname === 'sitePhoto' || file.fieldname === 'site') {
      subfolder = 'sites';
    } else if (file.fieldname === 'receiptPhoto' || file.fieldname === 'fuelReceipt') {
      subfolder = 'fuel';
    } else if (file.fieldname === 'invoicePhoto' || file.fieldname === 'invoice') {
      subfolder = 'maintenance';
    } else if (file.fieldname === 'profilePhoto') {
      subfolder = 'profiles';
    }

    const targetDir = path.join(config.uploadPath, subfolder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueName = `${Date.now()}-${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (allowedMimeTypes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, WebP) are allowed.'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024, // Max size in MB
  },
});

/**
 * Returns a relative web URL path for the saved file.
 */
export function getFileUrl(file?: Express.Multer.File): string | undefined {
  if (!file) return undefined;
  const relativePath = path.relative(config.uploadPath, file.path).replace(/\\/g, '/');
  return `/uploads/${relativePath}`;
}
