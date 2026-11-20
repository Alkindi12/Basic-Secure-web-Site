import { useState, useEffect } from 'react';
import api, { readError } from '../services/api';
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import './AdminDashboard.css';
import { formatDate, formatDateTime } from '../utils/dateUtils';

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [events, setEvents] = useState([]);
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [roleChangeModal, setRoleChangeModal] = useState({ 
    isOpen: false, 
    userId: null, 
    userName: '', 
    currentRole: '', 
    newRole: '' 
  });
  const [approveModal, setApproveModal] = useState({ isOpen: false, userId: null, userName: '' });
  const [rejectModal, setRejectModal] = useState({ isOpen: false, userId: null, userName: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, requestsRes, auditRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/manager-requests'),
        api.get('/admin/audit-log', { params: { limit: 100 } })
      ]);
      setUsers(usersRes.data.users);
      setRequests(requestsRes.data.requests);
      setEvents(auditRes.data.events);
    } catch (error) {
      toast.error(readError(error, 'Could not load admin data').message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (userId, userName) => {
    setApproveModal({ isOpen: true, userId, userName });
  };

  const confirmApprove = async () => {
    try {
      await api.post(`/admin/manager-requests/${approveModal.userId}/approve`);
      setApproveModal({ isOpen: false, userId: null, userName: '' });
      toast.success(`${approveModal.userName} is now a manager.`);
      fetchData();
    } catch (error) {
      toast.error(readError(error, 'Could not approve the request').message);
      setApproveModal({ isOpen: false, userId: null, userName: '' });
    }
  };

  const handleReject = (userId, userName) => {
    setRejectModal({ isOpen: true, userId, userName });
  };

  const confirmReject = async () => {
    try {
      await api.post(`/admin/manager-requests/${rejectModal.userId}/reject`);
      setRejectModal({ isOpen: false, userId: null, userName: '' });
      toast.info(`${rejectModal.userName}'s request was rejected.`);
      fetchData();
    } catch (error) {
      toast.error(readError(error, 'Could not reject the request').message);
      setRejectModal({ isOpen: false, userId: null, userName: '' });
    }
  };

  const handleRoleChange = (userId, userName, currentRole) => {
    const newRole = currentRole === 'manager' ? 'user' : 'manager';
    setRoleChangeModal({
      isOpen: true,
      userId,
      userName,
      currentRole,
      newRole
    });
  };

  const confirmRoleChange = async () => {
    try {
      await api.put(`/admin/users/${roleChangeModal.userId}/role`, {
        role: roleChangeModal.newRole
      });
      toast.success(`${roleChangeModal.userName} is now a ${roleChangeModal.newRole}.`);
      setRoleChangeModal({ isOpen: false, userId: null, userName: '', currentRole: '', newRole: '' });
      fetchData();
    } catch (error) {
      toast.error(readError(error, 'Error changing user role').message);
      setRoleChangeModal({ isOpen: false, userId: null, userName: '', currentRole: '', newRole: '' });
    }
  };

  const auditTone = (action) => (/failed|locked|blocked/.test(action) ? 'bad'
    : /role|approved|password|email/.test(action) ? 'warn' : 'ok');

  if (loading) {
    return <div className="admin-loading">Loading...</div>;
  }

  return (
    <div className="admin-dashboard">
      <div className="container">
        <h1>Admin Dashboard</h1>

        <div className="tabs">
          <button
            className={activeTab === 'users' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('users')}
          >
            All Users ({users.length})
          </button>
          <button
            className={activeTab === 'requests' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('requests')}
          >
            Manager Requests ({requests.length})
          </button>
          <button
            className={activeTab === 'audit' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('audit')}
          >
            Security Log
          </button>
        </div>

        {activeTab === 'users' && (
          <div className="users-section">
            <h2>All Users</h2>
            <div className="users-table">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Manager Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`role-badge role-${user.role}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>{user.manager_request_status || 'N/A'}</td>
                      <td>{formatDate(user.created_at)}</td>
                      <td>
                        {user.role === 'manager' && (
                          <button
                            onClick={() => handleRoleChange(user.id, user.name, user.role)}
                            className="btn-change-role"
                            title="Change role to user"
                          >
                            Change to User
                          </button>
                        )}
                        {user.role === 'user' && (
                          <button
                            onClick={() => handleRoleChange(user.id, user.name, user.role)}
                            className="btn-change-role"
                            title="Change role to manager"
                          >
                            Make Manager
                          </button>
                        )}
                        {user.role === 'admin' && (
                          <span className="no-action">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="requests-section">
            <h2>Pending Manager Requests</h2>
            {requests.length === 0 ? (
              <div className="no-requests">No pending manager requests</div>
            ) : (
              <div className="requests-list">
                {requests.map(request => (
                  <div key={request.id} className="request-card">
                    <div className="request-info">
                      <h3>{request.name}</h3>
                      <p><strong>Email:</strong> {request.email}</p>
                      <p><strong>Requested:</strong> {formatDate(request.created_at)}</p>
                    </div>
                    <div className="request-actions">
                      <button
                        onClick={() => handleApprove(request.id, request.name)}
                        className="btn-approve"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(request.id, request.name)}
                        className="btn-reject"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'audit' && (
          <div className="users-section">
            <h2>Security Log</h2>
            <p className="audit-intro">The latest security events: logins, failed logins, lockouts, role changes and changes to trips and bookings.</p>
            <div className="users-table">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Event</th>
                    <th>User</th>
                    <th>Target</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td>{formatDateTime(e.at)}</td>
                      <td><span className={`audit-action audit-${auditTone(e.action)}`}>{e.action.replace(/_/g, ' ')}</span></td>
                      <td>{e.user_email || '-'}</td>
                      <td>{e.target || '-'}</td>
                      <td className="audit-ip">{e.ip || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={roleChangeModal.isOpen}
        onClose={() => setRoleChangeModal({ isOpen: false, userId: null, userName: '', currentRole: '', newRole: '' })}
        onConfirm={confirmRoleChange}
        title="Change User Role"
        message={`Are you sure you want to change ${roleChangeModal.userName}'s role from ${roleChangeModal.currentRole} to ${roleChangeModal.newRole}?`}
        confirmText={`Change to ${roleChangeModal.newRole}`}
        cancelText="Cancel"
        type="primary"
      />

      <ConfirmModal
        isOpen={approveModal.isOpen}
        onClose={() => setApproveModal({ isOpen: false, userId: null, userName: '' })}
        onConfirm={confirmApprove}
        title="Approve Manager Request"
        message={`Are you sure you want to approve ${approveModal.userName}'s request to become a manager? They will gain access to create and manage trips.`}
        confirmText="Yes, Approve"
        cancelText="Cancel"
        type="success"
      />

      <ConfirmModal
        isOpen={rejectModal.isOpen}
        onClose={() => setRejectModal({ isOpen: false, userId: null, userName: '' })}
        onConfirm={confirmReject}
        title="Reject Manager Request"
        message={`Are you sure you want to reject ${rejectModal.userName}'s request to become a manager? They can request again later if needed.`}
        confirmText="Yes, Reject"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
};

export default AdminDashboard;


