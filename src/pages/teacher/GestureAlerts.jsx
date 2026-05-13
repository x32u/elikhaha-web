import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { getTeacherGestureAlerts } from '../../services/teacherApi';
import './GestureAlerts.css';

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
};

const formatGestureType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'middle_finger') return 'Middle Finger';
  if (!normalized) return 'Unknown';
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const GestureAlerts = () => {
  const navigate = useNavigate();
  const userInfo = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('userInfo') || '{}');
    } catch {
      return {};
    }
  }, []);

  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAlerts = async () => {
      setLoading(true);
      setError('');

      const result = await getTeacherGestureAlerts(userInfo.id);
      if (!result.success) {
        setError(result.error || 'Failed to load gesture alerts.');
        setAlerts([]);
        setLoading(false);
        return;
      }

      const transformed = (result.data || []).map((alertItem) => ({
        id: alertItem.id,
        studentId: alertItem.student_id,
        studentName: alertItem.student?.name || 'Student',
        studentEmail: alertItem.student?.email || 'No email',
        activityId: alertItem.activity_id,
        activityTitle: alertItem.activity?.title || 'Untitled activity',
        className: alertItem.activity?.class?.name || 'No class',
        gestureType: formatGestureType(alertItem.gesture_type),
        createdAt: alertItem.created_at,
        sourceTool: alertItem.metadata?.tool || null,
      }));

      setAlerts(transformed);
      setLoading(false);
    };

    loadAlerts();
  }, [userInfo.id]);

  return (
    <div className="gesture-alerts-page">
      <Navbar />
      <main className="gesture-alerts-content">
        <header className="gesture-alerts-header">
          <h1>Behavior Alerts</h1>
          <p>AR gesture reports from student sessions.</p>
        </header>

        {loading && <div className="gesture-alerts-empty">Loading alerts...</div>}

        {!loading && error && (
          <div className="gesture-alerts-error">
            <strong>Unable to load alerts:</strong> {error}
            <div className="gesture-alerts-error-help">
              If this is a new setup, apply <code>react-app/database/gesture_alerts.sql</code> in Supabase.
            </div>
          </div>
        )}

        {!loading && !error && alerts.length === 0 && (
          <div className="gesture-alerts-empty">No gesture alerts recorded yet.</div>
        )}

        {!loading && !error && alerts.length > 0 && (
          <section className="gesture-alerts-list" aria-label="Behavior alert list">
            {alerts.map((alertItem) => (
              <article key={alertItem.id} className="gesture-alert-card">
                <div className="gesture-alert-top">
                  <span className="gesture-pill">{alertItem.gestureType}</span>
                  <time>{formatDateTime(alertItem.createdAt)}</time>
                </div>

                <h3>{alertItem.studentName}</h3>
                <p className="gesture-alert-email">{alertItem.studentEmail}</p>

                <div className="gesture-alert-grid">
                  <div>
                    <span className="gesture-alert-label">Activity</span>
                    <span>{alertItem.activityTitle}</span>
                  </div>
                  <div>
                    <span className="gesture-alert-label">Class</span>
                    <span>{alertItem.className}</span>
                  </div>
                  <div>
                    <span className="gesture-alert-label">Tool</span>
                    <span>{alertItem.sourceTool || 'N/A'}</span>
                  </div>
                </div>

                <div className="gesture-alert-actions">
                  <button type="button" onClick={() => navigate(`/student/${alertItem.studentId}`)}>
                    View Student
                  </button>
                  <button type="button" onClick={() => navigate(`/activity/${alertItem.activityId}`)}>
                    View Activity
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
};

export default GestureAlerts;
