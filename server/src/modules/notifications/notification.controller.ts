import { Request, Response, NextFunction } from 'express';
import { Notification } from './notification.model.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';

export const getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw AppError.unauthorized('User not authenticated');
    }

    const unreadCount = await Notification.countDocuments({
      userId: req.user.userId,
      read: false,
    });

    const notifications = await Notification.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(50);

    sendSuccess(res, { notifications, unreadCount }, 'Notifications retrieved');
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw AppError.unauthorized('User not authenticated');
    }

    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!notification) {
      throw AppError.notFound('Notification not found');
    }

    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    sendSuccess(res, notification, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw AppError.unauthorized('User not authenticated');
    }

    await Notification.updateMany(
      { userId: req.user.userId, read: false },
      { $set: { read: true, readAt: new Date() } }
    );

    sendSuccess(res, null, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
};
