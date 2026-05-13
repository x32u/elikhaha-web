import React from 'react';
import './styles/AdminUsers.css';
import AdminShell from './components/AdminShell';
import { createPlatformUser, fetchAllUsers, updatePlatformUser } from '../../services/adminApi';

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'admin', label: 'Admin' },
  { value: 'superadmin', label: 'Super Admin' },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const roleLabel = (value) => {
  const normalized = String(value || '').toLowerCase().trim();
  return ROLE_OPTIONS.find((option) => option.value === normalized)?.label || 'Unknown';
};

function AdminUsers({ onNavigate, role }) {
  const isSuperAdmin = role === 'SuperAdmin';
  const homePageKey = isSuperAdmin ? 'sa-dashboard' : 'homepage';

  const [query, setQuery] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('All');
  const [statusFilter, setStatusFilter] = React.useState('All');
  const [openMenu, setOpenMenu] = React.useState(null);

  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const [editing, setEditing] = React.useState(null);
  const [editDraft, setEditDraft] = React.useState(null);
  const [saveBusy, setSaveBusy] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [addBusy, setAddBusy] = React.useState(false);
  const [addError, setAddError] = React.useState('');
  const [addDraft, setAddDraft] = React.useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
  });

  const loadUsers = React.useCallback(async () => {
    setLoading(true);
    setError('');

    const result = await fetchAllUsers();
    if (!result.success) {
      setError(result.error || 'Failed to load users.');
      setUsers([]);
      setLoading(false);
      return;
    }

    setUsers(result.data || []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  React.useEffect(() => {
    const onDocClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest?.('.um-filterwrap')) return;
      setOpenMenu(null);
    };

    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const filteredUsers = users.filter((user) => {
    const q = query.trim().toLowerCase();
    const userRoleLabel = roleLabel(user.role);

    const matchesQuery =
      q.length === 0 ||
      String(user.name || '').toLowerCase().includes(q) ||
      String(user.email || '').toLowerCase().includes(q);

    const matchesRole = roleFilter === 'All' || userRoleLabel === roleFilter;
    const matchesStatus = statusFilter === 'All' || user.status_label === statusFilter;

    return matchesQuery && matchesRole && matchesStatus;
  });

  const openEdit = (user) => {
    setEditing(user);
    setEditDraft({
      id: user.id,
      name: user.name || '',
      email: user.email || '',
      role: String(user.role || '').toLowerCase(),
      status: user.status_label || 'Active',
    });
    setSaveError('');
  };

  const closeEdit = () => {
    setEditing(null);
    setEditDraft(null);
    setSaveError('');
  };

  const openAdd = () => {
    setShowAddModal(true);
    setAddError('');
    setAddDraft({
      name: '',
      email: '',
      password: '',
      role: 'student',
    });
  };

  const closeAdd = () => {
    setShowAddModal(false);
    setAddBusy(false);
    setAddError('');
  };

  const saveEdit = async () => {
    if (!editDraft) return;

    const name = editDraft.name.trim();
    const email = editDraft.email.trim();

    if (!name || !email) {
      setSaveError('Name and email are required.');
      return;
    }

    setSaveBusy(true);
    setSaveError('');

    const result = await updatePlatformUser(editDraft.id, {
      name,
      email,
      role: editDraft.role,
    });

    setSaveBusy(false);

    if (!result.success) {
      setSaveError(result.error || 'Failed to save user changes.');
      return;
    }

    setUsers((prev) => prev.map((user) => (user.id === result.data.id ? result.data : user)));
    closeEdit();
  };

  const saveAdd = async () => {
    const name = addDraft.name.trim();
    const email = addDraft.email.trim().toLowerCase();
    const password = addDraft.password;

    if (!name || !email || !password) {
      setAddError('Name, email, and password are required.');
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      setAddError('Email format is invalid. Use a valid email like name@example.com.');
      return;
    }

    setAddBusy(true);
    setAddError('');

    const result = await createPlatformUser({
      name,
      email,
      password,
      role: addDraft.role,
    });

    setAddBusy(false);

    if (!result.success) {
      setAddError(result.error || 'Failed to add user.');
      return;
    }

    setUsers((prev) => [result.data, ...prev]);
    closeAdd();
  };

  return (
    <AdminShell
      active="users"
      onNavigate={onNavigate}
      className="page-users"
      homePageKey={homePageKey}
      showAudit={isSuperAdmin}
      showPasswordResets={isSuperAdmin}
      auditPageKey="audit"
    >
      <header className="um-header">
        <div className="um-titlewrap">
          <h1 className="um-title">User Management</h1>
          <p className="um-subtitle">Manage platform accounts and role access.</p>
        </div>
        {isSuperAdmin && (
          <button className="um-add-btn" type="button" onClick={openAdd}>
            + Add User
          </button>
        )}
      </header>

      {error && <div className="um-empty" style={{ marginBottom: '12px' }}>{error}</div>}

      <section className="um-searchwrap" aria-label="Search users">
        <div className="um-search">
          <div className="um-search-ico" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M16.2 16.2 21 21"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <input
            className="um-search-input"
            type="text"
            placeholder="Search users"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </section>

      <section className="um-filters" aria-label="Filters">
        <div className="um-filterwrap">
          <button
            className="um-filter"
            type="button"
            aria-haspopup="menu"
            aria-expanded={openMenu === 'role'}
            onClick={() => setOpenMenu((menu) => (menu === 'role' ? null : 'role'))}
          >
            <span>Role</span>
            <span className="um-filter-value">{roleFilter}</span>
            <span className="um-filter-caret" aria-hidden="true">
              <svg
                viewBox="0 0 20 20"
                width="16"
                height="16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5 7.5 10 12.5 15 7.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>

          {openMenu === 'role' && (
            <div className="um-menu" role="menu" aria-label="Role filter">
              {['All', ...ROLE_OPTIONS.map((option) => option.label)].map((option) => (
                <button
                  key={option}
                  type="button"
                  role="menuitemradio"
                  aria-checked={roleFilter === option}
                  className={`um-menuitem ${roleFilter === option ? 'active' : ''}`}
                  onClick={() => {
                    setRoleFilter(option);
                    setOpenMenu(null);
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="um-filterwrap">
          <button
            className="um-filter"
            type="button"
            aria-haspopup="menu"
            aria-expanded={openMenu === 'status'}
            onClick={() => setOpenMenu((menu) => (menu === 'status' ? null : 'status'))}
          >
            <span>Status</span>
            <span className="um-filter-value">{statusFilter}</span>
            <span className="um-filter-caret" aria-hidden="true">
              <svg
                viewBox="0 0 20 20"
                width="16"
                height="16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5 7.5 10 12.5 15 7.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>

          {openMenu === 'status' && (
            <div className="um-menu" role="menu" aria-label="Status filter">
              {['All', 'Active'].map((option) => (
                <button
                  key={option}
                  type="button"
                  role="menuitemradio"
                  aria-checked={statusFilter === option}
                  className={`um-menuitem ${statusFilter === option ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter(option);
                    setOpenMenu(null);
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className="um-clear"
          type="button"
          onClick={() => {
            setQuery('');
            setRoleFilter('All');
            setStatusFilter('All');
          }}
        >
          Clear
        </button>
      </section>

      <section className="um-tablewrap" aria-label="User table">
        <table className="um-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Email</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="um-empty" colSpan={5}>
                  Loading users...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td className="um-empty" colSpan={5}>
                  No users found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.name || 'Unnamed User'}</td>
                  <td>{roleLabel(user.role)}</td>
                  <td className="um-muted">{user.email || '—'}</td>
                  <td>
                    <span className="um-status active">{user.status_label || 'Active'}</span>
                  </td>
                  <td>
                    <button className="um-action" type="button" onClick={() => openEdit(user)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {editing && editDraft && (
        <div className="um-modal-backdrop" role="presentation" onClick={closeEdit}>
          <div
            className="um-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Edit user"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="um-modal-head">
              <div className="um-modal-title">Edit User</div>
              <button className="um-modal-x" type="button" onClick={closeEdit} aria-label="Close">
                ×
              </button>
            </div>

            <div className="um-modal-body">
              {saveError && <div className="um-empty" style={{ marginBottom: '10px' }}>{saveError}</div>}

              <label className="um-field">
                <span>Name</span>
                <input
                  className="um-input"
                  value={editDraft.name}
                  onChange={(event) =>
                    setEditDraft((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="um-field">
                <span>Email</span>
                <input
                  className="um-input"
                  value={editDraft.email}
                  onChange={(event) =>
                    setEditDraft((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="um-fieldrow">
                <label className="um-field">
                  <span>Role</span>
                  <select
                    className="um-input"
                    value={editDraft.role}
                    onChange={(event) =>
                      setEditDraft((prev) => ({
                        ...prev,
                        role: event.target.value,
                      }))
                    }
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="um-field">
                  <span>Status</span>
                  <input className="um-input" value="Active" disabled />
                </label>
              </div>
            </div>

            <div className="um-modal-actions">
              <button className="um-btn ghost" type="button" onClick={closeEdit}>
                Cancel
              </button>
              <button className="um-btn primary" type="button" onClick={saveEdit} disabled={saveBusy}>
                {saveBusy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="um-modal-backdrop" role="presentation" onClick={closeAdd}>
          <div
            className="um-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Add user"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="um-modal-head">
              <div className="um-modal-title">Add User</div>
              <button className="um-modal-x" type="button" onClick={closeAdd} aria-label="Close">
                ×
              </button>
            </div>

            <div className="um-modal-body">
              {addError && <div className="um-empty" style={{ marginBottom: '10px' }}>{addError}</div>}

              <label className="um-field">
                <span>Name</span>
                <input
                  className="um-input"
                  value={addDraft.name}
                  onChange={(event) =>
                    setAddDraft((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="um-field">
                <span>Email</span>
                <input
                  className="um-input"
                  type="email"
                  value={addDraft.email}
                  onChange={(event) =>
                    setAddDraft((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="um-field">
                <span>Temporary Password</span>
                <input
                  className="um-input"
                  type="password"
                  value={addDraft.password}
                  onChange={(event) =>
                    setAddDraft((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="um-field">
                <span>Role</span>
                <select
                  className="um-input"
                  value={addDraft.role}
                  onChange={(event) =>
                    setAddDraft((prev) => ({
                      ...prev,
                      role: event.target.value,
                    }))
                  }
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="um-modal-actions">
              <button className="um-btn ghost" type="button" onClick={closeAdd}>
                Cancel
              </button>
              <button className="um-btn primary" type="button" onClick={saveAdd} disabled={addBusy}>
                {addBusy ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

export default AdminUsers;
