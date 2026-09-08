import { Request, Response, NextFunction } from 'express';
import { Incident } from '../incidents/incident.model.js';
import { Capa } from '../capa/capa.model.js';
import { sendSuccess } from '../../common/helpers/response.js';

export const getDashboardSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query: any = {};
    const permissions = req.user?.permissions || [];

    if (!permissions.includes('report.view_all')) {
      if (permissions.includes('report.view_department') && req.user?.departmentId) {
        query.departmentId = req.user.departmentId;
      } else {
        query.reportedBy = req.user?.userId;
      }
    }

    const totalIncidents = await Incident.countDocuments(query);
    const openIncidents = await Incident.countDocuments({ ...query, status: { $ne: 'CLOSED' } });
    const criticalIncidents = await Incident.countDocuments({ ...query, severity: { $gte: 4 } });
    const nearMissCount = await Incident.countDocuments({ ...query, severity: 1 });
    const underInvestigationCount = await Incident.countDocuments({ ...query, status: 'UNDER_INVESTIGATION' });

    // CAPAs overdue
    const capaQuery: any = { status: { $in: ['OPEN', 'IN_PROGRESS'] }, targetDate: { $lt: new Date() } };
    if (query.departmentId) capaQuery.ownerDepartmentId = query.departmentId;
    const overdueCapas = await Capa.countDocuments(capaQuery);

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const closedThisMonth = await Incident.countDocuments({
      ...query,
      status: 'CLOSED',
      closedAt: { $gte: firstDayOfMonth },
    });

    sendSuccess(
      res,
      {
        totalIncidents,
        openIncidents,
        criticalIncidents,
        nearMissCount,
        underInvestigationCount,
        overdueCapas,
        closedThisMonth,
      },
      'Dashboard metrics summary retrieved'
    );
  } catch (error) {
    next(error);
  }
};

export const getSeverityDistribution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const distribution = await Incident.aggregate([
      {
        $group: {
          _id: { severity: '$severity', label: '$severityLabel' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.severity': 1 } },
    ]);

    sendSuccess(res, distribution, 'Severity distribution retrieved');
  } catch (error) {
    next(error);
  }
};

export const getCategoryDistribution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const distribution = await Incident.aggregate([
      {
        $lookup: {
          from: 'incidentcategories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$category.name',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    sendSuccess(res, distribution, 'Category distribution retrieved');
  } catch (error) {
    next(error);
  }
};

export const getDepartmentTrend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const trend = await Incident.aggregate([
      {
        $lookup: {
          from: 'departments',
          localField: 'departmentId',
          foreignField: '_id',
          as: 'department',
        },
      },
      { $unwind: '$department' },
      {
        $group: {
          _id: '$department.name',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    sendSuccess(res, trend, 'Department trend retrieved');
  } catch (error) {
    next(error);
  }
};

export const getCapaStatusSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const summary = await Capa.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    sendSuccess(res, summary, 'CAPA status summary retrieved');
  } catch (error) {
    next(error);
  }
};
