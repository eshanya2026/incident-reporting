import { Request, Response, NextFunction } from 'express';
import { Incident } from '../incidents/incident.model.js';
import { Capa } from '../capa/capa.model.js';
import { sendSuccess } from '../../common/helpers/response.js';

export const getIncidentRegisterReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { fromDate, toDate, departmentId, severity, status } = req.query;

    const query: any = {};
    if (fromDate || toDate) {
      query.incidentDateTime = {};
      if (fromDate) query.incidentDateTime.$gte = new Date(fromDate as string);
      if (toDate) query.incidentDateTime.$lte = new Date(toDate as string);
    }
    if (departmentId) query.departmentId = departmentId;
    if (severity) query.severity = parseInt(severity as string);
    if (status) query.status = status;

    const incidents = await Incident.find(query)
      .populate('reportedBy', 'name designation employeeId')
      .populate('departmentId', 'name code')
      .populate('locationId', 'name code')
      .populate('categoryId', 'name code')
      .populate('investigatorId', 'name designation')
      .sort({ incidentDateTime: -1 });

    sendSuccess(res, incidents, 'Incident Master Register report fetched');
  } catch (error) {
    next(error);
  }
};

export const getCapaRegisterReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, ownerDepartmentId } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (ownerDepartmentId) query.ownerDepartmentId = ownerDepartmentId;

    const capas = await Capa.find(query)
      .populate('incidentId', 'incidentNumber title severity')
      .populate('ownerUserId', 'name designation email')
      .populate('ownerDepartmentId', 'name code')
      .sort({ targetDate: 1 });

    sendSuccess(res, capas, 'CAPA Register report fetched');
  } catch (error) {
    next(error);
  }
};
