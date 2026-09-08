import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Attachment, EntityType } from './attachment.model.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { env } from '../../config/env.js';

const uploadDir = path.resolve(process.cwd(), env.FILE_STORAGE_PATH);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const allowedMimeTypes = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024, // e.g. 10MB
  },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Invalid file type. Only PDF, PNG, JPG, and DOCX files are allowed.', 400, 'FILE_TYPE_NOT_ALLOWED'));
    }
  },
}).single('file');

export const uploadFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      throw AppError.badRequest('No file uploaded');
    }
    if (!req.user) {
      throw AppError.unauthorized('User not authenticated');
    }

    const { entityType, entityId } = req.body;

    // Calculate MD5 checksum
    const fileBuffer = fs.readFileSync(req.file.path);
    const checksum = crypto.createHash('md5').update(fileBuffer).digest('hex');

    const attachment = await Attachment.create({
      entityType: (entityType as EntityType) || 'INCIDENT',
      entityId: entityId || null,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      storagePath: `/uploads/${req.file.filename}`,
      uploadedBy: req.user.userId,
      checksum,
    });

    sendSuccess(res, attachment, 'File uploaded successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const getAttachmentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const attachment = await Attachment.findById(req.params.id).populate('uploadedBy', 'name designation');
    if (!attachment) {
      throw AppError.notFound('Attachment not found');
    }
    sendSuccess(res, attachment, 'Attachment details retrieved');
  } catch (error) {
    next(error);
  }
};
