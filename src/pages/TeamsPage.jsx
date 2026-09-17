import React, { useState } from 'react';
import { INITIAL_TEAM } from '../data/mockData';

export default function TeamsPage() {
  const [team, setTeam] = useState(INITIAL_TEAM);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  // New Member Form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDept, setNewDept] = useState('');
  const [newRole, setNewRole] = useState('Editor');

  const filteredTeam = team.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRoleFilter === 'All' || m.role === selectedRoleFilter;
    const matchesStatus = selectedStatusFilter === 'All' || m.status === selectedStatusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleAddMemberSubmit = (e) => {
    e.preventDefault();
    if (!newName || !newEmail) return;
    const newMember = {
      id: `team-${Date.now()}`,
      name: newName,
      email: newEmail,
      department: newDept || 'Operations',
      role: newRole,
      status: 'Active',
      avatar: ''
    };
    setTeam([...team, newMember]);
    setNewName('');
    setNewEmail('');
    setNewDept('');
    setIsAddMemberOpen(false);
  };

  const handleRevokeAccess = (id) => {
    setTeam(team.filter((m) => m.id !== id));
    setOpenMenuId(null);
  };

  return (
    <div className="flex flex-col gap-y-space-lg w-full pt-space-xs">
      {/* Top Action Bar & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-space-xs">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              Team Members
            </h1>
            <span className="px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-surface-container-high text-on-surface-variant font-semibold">
              {team.length} Total
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Manage your team, seat assignments, and security roles across workspace environments.
          </p>
        </div>
        <div className="flex items-center gap-space-sm">
          <button
            type="button"
            onClick={() => alert("CSV Import template downloaded")}
            className="inline-flex items-center justify-center gap-2 px-space-md h-10 rounded-xl bg-surface-container-lowest text-on-surface font-title-sm text-title-sm shadow-sm hover:bg-surface-container-low transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg text-outline">file_upload</span>
            <span>Import CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddMemberOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-space-md h-10 rounded-xl bg-primary-container text-on-primary font-title-sm text-title-sm shadow-md hover:bg-primary transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">person_add</span>
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-caption text-caption uppercase tracking-wider text-outline font-semibold">
              Active Seats
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-display-lg text-on-surface font-bold">
                {team.filter(m => m.status === 'Active').length}
              </span>
              <span className="font-caption text-caption text-secondary font-medium">/ 10 Seats Used</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-secondary-container/30 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-2xl fill-icon">verified_user</span>
          </div>
        </div>

        <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-caption text-caption uppercase tracking-wider text-outline font-semibold">
              Inactive / Pending
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-display-lg text-on-surface font-bold">
                {team.filter(m => m.status !== 'Active').length}
              </span>
              <span className="font-caption text-caption text-outline font-medium">Awaiting setup</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-2xl">person_off</span>
          </div>
        </div>

        <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-caption text-caption uppercase tracking-wider text-outline font-semibold">
              Security Health
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-display-lg text-on-surface font-bold">100%</span>
              <span className="font-caption text-caption text-secondary font-medium">2FA Mandate</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-2xl">shield</span>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Table Filter & Search Controls */}
        <div className="p-space-md flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-space-sm bg-surface-container-lowest">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline">
              <span className="material-symbols-outlined text-lg">search</span>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members..."
              className="w-full h-10 pl-9 pr-4 rounded-xl bg-surface-container-low text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div className="flex items-center gap-space-xs overflow-x-auto">
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="px-space-sm h-9 rounded-xl bg-surface-container-low text-on-surface font-label-md text-label-md font-medium border-0 focus:outline-none cursor-pointer"
            >
              <option value="All">Role: All</option>
              <option value="Admin">Role: Admin</option>
              <option value="Editor">Role: Editor</option>
              <option value="Viewer">Role: Viewer</option>
            </select>

            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-space-sm h-9 rounded-xl bg-surface-container-low text-on-surface font-label-md text-label-md font-medium border-0 focus:outline-none cursor-pointer"
            >
              <option value="All">Status: All</option>
              <option value="Active">Status: Active</option>
              <option value="Pending">Status: Pending</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="h-10 bg-surface-container-low text-outline uppercase font-caption text-caption tracking-wider select-none">
                <th className="pl-space-lg pr-4 font-semibold" scope="col">Name</th>
                <th className="px-4 font-semibold" scope="col">Email</th>
                <th className="px-4 font-semibold" scope="col">Role</th>
                <th className="px-4 font-semibold" scope="col">Status</th>
                <th className="pr-space-lg pl-4 text-right font-semibold" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low/40 font-body-sm text-body-sm">
              {filteredTeam.map((m) => (
                <tr key={m.id} className="h-16 hover:bg-surface-container-low/60 transition-colors group">
                  <td className="pl-space-lg pr-4 py-space-xs">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden bg-primary-fixed flex items-center justify-center shrink-0">
                        {m.avatar ? (
                          <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-bold text-sm text-primary">{m.name.charAt(0)}</span>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-title-sm text-title-sm text-on-surface font-semibold truncate group-hover:text-primary transition-colors">
                          {m.name}
                        </span>
                        <span className="font-caption text-caption text-outline">
                          {m.department}
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
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold ${
                        m.role === 'Admin'
                          ? 'bg-primary-fixed text-on-primary-fixed-variant'
                          : m.role === 'Editor'
                          ? 'bg-surface-container-high text-on-surface'
                          : 'bg-surface-container text-on-surface-variant'
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
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold ${
                        m.status === 'Active'
                          ? 'bg-secondary-fixed/40 text-on-secondary-fixed-variant'
                          : 'bg-tertiary-fixed/60 text-on-tertiary-fixed'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'Active' ? 'bg-secondary' : 'bg-tertiary'}`}></span>
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
                        <div className="absolute right-0 mt-1 w-44 rounded-xl bg-surface-container-lowest shadow-xl z-20 py-1.5 text-left border border-surface-container-high">
                          <button
                            type="button"
                            onClick={() => { alert(`Reset password link sent to ${m.email}`); setOpenMenuId(null); }}
                            className="w-full px-space-sm py-1.5 text-left font-body-sm text-body-sm text-on-surface hover:bg-surface-container-low flex items-center gap-2"
                          >
                            <span className="material-symbols-outlined text-base text-outline">lock_reset</span>
                            <span>Reset Password</span>
                          </button>
                          <div className="my-1 h-px bg-surface-container-low" />
                          <button
                            type="button"
                            onClick={() => handleRevokeAccess(m.id)}
                            className="w-full px-space-sm py-1.5 text-left font-body-sm text-body-sm text-error hover:bg-error-container/40 flex items-center gap-2"
                          >
                            <span className="material-symbols-outlined text-base text-error">person_remove</span>
                            <span>Revoke Access</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Modal */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl p-6 w-full max-w-md border border-surface-container-high flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Add Team Member</h2>
              <button onClick={() => setIsAddMemberOpen(false)} className="text-outline hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

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
                  placeholder="alex@omniflow.io"
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface">Department</label>
                  <input
                    type="text"
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    placeholder="Customer Support"
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface">Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Editor">Editor</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-low">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-4 py-2 text-xs rounded-xl text-on-surface-variant hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs rounded-xl bg-primary text-on-primary font-semibold shadow-sm hover:bg-primary-container"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
