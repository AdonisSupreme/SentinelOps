import React, { useEffect, useMemo, useState } from 'react';
import {
  FaBuilding,
  FaIdBadge,
  FaSearch,
  FaShieldAlt,
  FaTimes,
  FaToggleOff,
  FaToggleOn,
  FaUserEdit,
  FaUserPlus,
  FaUserShield,
  FaUsers,
} from 'react-icons/fa';
import PageGuide from '../components/ui/PageGuide';
import { useAuth } from '../contexts/AuthContext';
import { pageGuides } from '../content/pageGuides';
import { userApi, UserListItem, CreateUserRequest, UpdateUserRequest } from '../services/userApi';
import { orgApi, Department, Section } from '../services/orgApi';
import { useNotifications } from '../contexts/NotificationContext';
import './UserManagementPage.css';

type RoleOption = 'admin' | 'manager' | 'user';

const roleOptions: { value: RoleOption; label: string; description: string }[] = [
  { value: 'admin', label: 'Admin', description: 'Full system access and configuration' },
  { value: 'manager', label: 'Manager', description: 'Leads operations and oversees teams' },
  { value: 'user', label: 'User', description: 'Executes daily operational checklists' },
];

const mapBackendRoleToOption = (backendRole?: string | null): RoleOption => {
  const value = (backendRole || '').toLowerCase();
  if (value === 'admin') return 'admin';
  if (value === 'supervisor' || value === 'manager') return 'manager';
  return 'user';
};

const getDisplayName = (user: UserListItem) => {
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return name || user.username || user.email || 'Unnamed user';
};

const getInitials = (user: UserListItem) => {
  const first = user.first_name?.[0] || user.username?.[0] || 'U';
  const second = user.last_name?.[0] || '';
  return `${first}${second}`.toUpperCase();
};

const isUserActive = (user: UserListItem) => user.is_active !== false;

const getDepartmentLabel = (user: UserListItem) =>
  (user as any).department_name || (user as any).department || 'Unassigned';

const getSectionLabel = (user: UserListItem) =>
  (user as any).section_name || 'Unassigned';

const UserManagementPreview: React.FC = () => (
  <div className="user-mgmt-page user-mgmt-preview-page">
    <section className="user-command-strip user-skel-panel">
      <div className="user-skel-command-copy">
        <div className="user-skel-line user-skel-kicker" />
        <div className="user-skel-line user-skel-title" />
        <div className="user-skel-line user-skel-meta" />
      </div>
      <div className="user-skel-signal-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={index} className="user-skel-signal-card">
            <div className="user-skel-block user-skel-icon" />
            <div className="user-skel-signal-copy">
              <div className="user-skel-line user-skel-label" />
              <div className="user-skel-line user-skel-value" />
              <div className="user-skel-line user-skel-meta" />
            </div>
          </article>
        ))}
      </div>
    </section>

    <section className="user-mgmt-body">
      <div className="user-directory-panel user-skel-panel">
        <div className="user-skel-board-head">
          <div>
            <div className="user-skel-line user-skel-kicker" />
            <div className="user-skel-line user-skel-panel-title" />
          </div>
          <div className="user-skel-block user-skel-action" />
        </div>
        <div className="user-skel-control" />
        <div className="user-skel-table">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="user-skel-row" />
          ))}
        </div>
      </div>

      <aside className="user-detail-panel user-skel-panel">
        <div className="user-skel-avatar" />
        <div className="user-skel-line user-skel-panel-title" />
        <div className="user-skel-line user-skel-meta" />
        <div className="user-skel-field-grid">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="user-skel-field" />
          ))}
        </div>
      </aside>
    </section>
  </div>
);

const UserManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { addNotification } = useNotifications();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [createForm, setCreateForm] = useState<CreateUserRequest>({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    department_id: undefined,
    section_id: undefined,
    password: '',
    role: 'user',
  });
  const [editForm, setEditForm] = useState<UpdateUserRequest>({});

  const canManageUsers = useMemo(() => {
    const role = currentUser?.role?.toLowerCase();
    return role === 'admin';
  }, [currentUser]);

  useEffect(() => {
    const load = async () => {
      if (!canManageUsers) return;
      setLoading(true);
      try {
        const [usersData, deptsData] = await Promise.all([
          userApi.listUsers(),
          orgApi.listDepartments(),
        ]);
        setUsers(usersData);
        setDepartments(deptsData);
        const sectionsData = await orgApi.listSections();
        setSections(sectionsData);
      } catch (err) {
        console.error('Failed to load users', err);
        addNotification({
          type: 'error',
          message: 'Failed to load users. Please try again.',
          priority: 'high',
        });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [canManageUsers, addNotification]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) || null,
    [users, selectedUserId],
  );

  useEffect(() => {
    if (selectedUser) {
      setEditForm({
        username: selectedUser.username,
        email: selectedUser.email,
        first_name: selectedUser.first_name,
        last_name: selectedUser.last_name,
        department_id: selectedUser.department_id,
        section_id: selectedUser.section_id,
        role: mapBackendRoleToOption((selectedUser as any).role),
        is_active: isUserActive(selectedUser),
      });
    } else {
      setEditForm({});
    }
  }, [selectedUser]);

  const handleCreateChange = (field: keyof CreateUserRequest, value: string | RoleOption | number | undefined) => {
    setCreateForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (field === 'department_id') {
      setCreateForm((prev) => ({ ...prev, section_id: undefined }));
    }
  };

  const handleEditChange = (field: keyof UpdateUserRequest, value: string | RoleOption | boolean | number | undefined) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (field === 'department_id') {
      setEditForm((prev) => ({ ...prev, section_id: undefined }));
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await userApi.createUser(createForm);
      setUsers((prev) => [{ ...(created as any), is_active: true, created_at: new Date().toISOString() }, ...prev]);
      setCreateForm({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        department_id: undefined,
        section_id: undefined,
        password: '',
        role: 'user',
      });
      setShowCreatePanel(false);
      addNotification({
        type: 'success',
        message: `User ${created.username} created successfully`,
        priority: 'medium',
      });
    } catch (err: any) {
      console.error('Failed to create user', err);
      addNotification({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to create user',
        priority: 'high',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const updated = await userApi.updateUser(selectedUser.id, editForm);
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? { ...(u as any), ...(updated as any) } : u)),
      );
      addNotification({
        type: 'success',
        message: `User ${updated.username} updated successfully`,
        priority: 'medium',
      });
    } catch (err: any) {
      console.error('Failed to update user', err);
      addNotification({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to update user',
        priority: 'high',
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return users;
    return users.filter((u) => {
      const role = mapBackendRoleToOption((u as any).role);
      return (
        u.username.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        getDisplayName(u).toLowerCase().includes(term) ||
        getDepartmentLabel(u).toLowerCase().includes(term) ||
        getSectionLabel(u).toLowerCase().includes(term) ||
        role.includes(term)
      );
    });
  }, [users, search]);

  const activeCount = useMemo(() => users.filter(isUserActive).length, [users]);
  const inactiveCount = users.length - activeCount;
  const adminCount = useMemo(() => users.filter((u) => mapBackendRoleToOption((u as any).role) === 'admin').length, [users]);
  const managerCount = useMemo(() => users.filter((u) => mapBackendRoleToOption((u as any).role) === 'manager').length, [users]);
  const unplacedCount = useMemo(() => users.filter((u) => !u.department_id || !u.section_id).length, [users]);
  const selectedRole = selectedUser ? mapBackendRoleToOption((selectedUser as any).role) : 'user';
  const selectedActive = selectedUser ? isUserActive(selectedUser) : false;

  const userSignals = useMemo(
    () => [
      {
        label: 'Directory',
        value: users.length,
        detail: `${activeCount} active / ${inactiveCount} inactive`,
        icon: <FaUsers />,
        tone: users.length ? 'ok' : 'watch',
      },
      {
        label: 'Access leads',
        value: adminCount + managerCount,
        detail: `${adminCount} admins / ${managerCount} managers`,
        icon: <FaShieldAlt />,
        tone: adminCount ? 'ok' : 'watch',
      },
      {
        label: 'Placement gaps',
        value: unplacedCount,
        detail: unplacedCount ? 'Department or section missing' : 'Every user is placed',
        icon: <FaBuilding />,
        tone: unplacedCount ? 'watch' : 'ok',
      },
      {
        label: 'Search view',
        value: filteredUsers.length,
        detail: search ? `Filtered by "${search}"` : 'Full directory visible',
        icon: <FaSearch />,
        tone: filteredUsers.length ? 'info' : 'danger',
      },
    ],
    [activeCount, adminCount, filteredUsers.length, inactiveCount, managerCount, search, unplacedCount, users.length]
  );

  if (!canManageUsers) {
    return (
      <div className="user-mgmt-page">
        <div className="user-mgmt-guard">
          <FaUserShield />
          <h2>Restricted area</h2>
          <p>You need administrator rights to manage SentinelOps users.</p>
        </div>
        <PageGuide guide={pageGuides.userManagement} />
      </div>
    );
  }

  if (loading && !users.length) {
    return (
      <>
        <UserManagementPreview />
        <PageGuide guide={pageGuides.userManagement} />
      </>
    );
  }

  return (
    <div className="user-mgmt-page">
      <section className="user-command-strip">
        <div className="user-command-title">
          <span><FaUserShield /> User management</span>
          <strong>{users.length} identities</strong>
          <small>{departments.length} departments / {sections.length} sections / admin lane</small>
        </div>

        <div className="user-signal-grid">
          {userSignals.map((signal) => (
            <article key={signal.label} className={`user-signal-card tone-${signal.tone}`}>
              <span className="user-signal-icon">{signal.icon}</span>
              <span className="user-signal-copy">
                <small>{signal.label}</small>
                <strong>{signal.value}</strong>
                <em>{signal.detail}</em>
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="user-mgmt-body">
        <div className="user-directory-panel">
          <div className="user-panel-head">
            <div>
              <span className="user-panel-kicker"><FaIdBadge /> Identity directory</span>
              <h2>Operators and access</h2>
            </div>
            <button
              type="button"
              className="btn-primary-glow"
              onClick={() => setShowCreatePanel(true)}
            >
              <FaUserPlus /> New user
            </button>
          </div>

          <div className="user-mgmt-toolbar">
            <label className="search-box">
              <FaSearch />
              <input
                type="text"
                placeholder="Search names, roles, email, department..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {loading ? <span className="loading-pill">Refreshing users</span> : null}
          </div>

          <div className="user-table">
            <div className="user-table-header">
              <span>User</span>
              <span>Role</span>
              <span>Status</span>
              <span>Department</span>
              <span>Section</span>
            </div>
            <div className="user-table-body">
              {filteredUsers.map((u) => {
                const role = mapBackendRoleToOption((u as any).role);
                const active = isUserActive(u);
                return (
                  <button
                    key={u.id}
                    type="button"
                    className={`user-row ${selectedUserId === u.id ? 'selected' : ''}`}
                    onClick={() => setSelectedUserId(u.id)}
                  >
                    <span className="user-identity-cell">
                      <span className="user-avatar">{getInitials(u)}</span>
                      <span>
                        <strong>{getDisplayName(u)}</strong>
                        <span className="user-subline">{u.username} / {u.email}</span>
                      </span>
                    </span>
                    <span className={`role-pill role-${role}`}>{role}</span>
                    <span className={active ? 'status-pill active' : 'status-pill inactive'}>
                      {active ? 'Active' : 'Inactive'}
                    </span>
                    <span>{getDepartmentLabel(u)}</span>
                    <span>{getSectionLabel(u)}</span>
                  </button>
                );
              })}
              {!loading && filteredUsers.length === 0 ? (
                <div className="user-empty-state">
                  <FaUserEdit />
                  <p>No users match this view.</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="user-detail-panel">
          {selectedUser ? (
            <div className="detail-card">
              <div className="detail-header">
                <div>
                  <span className="user-panel-kicker"><FaUserEdit /> Edit identity</span>
                  <h2>{getDisplayName(selectedUser)}</h2>
                </div>
                <span className="detail-username">@{selectedUser.username}</span>
              </div>

              <div className="detail-summary">
                <span className="detail-avatar">{getInitials(selectedUser)}</span>
                <div>
                  <strong>{selectedRole}</strong>
                  <span>{selectedActive ? 'Active account' : 'Inactive account'}</span>
                </div>
                <span className={`status-pill ${selectedActive ? 'active' : 'inactive'}`}>
                  {selectedActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="detail-grid">
                <label>
                  First name
                  <input
                    type="text"
                    value={editForm.first_name || ''}
                    onChange={(e) => handleEditChange('first_name', e.target.value)}
                  />
                </label>
                <label>
                  Last name
                  <input
                    type="text"
                    value={editForm.last_name || ''}
                    onChange={(e) => handleEditChange('last_name', e.target.value)}
                  />
                </label>
                <label>
                  Username
                  <input
                    type="text"
                    value={editForm.username || ''}
                    onChange={(e) => handleEditChange('username', e.target.value)}
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={editForm.email || ''}
                    onChange={(e) => handleEditChange('email', e.target.value)}
                  />
                </label>
                <label>
                  Department
                  <select
                    value={editForm.department_id ?? ''}
                    onChange={(e) => handleEditChange('department_id', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  >
                    <option value="">-- Select --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.department_name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Section
                  <select
                    value={editForm.section_id ?? ''}
                    onChange={(e) => handleEditChange('section_id', e.target.value || undefined)}
                  >
                    <option value="">-- Select --</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>{s.section_name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Role
                  <select
                    value={(editForm.role as RoleOption) || 'user'}
                    onChange={(e) => handleEditChange('role', e.target.value as RoleOption)}
                  >
                    {roleOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <small className="field-hint">
                    {roleOptions.find((opt) => opt.value === (editForm.role as RoleOption))?.description}
                  </small>
                </label>
                <label className="toggle-row">
                  <span>Account status</span>
                  <button
                    type="button"
                    className="toggle-btn"
                    onClick={() => handleEditChange('is_active', !editForm.is_active)}
                  >
                    {editForm.is_active ? <FaToggleOn /> : <FaToggleOff />}
                    <span>{editForm.is_active ? 'Active' : 'Inactive'}</span>
                  </button>
                </label>
                <label>
                  Reset password
                  <input
                    type="password"
                    placeholder="Leave blank to keep current"
                    value={editForm.password || ''}
                    onChange={(e) => handleEditChange('password', e.target.value)}
                  />
                </label>
              </div>

              <div className="detail-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSelectedUserId(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn-primary-glow"
                  onClick={handleSaveChanges}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          ) : (
            <div className="detail-placeholder">
              <FaUserEdit />
              <h3>Select a user</h3>
              <p>Choose an identity to inspect placement, role, status, and profile controls.</p>
            </div>
          )}
        </aside>
      </section>

      {showCreatePanel ? (
        <div className="user-mgmt-modal">
          <div className="user-mgmt-modal-content">
            <div className="modal-header">
              <div>
                <span className="user-panel-kicker"><FaUserPlus /> Create identity</span>
                <h2>New SentinelOps user</h2>
              </div>
              <button type="button" className="btn-close" onClick={() => setShowCreatePanel(false)} aria-label="Close create user panel">
                <FaTimes />
              </button>
            </div>
            <form className="detail-grid create-grid" onSubmit={handleCreateUser}>
              <label>
                First name
                <input
                  type="text"
                  value={createForm.first_name}
                  onChange={(e) => handleCreateChange('first_name', e.target.value)}
                  required
                />
              </label>
              <label>
                Last name
                <input
                  type="text"
                  value={createForm.last_name}
                  onChange={(e) => handleCreateChange('last_name', e.target.value)}
                  required
                />
              </label>
              <label>
                Username
                <input
                  type="text"
                  value={createForm.username}
                  onChange={(e) => handleCreateChange('username', e.target.value)}
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => handleCreateChange('email', e.target.value)}
                  required
                />
              </label>
              <label>
                Department
                <select
                  value={createForm.department_id ?? ''}
                  onChange={(e) => handleCreateChange('department_id', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                >
                  <option value="">-- Select --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.department_name}</option>
                  ))}
                </select>
              </label>
              <label>
                Section
                <select
                  value={createForm.section_id ?? ''}
                  onChange={(e) => handleCreateChange('section_id', e.target.value || undefined)}
                >
                  <option value="">-- Select --</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.section_name}</option>
                  ))}
                </select>
              </label>
              <label>
                Role
                <select
                  value={createForm.role}
                  onChange={(e) => handleCreateChange('role', e.target.value as RoleOption)}
                >
                  {roleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Temporary password
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => handleCreateChange('password', e.target.value)}
                  required
                />
              </label>
              <div className="detail-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreatePanel(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-glow"
                  disabled={saving}
                >
                  {saving ? 'Creating...' : 'Create user'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      <PageGuide guide={pageGuides.userManagement} />
    </div>
  );
};

export default UserManagementPage;
