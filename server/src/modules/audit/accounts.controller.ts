import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { User } from '../users/user.model.js';
import { Role } from '../roles/role.model.js';
import { Department } from '../departments/department.model.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { logActivity } from './audit.service.js';
import { istText, sendCsv } from '../../common/helpers/csv.js';

// Super Admin > Audit Log > Accounts: who is set up and ready to use the system (first sign-in done,
// HOD coverage, WhatsApp coverage, role counts), and lists to chase up. Current state, not a period.

const DAY = 24 * 60 * 60 * 1000;
const ROLE_ORDER = ['STAFF', 'HOD', 'QUALITY', 'ADMIN', 'RCA_HEAD', 'INTIMATION_MEMBER', 'SUPER_ADMIN'];

// The tab pages through lists and switches filters quickly; ~2,000 users are loaded once and
// reused for a few seconds rather than re-read from the database on every click.
const CACHE_MS = 15_000;
let cache: { at: number; data: Promise<Awaited<ReturnType<typeof readAll>>> } | null = null;

const loadAll = () => {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    const data = readAll();
    cache = { at: Date.now(), data };
    data.catch(() => (cache = null)); // never keep a failed read
  }
  return cache.data;
};

const readAll = async () => {
  const [users, roles, departments] = await Promise.all([
    User.find()
      .select('employeeId name username designation departmentId roles status mustCompleteProfile lastLoginAt whatsappNumber email createdAt')
      .lean(),
    Role.find().select('code name').lean(),
    Department.find().select('name category active hodUserId').lean(),
  ]);
  const roleCode = new Map(roles.map((r: any) => [String(r._id), r.code as string]));
  const roleName = new Map(roles.map((r: any) => [r.code as string, r.name as string]));
  const deptById = new Map(departments.map((d: any) => [String(d._id), d]));
  const shaped = users.map((u: any) => {
    const codes = (u.roles || []).map((r: any) => roleCode.get(String(r))).filter(Boolean) as string[];
    const dept: any = u.departmentId ? deptById.get(String(u.departmentId)) : null;
    return {
      _id: String(u._id),
      employeeId: u.employeeId,
      name: u.name,
      username: u.username,
      designation: u.designation,
      roles: codes,
      departmentId: dept ? String(dept._id) : null,
      department: dept?.name ?? null,
      status: u.status as string,
      firstSignInDone: !u.mustCompleteProfile,
      lastLoginAt: u.lastLoginAt as Date | undefined,
      hasWhatsapp: Boolean(u.whatsappNumber),
      hasEmail: Boolean(u.email),
    };
  });
  return { users: shaped, roleName, departments };
};

/** GET /audit/accounts — overview numbers. */
export const getAccountsOverview = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { users, roleName, departments } = await loadAll();
    const now = Date.now();
    const active = users.filter((u) => u.status === 'ACTIVE');
    const signedInWithin = (days: number) => active.filter((u) => u.lastLoginAt && now - new Date(u.lastLoginAt).getTime() <= days * DAY).length;

    const byRole = ROLE_ORDER.concat([...roleName.keys()].filter((c) => !ROLE_ORDER.includes(c))).map((code) => {
      const inRole = active.filter((u) => u.roles.includes(code));
      return {
        code,
        name: roleName.get(code) ?? code,
        total: inRole.length,
        firstSignInDone: inRole.filter((u) => u.firstSignInDone).length,
        everSignedIn: inRole.filter((u) => u.lastLoginAt).length,
      };
    });

    const userById = new Map(users.map((u) => [u._id, u]));
    const activeDepts = departments.filter((d: any) => d.active !== false);
    // Covered only if the named HOD is still active and still holds the HOD role
    const isWorkingHod = (id: unknown) => {
      const h = id ? userById.get(String(id)) : undefined;
      return Boolean(h && h.status === 'ACTIVE' && h.roles.includes('HOD'));
    };
    const withHod = activeDepts.filter((d: any) => isWorkingHod(d.hodUserId));
    const withoutHod = activeDepts
      .filter((d: any) => !withHod.includes(d))
      .map((d: any) => ({ _id: String(d._id), name: d.name, category: d.category ?? null }))
      .sort((a: any, b: any) => (a.category ?? '').localeCompare(b.category ?? '') || a.name.localeCompare(b.name));
    const hods = withHod.map((d: any) => {
      const h = userById.get(String(d.hodUserId))!;
      return { departmentId: String(d._id), department: d.name, user: { _id: h._id, name: h.name, employeeId: h.employeeId }, firstSignInDone: h.firstSignInDone, lastLoginAt: h.lastLoginAt ?? null };
    });

    // Per department: its staff and how many are ready
    const deptRows = new Map<string, any>();
    for (const u of active) {
      const key = u.departmentId ?? 'none';
      const row =
        deptRows.get(key) ??
        deptRows.set(key, { departmentId: u.departmentId, department: u.department ?? 'No department', staff: 0, firstSignInDone: 0, withWhatsapp: 0, everSignedIn: 0 }).get(key);
      row.staff += 1;
      if (u.firstSignInDone) row.firstSignInDone += 1;
      if (u.hasWhatsapp) row.withWhatsapp += 1;
      if (u.lastLoginAt) row.everSignedIn += 1;
    }
    const hodByDept = new Map(hods.map((h) => [h.departmentId, h.user.name]));
    const byDepartment = [...deptRows.values()]
      .map((r) => ({ ...r, hod: r.departmentId ? hodByDept.get(r.departmentId) ?? null : null }))
      .sort((a, b) => b.staff - a.staff);

    sendSuccess(res, {
      totals: {
        users: users.length,
        active: active.length,
        inactive: users.filter((u) => u.status === 'INACTIVE').length,
        locked: users.filter((u) => u.status === 'LOCKED').length,
        firstSignInDone: active.filter((u) => u.firstSignInDone).length,
        firstSignInPending: active.filter((u) => !u.firstSignInDone).length,
        neverSignedIn: active.filter((u) => !u.lastLoginAt).length,
        signedIn7d: signedInWithin(7),
        signedIn30d: signedInWithin(30),
        withWhatsapp: active.filter((u) => u.hasWhatsapp).length,
        withoutWhatsapp: active.filter((u) => !u.hasWhatsapp).length,
        withEmail: active.filter((u) => u.hasEmail).length,
        noDepartment: active.filter((u) => !u.departmentId).length,
      },
      byRole,
      hodCoverage: {
        departments: activeDepts.length,
        withHod: withHod.length,
        withoutHod,
        hods: hods.sort((a, b) => a.department.localeCompare(b.department)),
        hodsNeverSignedIn: hods.filter((h) => !h.lastLoginAt).length,
      },
      byDepartment,
    });
  } catch (error) {
    next(error);
  }
};

const listSchema = z.object({
  /** pending = first sign-in not done; never = never signed in; noWhatsapp; signedIn = done first sign-in; all */
  filter: z.enum(['pending', 'never', 'noWhatsapp', 'signedIn', 'inactive', 'all']).optional().default('pending'),
  role: z.string().optional(),
  departmentId: z.string().optional(),
  search: z.string().trim().max(100).optional(),
});

const filterUsers = (users: Awaited<ReturnType<typeof readAll>>['users'], q: z.infer<typeof listSchema>) =>
  users
    .filter((u) => {
      if (q.filter === 'inactive') return u.status !== 'ACTIVE';
      if (u.status !== 'ACTIVE') return q.filter === 'all';
      if (q.filter === 'pending') return !u.firstSignInDone;
      if (q.filter === 'never') return !u.lastLoginAt;
      if (q.filter === 'noWhatsapp') return !u.hasWhatsapp;
      if (q.filter === 'signedIn') return u.firstSignInDone;
      return true;
    })
    .filter((u) => !q.role || u.roles.includes(q.role))
    .filter((u) => !q.departmentId || (q.departmentId === 'none' ? !u.departmentId : u.departmentId === q.departmentId))
    .filter((u) => {
      if (!q.search) return true;
      const s = q.search.toLowerCase();
      return [u.name, u.employeeId, u.username, u.designation, u.department].some((v) => v && String(v).toLowerCase().includes(s));
    })
    // By department (people with none last), then name
    .sort((a, b) => Number(!a.department) - Number(!b.department) || (a.department ?? '').localeCompare(b.department ?? '') || a.name.localeCompare(b.name));

/** GET /audit/accounts/users — people for a list (pending first sign-in, never signed in, ...). */
export const getAccountsUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = listSchema.parse(req.query);
    const { users } = await loadAll();
    const rows = filterUsers(users, q);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    sendSuccess(res, rows.slice((page - 1) * limit, page * limit), 'Users', 200, {
      total: rows.length,
      page,
      limit,
      totalPages: Math.ceil(rows.length / limit),
    });
  } catch (error) {
    next(error);
  }
};

/** GET /audit/accounts/users/export — the same list as CSV (to chase people up). */
export const exportAccountsUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = listSchema.parse(req.query);
    const { users } = await loadAll();
    const rows = filterUsers(users, q);
    const header = ['Employee ID', 'Name', 'Department', 'Designation', 'Roles', 'Status', 'First sign-in done', 'Last sign-in (IST)', 'Has WhatsApp'];
    const lines = rows.map((u) => [u.employeeId, u.name, u.department, u.designation, u.roles.join(' '), u.status, u.firstSignInDone ? 'Yes' : 'No', istText(u.lastLoginAt), u.hasWhatsapp ? 'Yes' : 'No']);
    await logActivity('EXPORT_ACCOUNTS_CSV', `Downloaded the accounts list "${q.filter}" (CSV, ${rows.length} rows)`, { req, meta: { rows: rows.length, ...q, format: 'CSV' } });
    sendCsv(res, `accounts_${q.filter}_${new Date().toISOString().slice(0, 10)}.csv`, header, lines);
  } catch (error) {
    next(error);
  }
};
