import { describe, it, expect } from 'vitest'
import {
  hasRole,
  isAdmin,
  isAdminOrAbove,
  isManagerOrAbove,
  isHROrAbove,
  canManageUsers,
  canManageTemplates,
  canViewAllReviews,
  canViewAllFeedback,
  canViewAnalytics,
  canManageCompetencies,
  canRunCalibration,
  canCalibrateDepartment,
  canAccessCalibration,
  canReleaseGrades,
  ROLE_LEVELS,
} from '../roles'

describe('Role hierarchy', () => {
  it('defines correct hierarchy: admin > hr > manager > user', () => {
    expect(ROLE_LEVELS.admin).toBeGreaterThan(ROLE_LEVELS.hr)
    expect(ROLE_LEVELS.hr).toBeGreaterThan(ROLE_LEVELS.manager)
    expect(ROLE_LEVELS.manager).toBeGreaterThan(ROLE_LEVELS.user)
  })
})

describe('hasRole', () => {
  it('returns true when user has exact required role', () => {
    expect(hasRole('admin', 'admin')).toBe(true)
    expect(hasRole('manager', 'manager')).toBe(true)
    expect(hasRole('user', 'user')).toBe(true)
  })

  it('returns true when user has higher role than required', () => {
    expect(hasRole('admin', 'user')).toBe(true)
    expect(hasRole('admin', 'manager')).toBe(true)
    expect(hasRole('hr', 'manager')).toBe(true)
    expect(hasRole('manager', 'user')).toBe(true)
  })

  it('returns false when user has lower role than required', () => {
    expect(hasRole('user', 'manager')).toBe(false)
    expect(hasRole('user', 'hr')).toBe(false)
    expect(hasRole('user', 'admin')).toBe(false)
    expect(hasRole('manager', 'hr')).toBe(false)
    expect(hasRole('manager', 'admin')).toBe(false)
    expect(hasRole('hr', 'admin')).toBe(false)
  })

  it('handles undefined and invalid roles', () => {
    expect(hasRole(undefined, 'user')).toBe(false)
    expect(hasRole('', 'user')).toBe(false)
    expect(hasRole('invalid_role', 'user')).toBe(false)
  })
})

describe('isAdmin', () => {
  it('returns true only for admin role', () => {
    expect(isAdmin('admin')).toBe(true)
    expect(isAdmin('hr')).toBe(false)
    expect(isAdmin('manager')).toBe(false)
    expect(isAdmin('user')).toBe(false)
    expect(isAdmin(undefined)).toBe(false)
  })
})

describe('isAdminOrAbove', () => {
  it('returns true only for admin (highest role)', () => {
    expect(isAdminOrAbove('admin')).toBe(true)
    expect(isAdminOrAbove('hr')).toBe(false)
    expect(isAdminOrAbove('manager')).toBe(false)
    expect(isAdminOrAbove('user')).toBe(false)
  })
})

describe('isManagerOrAbove', () => {
  it('returns true for manager, hr, and admin', () => {
    expect(isManagerOrAbove('admin')).toBe(true)
    expect(isManagerOrAbove('hr')).toBe(true)
    expect(isManagerOrAbove('manager')).toBe(true)
    expect(isManagerOrAbove('user')).toBe(false)
    expect(isManagerOrAbove(undefined)).toBe(false)
  })
})

describe('isHROrAbove', () => {
  it('returns true for hr and admin only', () => {
    expect(isHROrAbove('admin')).toBe(true)
    expect(isHROrAbove('hr')).toBe(true)
    expect(isHROrAbove('manager')).toBe(false)
    expect(isHROrAbove('user')).toBe(false)
  })
})

describe('Permission functions', () => {
  it('canManageUsers - admin only', () => {
    expect(canManageUsers('admin')).toBe(true)
    expect(canManageUsers('hr')).toBe(false)
    expect(canManageUsers('manager')).toBe(false)
    expect(canManageUsers('user')).toBe(false)
  })

  it('canManageTemplates - manager+', () => {
    expect(canManageTemplates('admin')).toBe(true)
    expect(canManageTemplates('hr')).toBe(true)
    expect(canManageTemplates('manager')).toBe(true)
    expect(canManageTemplates('user')).toBe(false)
  })

  it('canViewAllReviews - manager+', () => {
    expect(canViewAllReviews('admin')).toBe(true)
    expect(canViewAllReviews('manager')).toBe(true)
    expect(canViewAllReviews('user')).toBe(false)
  })

  it('canViewAllFeedback - manager+', () => {
    expect(canViewAllFeedback('admin')).toBe(true)
    expect(canViewAllFeedback('manager')).toBe(true)
    expect(canViewAllFeedback('user')).toBe(false)
  })

  it('canViewAnalytics - manager+', () => {
    expect(canViewAnalytics('admin')).toBe(true)
    expect(canViewAnalytics('manager')).toBe(true)
    expect(canViewAnalytics('user')).toBe(false)
  })

  it('canManageCompetencies - manager+', () => {
    expect(canManageCompetencies('admin')).toBe(true)
    expect(canManageCompetencies('manager')).toBe(true)
    expect(canManageCompetencies('user')).toBe(false)
  })

  it('canRunCalibration - HR+ only', () => {
    expect(canRunCalibration('admin')).toBe(true)
    expect(canRunCalibration('hr')).toBe(true)
    expect(canRunCalibration('manager')).toBe(false)
    expect(canRunCalibration('user')).toBe(false)
  })

  it('canReleaseGrades - HR+ only', () => {
    expect(canReleaseGrades('admin')).toBe(true)
    expect(canReleaseGrades('hr')).toBe(true)
    expect(canReleaseGrades('manager')).toBe(false)
    expect(canReleaseGrades('user')).toBe(false)
  })
})

describe('canCalibrateDepartment', () => {
  it('HR/admin can calibrate any department', () => {
    expect(canCalibrateDepartment('admin', false, null, 'Engineering')).toBe(true)
    expect(canCalibrateDepartment('hr', false, null, 'Marketing')).toBe(true)
    expect(canCalibrateDepartment('hr', false, 'Sales', 'Marketing')).toBe(true)
  })

  it('department head can calibrate own department', () => {
    expect(canCalibrateDepartment('manager', true, 'Engineering', 'Engineering')).toBe(true)
  })

  it('department head cannot calibrate other departments', () => {
    expect(canCalibrateDepartment('manager', true, 'Engineering', 'Marketing')).toBe(false)
  })

  it('non-dept-head manager cannot calibrate', () => {
    expect(canCalibrateDepartment('manager', false, 'Engineering', 'Engineering')).toBe(false)
  })

  it('regular user without dept head status cannot calibrate', () => {
    expect(canCalibrateDepartment('user', false, null, 'Engineering')).toBe(false)
    expect(canCalibrateDepartment('user', false, 'Engineering', 'Engineering')).toBe(false)
  })

  it('regular user WITH dept head status CAN calibrate own dept', () => {
    // isDeptHead is a separate flag — even users with "user" role can calibrate
    // if they've been marked as department head
    expect(canCalibrateDepartment('user', true, 'Engineering', 'Engineering')).toBe(true)
    expect(canCalibrateDepartment('user', true, 'Engineering', 'Marketing')).toBe(false)
  })

  it('handles null department values', () => {
    expect(canCalibrateDepartment('manager', true, null, 'Engineering')).toBe(false)
    expect(canCalibrateDepartment('manager', true, 'Engineering', null)).toBe(false)
    expect(canCalibrateDepartment('manager', true, null, null)).toBe(false)
  })
})

describe('canAccessCalibration', () => {
  it('HR/admin can always access', () => {
    expect(canAccessCalibration('admin', false)).toBe(true)
    expect(canAccessCalibration('hr', false)).toBe(true)
  })

  it('department heads can access', () => {
    expect(canAccessCalibration('manager', true)).toBe(true)
    expect(canAccessCalibration('user', true)).toBe(true)
  })

  it('non-dept-head non-HR cannot access', () => {
    expect(canAccessCalibration('manager', false)).toBe(false)
    expect(canAccessCalibration('user', false)).toBe(false)
  })
})
