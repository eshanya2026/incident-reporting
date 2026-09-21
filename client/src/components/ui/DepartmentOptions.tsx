import type { SearchableSelectOption } from './SearchableSelect';

// Category display order: clinical first, support/admin last, anything unrecognized at the end.
// Matches Recommended_Department_Categories.md; 'Demo & Core Operations' is the 8 seed departments.
const CATEGORY_ORDER = [
  'Clinical — Medical Specialties',
  'Clinical — Surgical Specialties',
  'Women and Child Health',
  'Dental Services',
  'Allied Health and Rehabilitation',
  'Emergency and Pre-Hospital Services',
  'Diagnostics — Laboratory and Blood Services',
  'Diagnostics — Imaging and Cardiac Diagnostics',
  'Nursing and Inpatient Services',
  'Operation Theatre and Procedure Services',
  'Pharmacy and Materials Management',
  'Patient Administration and Revenue Services',
  'Hospital Administration and Governance',
  'Facility, Engineering, and Safety Services',
  'Hospitality and Environmental Services',
  'Information Technology',
  'Outreach and Satellite Services',
  'Demo & Core Operations',
];

const OTHER = 'Other';

/** The 17 real-world categories (excludes 'Demo & Core Operations'), for pickers like "new department's category". */
export const DEPARTMENT_CATEGORIES = CATEGORY_ORDER.filter((c) => c !== 'Demo & Core Operations');

/** Groups departments by their `category`, in a fixed display order (ungrouped ones sort last). */
export function groupDepartments(departments: any[]): Array<{ category: string; items: any[] }> {
  const groups = new Map<string, any[]>();
  for (const d of departments) {
    const key = d.category || OTHER;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }
  const rank = (category: string) => {
    const i = CATEGORY_ORDER.indexOf(category);
    return i === -1 ? CATEGORY_ORDER.length + 1 : i;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([category, items]) => ({ category, items: [...items].sort((a, b) => a.name.localeCompare(b.name)) }));
}

/**
 * Flat, searchable options for a department picker, grouped by category so a list of 100+
 * departments stays usable. Pass `label` to customize each option's text (defaults to name).
 * A single group (e.g. only the 8 demo departments before the taxonomy is seeded) gets no group
 * header, matching how `DepartmentOptions` used to skip `<optgroup>` in that case.
 */
export function departmentOptions(departments: any[], label?: (department: any) => string): SearchableSelectOption[] {
  const groups = groupDepartments(departments);
  const noHeader = groups.length <= 1;
  return groups.flatMap(({ category, items }) =>
    items.map((d) => ({
      value: d._id,
      label: label ? label(d) : d.name,
      group: noHeader ? undefined : category,
    }))
  );
}
