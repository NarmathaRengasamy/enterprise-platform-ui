import { UserRole } from './auth.types';

export interface TeamMemberItem {
  id: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
  status: 'Active' | 'Pending' | 'Inactive';
  avatar?: string;
}

export interface TeamStats {
  active: number;
  pending: number;
  inactive: number;
  seatsUsed: number;
  seatLimit: number;
  twoFactorCoverage: number;
}

export interface AddMemberPayload {
  name: string;
  email: string;
  department?: string;
  role?: UserRole;
  avatar?: string;
}

export interface UpdateMemberPayload {
  name?: string;
  role?: UserRole;
}
