import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real send path (workflowNotifications.ts) with WATI, the database and in-app notifications
// mocked out: checks that saved wording and the on/off switch are honoured. Nothing is sent.

const sendWhatsappTemplate = vi.fn();
const loadTemplate = vi.fn();

vi.mock('../../config/env.js', () => ({ env: { WATI_TEMPLATE_NAME: 'incident_notification', APP_URL: 'https://app.test' } }));
vi.mock('./whatsapp.js', () => ({ whatsappEnabled: () => true, sendWhatsappTemplate, sendWhatsapp: vi.fn() }));
vi.mock('./whatsappTemplate.service.js', () => ({ loadTemplate }));
vi.mock('./notification.service.js', () => ({ notifyUsers: vi.fn(), qualityUserIds: vi.fn(async () => []), rcaHeadUserIds: vi.fn(async () => []) }));
vi.mock('../users/user.model.js', () => ({
  User: { findById: () => ({ select: async () => ({ name: 'Dr. Ramesh', whatsappNumber: '+91 90000 00000', status: 'ACTIVE' }) }) },
}));
vi.mock('../departments/department.model.js', () => ({ Department: { findById: () => ({ select: async () => ({ name: 'Emergency' }) }) } }));

const { notifyWorkflowEvent } = await import('./workflowNotifications.js');

const incident: any = {
  _id: 'inc1',
  incidentNumber: 'INC-2026-000023',
  title: 'Patient fall',
  severity: 2,
  departmentId: 'd1',
  assignedHod: 'hod1',
  notifiedDepartmentIds: [],
  intimatedUserIds: [],
};
const actor: any = { userId: 'quality1' };

describe('WhatsApp delivery uses the editable wording', () => {
  beforeEach(() => {
    sendWhatsappTemplate.mockReset();
    loadTemplate.mockReset();
  });

  it('sends the saved wording, filled in, through the approved template', async () => {
    loadTemplate.mockResolvedValue({
      title: 'Action needed: {incidentNumber}',
      message: '{department}, please start today.',
      details: ['Remarks: {remarks}'],
      enabled: true,
    });
    await notifyWorkflowEvent('ASSIGN', incident, actor, 'Check CCTV');

    expect(loadTemplate).toHaveBeenCalledWith('HOD_ASSIGNED');
    expect(sendWhatsappTemplate).toHaveBeenCalledTimes(1);
    const [number, template, params] = sendWhatsappTemplate.mock.calls[0];
    expect(number).toBe('+91 90000 00000');
    expect(template).toBe('incident_notification');
    expect(params).toEqual([
      'Dr. Ramesh',
      '*Action needed: INC-2026-000023* | Emergency, please start today. | Remarks: Check CCTV',
      'https://app.test/incidents/inc1',
    ]);
  });

  it('sends nothing when the message is switched off', async () => {
    loadTemplate.mockResolvedValue({ title: 'T', message: 'M', details: [], enabled: false });
    await notifyWorkflowEvent('ASSIGN', incident, actor);
    expect(sendWhatsappTemplate).not.toHaveBeenCalled();
  });
});
