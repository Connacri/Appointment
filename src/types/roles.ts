export type AppTabId =
  | 'planning'
  | 'analytics'
  | 'billing'
  | 'my_bookings'
  | 'lost_property'
  | 'housekeeping'
  | 'tasks'
  | 'stock'
  | 'pricing'
  | 'channels'
  | 'prousb'
  | 'spa'
  | 'reports'
  | 'events'
  | 'roles'
  | 'videos';

export type BuiltInRoleId =
  | 'admin'
  | 'manager'
  | 'responsable'
  | 'chef_du_personnel'
  | 'receptionist'
  | 'concierge'
  | 'night_auditor'
  | 'gouvernante'
  | 'room_attendant'
  | 'laundry_attendant'
  | 'plumber'
  | 'carpenter'
  | 'electrician'
  | 'hvac_tech'
  | 'maintenance_tech'
  | 'room_service'
  | 'spa_therapist'
  | 'security'
  | 'client';

export type UserRole = BuiltInRoleId | (string & {});

export type RoleCategory =
  | 'management'
  | 'front_office'
  | 'housekeeping'
  | 'maintenance'
  | 'guest_services'
  | 'client';

export type RoleIconName =
  | 'Crown'
  | 'Shield'
  | 'ShieldCheck'
  | 'Briefcase'
  | 'BellRing'
  | 'Moon'
  | 'Sparkles'
  | 'Bed'
  | 'Shirt'
  | 'Wrench'
  | 'Hammer'
  | 'PlugZap'
  | 'Wind'
  | 'Cog'
  | 'UtensilsCrossed'
  | 'Flower2'
  | 'ShieldAlert'
  | 'User'
  | 'UserCog'
  | 'Users';

export interface RolePermissions {
  canManageBookings: boolean;
  canManageHousekeeping: boolean;
  canManageTasks: boolean;
  canManageStock: boolean;
  canManageLostProperty: boolean;
  canIssueKeyCards: boolean;
  canManageRoles: boolean;
  isClientPortal: boolean;
}

export interface RoleDefinition {
  id: UserRole;
  label: { fr: string; en: string; ar: string };
  description: { fr: string; en: string; ar: string };
  category: RoleCategory;
  iconName: RoleIconName;
  isBuiltIn: boolean;
  allowedTabs: AppTabId[];
  permissions: RolePermissions;
}

export interface StoredRolesPayload {
  customRoles: RoleDefinition[];
  builtInOverrides: Record<string, {
    label?: { fr: string; en: string; ar: string };
    description?: { fr: string; en: string; ar: string };
    category?: RoleCategory;
    iconName?: RoleIconName;
    allowedTabs?: AppTabId[];
    permissions?: Partial<RolePermissions>;
  }>;
}

export type StaffShiftType = 'Matin' | 'Soir' | 'Nuit' | 'Polyvalent';
export type StaffEmploymentStatus = 'active' | 'on_leave' | 'inactive';
export type StaffCareerChangeType = 'hired' | 'assigned' | 'promoted' | 'transferred';

export interface StaffPromotionEntry {
  id: string;
  date: string;
  type: StaffCareerChangeType;
  fromRoleId?: UserRole;
  toRoleId: UserRole;
  fromAssignment?: string;
  toAssignment: string;
  note?: string;
  approvedBy: string;
}

export interface StaffMemberRecord {
  id: string;
  fullName: string;
  phone?: string;
  roleId: UserRole;
  assignment: string;
  shift: StaffShiftType;
  defaultTasks: string[];
  status: StaffEmploymentStatus;
  hiredAt: string;
  history: StaffPromotionEntry[];
}
