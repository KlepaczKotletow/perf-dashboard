// Role hierarchy: admin > hr > manager > user
export type UserRole = "admin" | "hr" | "manager" | "user";

export const ROLE_LEVELS: Record<UserRole, number> = {
  admin: 4,
  hr: 3,
  manager: 2,
  user: 1,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  hr: "HR",
  manager: "Manager",
  user: "Employee",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: "Full access to all features, can manage users and settings",
  hr: "Can manage competencies, view all reviews, run calibrations",
  manager: "Can view all reviews and feedback, manage templates",
  user: "Can view own reviews and give feedback",
};

export function hasRole(userRole: string | undefined, requiredRole: UserRole): boolean {
  const userLevel = ROLE_LEVELS[userRole as UserRole] || 0;
  const requiredLevel = ROLE_LEVELS[requiredRole];
  return userLevel >= requiredLevel;
}

export function isAdmin(role: string | undefined): boolean {
  return role === "admin";
}

export function isManagerOrAbove(role: string | undefined): boolean {
  return hasRole(role, "manager");
}

export function canManageUsers(role: string | undefined): boolean {
  return isAdmin(role);
}

export function canManageTemplates(role: string | undefined): boolean {
  return isManagerOrAbove(role);
}

export function canViewAllReviews(role: string | undefined): boolean {
  return isManagerOrAbove(role);
}

export function canViewAllFeedback(role: string | undefined): boolean {
  return isManagerOrAbove(role);
}

export function canViewAnalytics(role: string | undefined): boolean {
  return isManagerOrAbove(role);
}

export function isHROrAbove(role: string | undefined): boolean {
  return hasRole(role, "hr");
}

export function canManageCompetencies(role: string | undefined): boolean {
  return isManagerOrAbove(role);
}

export function canRunCalibration(role: string | undefined): boolean {
  return isHROrAbove(role);
}

/**
 * Check if a user can calibrate reviews for a specific department.
 * HR/admin can calibrate all departments.
 * Department heads can calibrate only their own department.
 */
export function canCalibrateDepartment(
  role: string | undefined,
  isDeptHead: boolean,
  userDept: string | null,
  targetDept: string | null
): boolean {
  if (isHROrAbove(role)) return true;
  if (isDeptHead && userDept && userDept === targetDept) return true;
  return false;
}

/**
 * Check if a user can access calibration at all (HR+ or department head).
 */
export function canAccessCalibration(role: string | undefined, isDeptHead: boolean): boolean {
  return isHROrAbove(role) || isDeptHead;
}

/**
 * Check if a user can release grades (HR+ only).
 */
export function canReleaseGrades(role: string | undefined): boolean {
  return isHROrAbove(role);
}
