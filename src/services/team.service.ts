import { client } from './client';
import {
  AddMemberPayload,
  TeamMemberItem,
  TeamStats,
  UpdateMemberPayload,
} from '../types/team.types';

export const teamService = {
  /**
   * Fetch team members with optional filtering & search
   */
  async getTeamMembers(filters?: {
    search?: string;
    role?: string;
    status?: string;
  }): Promise<TeamMemberItem[]> {
    const params: Record<string, string | undefined> = {};
    if (filters?.search) params.search = filters.search;
    if (filters?.role && filters.role !== 'All') params.role = filters.role;
    if (filters?.status && filters.status !== 'All') params.status = filters.status;

    const response = await client.get<TeamMemberItem[]>('/team/members', { params });
    return response.data || [];
  },

  /**
   * Fetch workspace team statistics and seat usage
   */
  async getTeamStats(): Promise<TeamStats> {
    const response = await client.get<TeamStats>('/team/stats');
    return (
      response.data || {
        active: 0,
        pending: 0,
        inactive: 0,
        seatsUsed: 0,
        seatLimit: 10,
        twoFactorCoverage: 0,
      }
    );
  },

  /**
   * Add / invite a new team member
   */
  async addTeamMember(payload: AddMemberPayload): Promise<TeamMemberItem> {
    const response = await client.post<TeamMemberItem>('/team/members', payload);
    if (!response.data) {
      throw new Error(response.message || 'Failed to add team member');
    }
    return response.data;
  },

  /**
   * Re-issue invitation token for pending member
   */
  async resendInvite(
    memberId: string
  ): Promise<{ id: string; email: string; invitationSent: boolean }> {
    const response = await client.post<{ id: string; email: string; invitationSent: boolean }>(
      `/team/members/${memberId}/invite`
    );
    if (!response.data) {
      throw new Error(response.message || 'Failed to resend invitation');
    }
    return response.data;
  },

  /**
   * Update an existing member's role, department, or status
   */
  async updateTeamMember(
    memberId: string,
    payload: UpdateMemberPayload
  ): Promise<TeamMemberItem> {
    const response = await client.put<TeamMemberItem>(`/team/members/${memberId}`, payload);
    if (!response.data) {
      throw new Error(response.message || 'Failed to update team member');
    }
    return response.data;
  },

  /**
   * Revoke team member access (soft deactivates or hard deletes)
   */
  async revokeTeamMember(memberId: string, hard = false): Promise<void> {
    await client.delete(`/team/members/${memberId}`, {
      params: hard ? { hard: 'true' } : undefined,
    });
  },
};
