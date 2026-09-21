import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Attachment, EntityType } from './attachment.model.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { env } from '../../config/env.js';
import { canReadAttachment } from './attachmentAccess.js';

const ENTITY_TYPES: EntityType[] = ['INCIDENT', 'INVESTIGATION', 'RCA', 'CAPA'];

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

    // Files are linked to their record when the record is saved (see attachmentAccess.linkAttachments)
    const entityType: EntityType = ENTITY_TYPES.includes(req.body?.entityType) ? req.body.entityType : 'INCIDENT';

    // Calculate MD5 checksum
    const fileBuffer = fs.readFileSync(req.file.path);
    const checksum = crypto.createHash('md5').update(fileBuffer).digest('hex');

    const attachment = await Attachment.create({
      entityType,
      entityId: null,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      storagePath: req.file.filename,
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
    const attachment = await Attachment.findById(req.params.id);
    if (!attachment) {
      throw AppError.notFound('Attachment not found');
    }
    if (!(await canReadAttachment(req.user, attachment))) {
      throw AppError.forbidden('You do not have access to this file');
    }
    await attachment.populate('uploadedBy', 'name designation');
    sendSuccess(res, attachment, 'Attachment details retrieved');
  } catch (error) {
    next(error);
  }
};

/** Streams the file to users who may read it. Replaces the former public /uploads folder. */
export const downloadAttachment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const attachment = await Attachment.findById(req.params.id);
    if (!attachment) {
      throw AppError.notFound('Attachment not found');
    }
    if (!(await canReadAttachment(req.user, attachment))) {
      throw AppError.forbidden('You do not have access to this file');
    }

    const filePath = path.join(uploadDir, path.basename(attachment.storedName));
    if (!fs.existsSync(filePath)) {
      throw AppError.notFound('File is missing from storage');
    }

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.originalName)}"`);
    fs.createReadStream(filePath).on('error', next).pipe(res);
  } catch (error) {
    next(error);
  }
};
