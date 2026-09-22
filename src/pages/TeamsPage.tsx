import React, { useState, useEffect, useCallback } from 'react';
import { teamService } from '../services/team.service';
import { TeamMemberItem, TeamStats } from '../types/team.types';
import { UserRole } from '../types/auth.types';
import { useAuth } from '../hooks/useAuth';
import { Button, Icon } from '../components/common';

export default function TeamsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const [team, setTeam] = useState<TeamMemberItem[]>([]);
  const [stats, setStats] = useState<TeamStats>({
    active: 0,
    pending: 0,
    inactive: 0,
    seatsUsed: 0,
    seatLimit: 10,
    twoFactorCoverage: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');

  // Modals & Menu State
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMemberItem | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Add Member Form State
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Editor');

  // Edit Member Form State
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('Editor');

  // Load team data & stats from API
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [membersData, statsData] = await Promise.all([
        teamService.getTeamMembers({
          search: searchQuery.trim() || undefined,
          role: selectedRoleFilter,
          status: selectedStatusFilter,
        }),
        teamService.getTeamStats(),
      ]);
      setTeam(membersData);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load team data from server.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedRoleFilter, selectedStatusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Toast / notification timeout
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Add Member Handler
  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    setModalError(null);
    setIsSubmitting(true);

    try {
      const created = await teamService.addTeamMember({
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        role: newRole,
      });

      setTeam((prev) => [created, ...prev]);
      setSuccessMessage(`Invitation issued for ${created.email}`);
      setIsAddMemberOpen(false);
      setNewName('');
      setNewEmail('');
      setNewRole('Editor');
      // Refresh stats
      teamService.getTeamStats().then(setStats).catch(() => {});
    } catch (err: any) {
      setModalError(err.message || 'Failed to add team member');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (m: TeamMemberItem) => {
    setEditingMember(m);
    setEditName(m.name);
    setEditRole(m.role);
    setOpenMenuId(null);
    setModalError(null);
  };

  // Update Member Handler
  const handleUpdateMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    setModalError(null);
    setIsSubmitting(true);

    try {
      const updated = await teamService.updateTeamMember(editingMember.id, {
        name: editName.trim(),
        role: editRole,
      });

      setTeam((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSuccessMessage(`Updated profile for ${updated.name}`);
      setEditingMember(null);
      // Refresh stats
      teamService.getTeamStats().then(setStats).catch(() => {});
    } catch (err: any) {
      setModalError(err.message || 'Failed to update member');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend Invite Handler
  const handleResendInvite = async (m: TeamMemberItem) => {
    setOpenMenuId(null);
    try {
      await teamService.resendInvite(m.id);
      setSuccessMessage(`Invitation re-issued for ${m.email}`);
    } catch (err: any) {
      setError(err.message || 'Could not resend invitation');
    }
  };

  // Revoke Access Handler
  const handleRevokeAccess = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to revoke access for ${name}?`)) {
      return;
    }
    setOpenMenuId(null);
    try {
      await teamService.revokeTeamMember(id, false);
      setTeam((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: 'Inactive' as const } : m))
      );
      setSuccessMessage(`Access revoked for ${name}`);
      teamService.getTeamStats().then(setStats).catch(() => {});
    } catch (err: any) {
      setError(err.message || 'Could not revoke access');
    }
  };

  return (
    <div className="flex flex-col gap-y-space-lg w-full pt-space-xs">
      {/* Toast Feedback */}
      {successMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 rounded-xl font-label-md flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700/60 hover:text-emerald-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-error-container text-on-error-container border border-error/20 rounded-xl font-label-md flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <Icon name="error" size="sm" color="error" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-on-error-container/60 hover:text-on-error-container font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Action Bar & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-space-xs">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              Team Members
            </h1>
            <span className="px-2.5 py-0.5 rounded-full font-label-sm text-label-sm bg-primary/10 text-primary font-bold">
              {team.length} Total
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Manage your team, seat assignments, and security roles across workspace environments.
          </p>
        </div>

        <div className="flex items-center gap-space-xs">
          <Button
            variant="primary"
            size="md"
            startIcon="person_add"
            disabled={!isAdmin}
            title={!isAdmin ? 'Admin access required to invite members' : undefined}
            onClick={() => {
              setModalError(null);
              setIsAddMemberOpen(true);
            }}
          >
            Add Member
          </Button>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex items-center justify-between border border-surface-container">
          <div className="flex flex-col">
            <span className="font-caption text-caption uppercase tracking-wider text-outline font-semibold">
              Active Seats
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-display-lg text-on-surface font-bold">
                {stats.active}
              </span>
              <span className="font-caption text-caption text-secondary font-medium">
                / {stats.seatLimit} Seats Used ({stats.seatsUsed} assigned)
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-secondary-container/30 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-2xl fill-icon">verified_user</span>
          </div>
        </div>

        <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex items-center justify-between border border-surface-container">
          <div className="flex flex-col">
            <span className="font-caption text-caption uppercase tracking-wider text-outline font-semibold">
              Pending Invitations
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-display-lg text-on-surface font-bold">
                {stats.pending}
              </span>
              <span className="font-caption text-caption text-outline font-medium">
                {stats.inactive > 0 ? `${stats.inactive} inactive` : 'Awaiting acceptance'}
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-2xl">mail</span>
          </div>
        </div>

        <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex items-center justify-between border border-surface-container">
          <div className="flex flex-col">
            <span className="font-caption text-caption uppercase tracking-wider text-outline font-semibold">
              Role Distribution
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-display-lg text-on-surface font-bold">
                {team.filter((m) => m.role === 'Admin').length}
              </span>
              <span className="font-caption text-caption text-primary font-medium">
                Admins · {team.filter((m) => m.role === 'Editor').length} Editors
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-2xl">shield_person</span>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col border border-surface-container">
        {/* Table Filter & Search Controls */}
        <div className="p-space-md flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-space-sm bg-surface-container-lowest border-b border-surface-container/60">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline">
              <span className="material-symbols-outlined text-lg">search</span>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members by name, email..."
              className="w-full h-10 pl-9 pr-4 rounded-xl bg-surface-container-low text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all border border-surface-container/60"
            />
          </div>

          <div className="flex items-center gap-space-xs overflow-x-auto">
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="px-space-sm h-10 rounded-xl bg-surface-container-low text-on-surface font-label-md text-label-md font-medium border border-surface-container/60 focus:outline-none cursor-pointer"
            >
              <option value="All">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="Editor">Editor</option>
              <option value="Viewer">Viewer</option>
            </select>

            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-space-sm h-10 rounded-xl bg-surface-container-low text-on-surface font-label-md text-label-md font-medium border border-surface-container/60 focus:outline-none cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="w-full overflow-x-auto">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
              <span className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin"></span>
              <span className="text-sm font-medium">Loading team members...</span>
            </div>
          ) : team.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl text-outline">group_off</span>
              <p className="font-title-sm text-base text-on-surface font-semibold">No team members found</p>
              <p className="text-xs text-outline">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="h-10 bg-surface-container-low text-outline uppercase font-caption text-[11px] tracking-wider select-none border-b border-surface-container/60">
                  <th className="pl-space-lg pr-4 font-semibold" scope="col">Name</th>
                  <th className="px-4 font-semibold" scope="col">Email</th>
                  <th className="px-4 font-semibold" scope="col">Role</th>
                  <th className="px-4 font-semibold" scope="col">Status</th>
                  <th className="pr-space-lg pl-4 text-right font-semibold" scope="col">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low/40 font-body-sm text-body-sm">
                {team.map((m, idx) => {
                  const initials = m.name
                    .split(' ')
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || 'TM';
                  const isBottomRows = idx >= Math.max(0, team.length - 2);

                  return (
                    <tr key={m.id} className="h-16 hover:bg-surface-container-low/60 transition-colors group">
                      <td className="pl-space-lg pr-4 py-space-xs">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0 border border-primary/20">
                            {m.avatar ? (
                              <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                            ) : (
                              <span>{initials}</span>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-title-sm text-title-sm text-on-surface font-semibold truncate group-hover:text-primary transition-colors">
                              {m.name}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-space-xs">
                        <span className="font-body-sm text-body-sm text-on-surface-variant select-all">
                          {m.email}
                        </span>
                      </td>
                      <td className="px-4 py-space-xs">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-label-sm text-xs font-semibold ${
                            m.role === 'Admin'
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : m.role === 'Editor'
                              ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <span className="material-symbols-outlined text-xs">
                            {m.role === 'Admin' ? 'admin_panel_settings' : m.role === 'Editor' ? 'edit_note' : 'visibility'}
                          </span>
                          <span>{m.role}</span>
                        </span>
                      </td>
                      <td className="px-4 py-space-xs">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-xs font-semibold ${
                            m.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : m.status === 'Pending'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              m.status === 'Active'
                                ? 'bg-emerald-500'
                                : m.status === 'Pending'
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                          ></span>
                          <span>{m.status}</span>
                        </span>
                      </td>
                      <td className="pr-space-lg pl-4 py-space-xs text-right relative">
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-lg">more_horiz</span>
                          </button>

                          {openMenuId === m.id && (
                            <>
                              <div
                                className="fixed inset-0 z-20 cursor-default"
                                onClick={() => setOpenMenuId(null)}
                              />
                              <div
                                className={`absolute right-0 ${
                                  isBottomRows
                                    ? 'bottom-full mb-1.5 origin-bottom-right'
                                    : 'top-full mt-1.5 origin-top-right'
                                } w-48 rounded-xl bg-white shadow-2xl z-30 py-1.5 text-left border border-slate-200 animate-in fade-in zoom-in-95`}
                              >
                                {isAdmin ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEdit(m)}
                                      className="w-full px-space-sm py-2 text-left font-body-sm text-xs text-on-surface hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-base text-outline">edit</span>
                                      <span>Edit Role &amp; Details</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleResendInvite(m)}
                                      className="w-full px-space-sm py-2 text-left font-body-sm text-xs text-on-surface hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-base text-outline">mark_email_read</span>
                                      <span>Resend Invite Token</span>
                                    </button>

                                    <div className="my-1 h-px bg-slate-100" />
                                    <button
                                      type="button"
                                      onClick={() => handleRevokeAccess(m.id, m.name)}
                                      className="w-full px-space-sm py-2 text-left font-body-sm text-xs text-error hover:bg-red-50 flex items-center gap-2 cursor-pointer font-semibold"
                                    >
                                      <span className="material-symbols-outlined text-base text-error">person_remove</span>
                                      <span>Revoke Access</span>
                                    </button>
                                  </>
                                ) : (
                                  <div className="px-3 py-2 text-[11px] text-outline">
                                    Admin role required to manage members
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Member Modal */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl p-6 w-full max-w-md border border-surface-container-high flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Add Team Member</h2>
              <Button
                variant="ghost"
                size="icon-sm"
                startIcon="close"
                onClick={() => setIsAddMemberOpen(false)}
                aria-label="Close modal"
              />
            </div>

            {modalError && (
              <div className="p-2.5 bg-error-container text-on-error-container rounded-xl text-xs flex items-center gap-2 border border-error/20">
                <Icon name="error" size="sm" color="error" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAddMemberSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Alex Henderson"
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">Email Address *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="alex@company.com"
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">Role *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-sm focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="Admin">Admin</option>
                  <option value="Editor">Editor</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-container-low mt-2">
                <Button
                  variant="ghost"
                  size="md"
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Inviting...' : 'Send Invitation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl p-6 w-full max-w-md border border-surface-container-high flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Edit Member Profile</h2>
              <Button
                variant="ghost"
                size="icon-sm"
                startIcon="close"
                onClick={() => setEditingMember(null)}
                aria-label="Close modal"
              />
            </div>

            {modalError && (
              <div className="p-2.5 bg-error-container text-on-error-container rounded-xl text-xs flex items-center gap-2 border border-error/20">
                <Icon name="error" size="sm" color="error" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateMemberSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={editingMember.email}
                  className="w-full h-10 px-3 rounded-xl bg-surface-container text-outline border border-surface-container-high text-sm cursor-not-allowed"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-sm focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="Admin">Admin</option>
                  <option value="Editor">Editor</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-container-low mt-2">
                <Button
                  variant="ghost"
                  size="md"
                  type="button"
                  onClick={() => setEditingMember(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
