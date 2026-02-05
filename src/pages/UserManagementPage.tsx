import React, { useEffect, useMemo, useState } from 'react';
import { FaSearch, FaUserShield, FaUserEdit, FaUserPlus, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { userApi, UserListItem, CreateUserRequest, UpdateUserRequest } from '../services/userApi';
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
  return 'user'; // operator/participant/default
};

const UserManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { addNotification } = useNotifications();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserRequest>({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    department: '',
    position: '',
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
        const data = await userApi.listUsers();
        setUsers(data);
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
        department: selectedUser.department,
        position: selectedUser.position,
        role: mapBackendRoleToOption((selectedUser as any).role),
        is_active: selectedUser.is_active,
      });
    } else {
      setEditForm({});
    }
  }, [selectedUser]);

  const handleCreateChange = (field: keyof CreateUserRequest, value: string | RoleOption) => {
    setCreateForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEditChange = (field: keyof UpdateUserRequest, value: string | RoleOption | boolean) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
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
        department: '',
        position: '',
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
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(term),
    );
  }, [users, search]);

  if (!canManageUsers) {
    return (
      <div className="user-mgmt-page">
        <div className="user-mgmt-guard">
          <FaUserShield size={32} />
          <h2>Restricted Area</h2>
          <p>You need administrator rights to manage SentinelOps users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-mgmt-page">
      <header className="user-mgmt-header">
        <div>
          <h1>User Management</h1>
          <p>Curate access, roles, and operational identities across SentinelOps.</p>
        </div>
        <button
          className="btn-primary-glow"
          onClick={() => setShowCreatePanel(true)}
        >
          <FaUserPlus /> New User
        </button>
      </header>

      <section className="user-mgmt-body">
        <div className="user-mgmt-list">
          <div className="user-mgmt-toolbar">
            <div className="search-box">
              <FaSearch />
              <input
                type="text"
                placeholder="Search by name, username, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {loading && <span className="loading-pill">Loading users...</span>}
          </div>

          <div className="user-table">
            <div className="user-table-header">
              <span>User</span>
              <span>Role</span>
              <span>Status</span>
              <span>Department</span>
              <span>Position</span>
            </div>
            <div className="user-table-body">
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  className={`user-row ${selectedUserId === u.id ? 'selected' : ''}`}
                  onClick={() => setSelectedUserId(u.id)}
                >
                  <span>
                    <strong>{u.first_name} {u.last_name}</strong>
                    <span className="user-subline">{u.username} · {u.email}</span>
                  </span>
                  <span className="role-pill">{mapBackendRoleToOption((u as any).role)}</span>
                  <span className={u.is_active ? 'status-pill active' : 'status-pill inactive'}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span>{u.department || '—'}</span>
                  <span>{u.position || '—'}</span>
                </button>
              ))}
              {!loading && filteredUsers.length === 0 && (
                <div className="user-empty-state">
                  <FaUserEdit size={32} />
                  <p>No users match this view.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="user-mgmt-detail">
          {selectedUser ? (
            <div className="detail-card">
              <div className="detail-header">
                <h2>Edit User</h2>
                <span className="detail-username">@{selectedUser.username}</span>
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
                  <input
                    type="text"
                    value={editForm.department || ''}
                    onChange={(e) => handleEditChange('department', e.target.value)}
                  />
                </label>
                <label>
                  Position
                  <input
                    type="text"
                    value={editForm.position || ''}
                    onChange={(e) => handleEditChange('position', e.target.value)}
                  />
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
                  className="btn-secondary"
                  onClick={() => setSelectedUserId(null)}
                >
                  Close
                </button>
                <button
                  className="btn-primary-glow"
                  onClick={handleSaveChanges}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <div className="detail-placeholder">
              <FaUserEdit size={32} />
              <h3>Select a user</h3>
              <p>Choose a user from the left to view and edit their profile, role, and status.</p>
            </div>
          )}
        </aside>
      </section>

      {showCreatePanel && (
        <div className="user-mgmt-modal">
          <div className="user-mgmt-modal-content">
            <h2>Create New User</h2>
            <form className="detail-grid" onSubmit={handleCreateUser}>
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
                <input
                  type="text"
                  value={createForm.department}
                  onChange={(e) => handleCreateChange('department', e.target.value)}
                />
              </label>
              <label>
                Position
                <input
                  type="text"
                  value={createForm.position}
                  onChange={(e) => handleCreateChange('position', e.target.value)}
                />
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
                  {saving ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;

