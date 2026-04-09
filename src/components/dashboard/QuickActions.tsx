import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import type { ChecklistTemplate, DashboardChecklistThread } from '../../services/checklistApi';
import { checklistApi } from '../../services/checklistApi';
import { FaPlus, FaFileAlt, FaUsers, FaCog, FaBell, FaSyncAlt } from 'react-icons/fa';
import './QuickActions.css';
import TemplateListSkeleton from './TemplateListSkeleton';
import '../checklist/ChecklistPageSkeleton.css';

interface QuickActionsProps {
  onRefresh?: () => void | Promise<void>;
  existingThreads?: DashboardChecklistThread[];
}

const QuickActions: React.FC<QuickActionsProps> = ({ onRefresh, existingThreads = [] }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const roles: string[] = user
    ? Array.isArray((user as any).roles)
      ? (user as any).roles.map((role: string) => String(role).toLowerCase())
      : [String((user as any).role || '').toLowerCase()]
    : [];
  const isAdmin = roles.includes('admin');
  const canCreateChecklist = true;
  const userSection = (user as any)?.section_id ?? (user as any)?.sectionId ?? (user as any)?.section ?? null;

  useEffect(() => {
    if (!showModal) {
      return;
    }

    let mounted = true;

    const loadTemplates = async () => {
      try {
        setLoadingTemplates(true);
        const params = isAdmin ? undefined : { sectionId: userSection };
        const data = await checklistApi.getTemplates(params);
        if (!mounted) {
          return;
        }

        setTemplates(data || []);
        if (data && data.length > 0) {
          setSelectedTemplateId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to load templates', err);
        addNotification({ type: 'error', message: 'Failed to load templates', priority: 'medium' });
      } finally {
        if (mounted) {
          setLoadingTemplates(false);
        }
      }
    };

    void loadTemplates();

    return () => {
      mounted = false;
    };
  }, [addNotification, isAdmin, showModal, userSection]);

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplateId) {
      addNotification({ type: 'warning', message: 'Select a template first', priority: 'low' });
      return;
    }

    setIsLoading(true);

    try {
      const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
      if (!selectedTemplate) {
        addNotification({ type: 'error', message: 'Template not found', priority: 'high' });
        return;
      }

      const templateShift = selectedTemplate.shift || 'MORNING';
      const cachedExistingInstance = existingThreads.find(
        (thread) => thread.template_id === selectedTemplateId && thread.shift === templateShift
      );

      if (cachedExistingInstance) {
        addNotification({ type: 'info', message: 'Checklist already exists for this shift', priority: 'medium' });
        setShowModal(false);
        navigate(`/checklist/${cachedExistingInstance.id}`);
        return;
      }

      const todayInstances = await checklistApi.getTodayInstances();
      const existingInstance = todayInstances.find(
        (instance: any) => instance.template_id === selectedTemplateId && instance.shift === templateShift
      );

      if (existingInstance) {
        if (!existingInstance.id) {
          addNotification({ type: 'error', message: 'Existing checklist has invalid ID', priority: 'high' });
          return;
        }

        addNotification({ type: 'info', message: 'Checklist already exists for this shift', priority: 'medium' });
        setShowModal(false);
        navigate(`/checklist/${existingInstance.id}`);
        return;
      }

      const now = new Date();
      const payload: any = {
        checklist_date: now.toISOString().split('T')[0],
        shift: templateShift,
        template_id: selectedTemplateId,
      };

      const templateSection = (selectedTemplate as any)?.section_id ?? (selectedTemplate as any)?.sectionId ?? null;
      payload.section_id = templateSection || userSection;

      const instance = await checklistApi.createInstance(payload);
      if (!instance || !instance.id) {
        addNotification({ type: 'error', message: 'Failed to create checklist: Invalid response', priority: 'high' });
        return;
      }

      if (onRefresh) {
        await Promise.resolve(onRefresh());
      }

      addNotification({ type: 'success', message: 'Checklist started', priority: 'medium' });
      setShowModal(false);
      navigate(`/checklist/${instance.id}`);
    } catch (err) {
      console.error('Failed to create or retrieve instance from template', err);
      addNotification({ type: 'error', message: 'Failed to create checklist', priority: 'high' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplates = () => {
    navigate('/performance');
  };

  const handleWorkforce = () => navigate('/team');
  const handleSettings = () => addNotification({ type: 'info', message: 'Settings feature coming soon!', priority: 'low' });
  const handleRefresh = () => {
    if (onRefresh) {
      void Promise.resolve(onRefresh());
    }
  };

  return (
    <div className="quick-actions">
      <div className="quick-actions-header">
        <h3>Operator Actions</h3>
        <button className="refresh-btn" onClick={handleRefresh} title="Refresh dashboard">
          <FaSyncAlt />
        </button>
      </div>

      <div className="actions-grid">
        {canCreateChecklist && (
          <button className="qa-action-btn qa-primary" onClick={() => setShowModal(true)} disabled={isLoading}>
            <FaPlus />
            <span>{isLoading ? 'Starting...' : 'Start Checklist'}</span>
          </button>
        )}

        <button className="qa-action-btn qa-secondary" onClick={handleTemplates}>
          <FaFileAlt />
          <span>Analytics</span>
        </button>

        <button className="qa-action-btn qa-secondary" onClick={handleWorkforce}>
          <FaUsers />
          <span>Workforce</span>
        </button>

        <button className="qa-action-btn qa-secondary" onClick={handleSettings}>
          <FaCog />
          <span>Settings</span>
        </button>
      </div>

      <div className="quick-info">
        <div className="info-item">
          <FaBell className="info-icon" />
          <div className="info-content">
            <div className="info-title">Shift Reminder</div>
            <div className="info-desc">
              {(() => {
                const now = new Date();
                const hour = now.getHours();
                const minute = now.getMinutes();
                const currentTimeInMinutes = hour * 60 + minute;

                let timeString = '';
                if (hour >= 7 && hour < 15) {
                  const remaining = (15 * 60) - currentTimeInMinutes;
                  if (remaining < 60) {
                    timeString = `Morning shift - ${remaining}m left`;
                  } else {
                    const remainingHours = Math.floor(remaining / 60);
                    const remainingMinutes = remaining % 60;
                    timeString = `Morning shift - ${remainingHours}h ${remainingMinutes}m left`;
                  }
                } else if (hour >= 15 && hour < 23) {
                  const remaining = (23 * 60) - currentTimeInMinutes;
                  if (remaining < 60) {
                    timeString = `Afternoon shift - ${remaining}m left`;
                  } else {
                    const remainingHours = Math.floor(remaining / 60);
                    const remainingMinutes = remaining % 60;
                    timeString = `Afternoon shift - ${remainingHours}h ${remainingMinutes}m left`;
                  }
                } else {
                  const remaining =
                    hour >= 23
                      ? ((24 * 60) + (7 * 60)) - currentTimeInMinutes
                      : (7 * 60) - currentTimeInMinutes;

                  if (remaining < 60) {
                    timeString = `Night shift - ${remaining}m left`;
                  } else {
                    const remainingHours = Math.floor(remaining / 60);
                    const remainingMinutes = remaining % 60;
                    timeString = `Night shift - ${remainingHours}h ${remainingMinutes}m left`;
                  }
                }

                return timeString;
              })()}
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="qa-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="qa-modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="qa-modal-header">
              <h3>Start Checklist</h3>
              <button className="qa-modal-close" onClick={() => setShowModal(false)}>
                x
              </button>
            </div>

            <div className="qa-modal-body">
              <p className="qa-modal-description">Select a checklist template to start or resume a shift instance.</p>

              <div className="qa-templates-list">
                {loadingTemplates ? (
                  <TemplateListSkeleton />
                ) : templates.length === 0 ? (
                  <div className="qa-empty-state">No templates available</div>
                ) : (
                  templates.map((template) => (
                    <label
                      key={template.id}
                      className={`qa-template-option ${selectedTemplateId === template.id ? 'qa-selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="template"
                        value={template.id}
                        checked={selectedTemplateId === template.id}
                        onChange={() => setSelectedTemplateId(template.id)}
                      />
                      <div className="qa-template-content">
                        <div className="qa-template-name">{template.name}</div>
                        <div className="qa-template-meta">
                          v{template.version} | {template.shift} Shift | {template.is_active ? 'Active' : 'Inactive'}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="qa-modal-footer">
              <button className="qa-btn-cancel" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="qa-btn-confirm" onClick={handleCreateFromTemplate} disabled={isLoading}>
                {isLoading ? 'Starting...' : 'Start Checklist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickActions;
