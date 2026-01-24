// src/components/dashboard/QuickActions.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useChecklist } from '../../contexts/checklistContext';
import { useNotifications } from '../../contexts/NotificationContext';
import type { ChecklistTemplate } from '../../services/checklistApi';
import { checklistApi } from '../../services/checklistApi';
import { FaPlus, FaFileAlt, FaUsers, FaCog, FaBell } from 'react-icons/fa';
import './QuickActions.css';

const QuickActions: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loadTodayInstances } = useChecklist();
  const { addNotification } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);

  // Modal / templates state
  const [showModal, setShowModal] = useState(false);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Check if user has permission to create checklists
  const canCreateChecklist = user?.role && ['OPERATOR', 'SUPERVISOR', 'manager', 'admin'].includes(user.role);

  useEffect(() => {
    if (!showModal) return;
    let mounted = true;
    const load = async () => {
      try {
        setLoadingTemplates(true);
        const data = await checklistApi.getTemplates();
        if (!mounted) return;
        setTemplates(data || []);
        if (data && data.length > 0) setSelectedTemplateId(data[0].id);
      } catch (err) {
        console.error('Failed to load templates', err);
        addNotification({ type: 'error', message: 'Failed to load templates', priority: 'medium' });
      } finally {
        setLoadingTemplates(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [showModal]);

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplateId) {
      addNotification({ type: 'warning', message: 'Select a template first', priority: 'low' });
      return;
    }
    setIsLoading(true);
    try {
      const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
      if (!selectedTemplate) {
        addNotification({ type: 'error', message: 'Template not found', priority: 'high' });
        return;
      }

      // Ensure shift is defined and valid
      const templateShift = selectedTemplate.shift || 'MORNING';
      console.log('Creating instance with shift:', templateShift);

      // Check for existing instance for this shift today
      const todayInstances = await checklistApi.getTodayInstances();
      const existingInstance = todayInstances.find(
        (inst: any) => inst.template.id === selectedTemplateId && inst.shift === templateShift
      );

      if (existingInstance) {
        // Redirect to existing instance
        addNotification({ type: 'info', message: 'Checklist already exists for this shift', priority: 'medium' });
        setShowModal(false);
        navigate(`/checklist/${existingInstance.id}`);
        return;
      }

      // Create new instance using template's shift
      const now = new Date();
      const payload: any = {
        checklist_date: now.toISOString().split('T')[0],
        shift: templateShift,
        template_id: selectedTemplateId
      };

      console.log('Creating instance with payload:', payload);
      const instance = await checklistApi.createInstance(payload);
      loadTodayInstances();
      addNotification({ type: 'success', message: 'Checklist started', priority: 'medium' });
      setShowModal(false);
      navigate(`/checklist/${instance.id}`);
    } catch (err) {
      console.error('Failed to create/retrieve instance from template', err);
      addNotification({ type: 'error', message: 'Failed to create checklist', priority: 'high' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplates = () => {
    // fallback navigation
    navigate('/performance');
  };

  const handleTeam = () => addNotification({ type: 'info', message: 'Team management feature coming soon!', priority: 'low' });
  const handleSettings = () => addNotification({ type: 'info', message: 'Settings feature coming soon!', priority: 'low' });

  return (
    <div className="quick-actions">
      <div className="quick-actions-header">
        <h3>Quick Actions</h3>
        <button 
          className="refresh-btn"
          onClick={loadTodayInstances}
          title="Refresh dashboard"
        >
          ↻
        </button>
      </div>

      <div className="actions-grid">
        {canCreateChecklist && (
          <button 
            className="action-btn primary"
            onClick={() => setShowModal(true)}
            disabled={isLoading}
          >
            <FaPlus />
            <span>{isLoading ? 'Starting...' : 'New Checklist'}</span>
          </button>
        )}

        <button className="action-btn secondary" onClick={handleTemplates}>
          <FaFileAlt />
          <span>Performance</span>
        </button>

        <button className="action-btn secondary" onClick={handleTeam}>
          <FaUsers />
          <span>Team</span>
        </button>

        <button className="action-btn secondary" onClick={handleSettings}>
          <FaCog />
          <span>Settings</span>
        </button>
      </div>

      {/* Notification/Info Panel */}
      <div className="quick-info">
        <div className="info-item">
          <FaBell className="info-icon" />
          <div className="info-content">
            <div className="info-title">Shift Reminder</div>
            <div className="info-desc">
              {(() => {
                const hour = new Date().getHours();
                if (hour >= 6 && hour < 14) return 'Morning shift in progress';
                else if (hour >= 14 && hour < 22) return 'Afternoon shift in progress';
                else return 'Night shift in progress';
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: template + shift selection */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Start Checklist</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              <p className="modal-description">Select a checklist template to start or resume a shift instance.</p>

              <div className="templates-list">
                {loadingTemplates ? (
                  <div className="loading-spinner small">.</div>
                ) : templates.length === 0 ? (
                  <div className="empty-state">No templates available</div>
                ) : (
                  templates.map((t) => (
                    <label key={t.id} className={`template-option ${selectedTemplateId === t.id ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="template"
                        value={t.id}
                        checked={selectedTemplateId === t.id}
                        onChange={() => setSelectedTemplateId(t.id)}
                      />
                      <div className="template-content">
                        <div className="template-name">{t.name}</div>
                        <div className="template-meta">v{t.version} • {t.shift} Shift • {t.is_active ? 'Active' : 'Inactive'}</div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-confirm" onClick={handleCreateFromTemplate} disabled={isLoading}> {isLoading ? 'Starting...' : 'Start Checklist'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickActions;