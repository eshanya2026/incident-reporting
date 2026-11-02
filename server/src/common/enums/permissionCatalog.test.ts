import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLE_CODES } from './permissions.js';
import { PERMISSION_CATALOG, isConfigurablePermission } from './permissionCatalog.js';
import { SYSTEM_ROLES, defaultPermissionsFor } from '../../seeders/systemRoles.js';

describe('permission catalogue', () => {
  it('describes every permission exactly once', () => {
    const keys = PERMISSION_CATALOG.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...Object.values(PERMISSIONS)].sort());
  });

  it('keeps workflow steps and Access Control out of reach of the matrix', () => {
    for (const p of [PERMISSIONS.INCIDENT_TRIAGE, PERMISSIONS.INCIDENT_REVIEW, PERMISSIONS.CAPA_WRITE, PERMISSIONS.ADMIN_ACCESS_CONTROL]) {
      expect(isConfigurablePermission(p)).toBe(false);
    }
    expect(isConfigurablePermission(PERMISSIONS.DASHBOARD_VIEW)).toBe(true);
  });
});

describe('system roles', () => {
  it('gives the Super Admin every permission, and Access Control to nobody else', () => {
    expect([...defaultPermissionsFor(ROLE_CODES.SUPER_ADMIN)!].sort()).toEqual([...Object.values(PERMISSIONS)].sort());
    const others = SYSTEM_ROLES.filter((r) => r.code !== ROLE_CODES.SUPER_ADMIN);
    expect(others.some((r) => r.permissions.includes(PERMISSIONS.ADMIN_ACCESS_CONTROL))).toBe(false);
  });

  it('keeps the screens that used to be role-based with the same roles as before', () => {
    const has = (code: string, p: string) => defaultPermissionsFor(code)!.includes(p);
    expect(has(ROLE_CODES.QUALITY, PERMISSIONS.REVIEW_QUEUE_VIEW) && has(ROLE_CODES.RCA_HEAD, PERMISSIONS.REVIEW_QUEUE_VIEW)).toBe(true);
    expect(has(ROLE_CODES.HOD, PERMISSIONS.REVIEW_QUEUE_VIEW)).toBe(false);
  });

  it('shows AI Insights to Admin only by default', () => {
    const has = (code: string, p: string) => defaultPermissionsFor(code)!.includes(p);
    expect(has(ROLE_CODES.ADMIN, PERMISSIONS.INSIGHTS_VIEW_ALL)).toBe(true);
    const insights = [PERMISSIONS.INSIGHTS_VIEW_ALL, PERMISSIONS.INSIGHTS_VIEW_DEPARTMENT];
    for (const code of [ROLE_CODES.QUALITY, ROLE_CODES.HOD, ROLE_CODES.RCA_HEAD, ROLE_CODES.STAFF, ROLE_CODES.INTIMATION_MEMBER]) {
      expect(insights.some((p) => has(code, p))).toBe(false);
    }
  });
});
