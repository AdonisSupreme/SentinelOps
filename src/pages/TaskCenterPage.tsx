// src/pages/TaskCenterPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { 
  FaTasks, 
  FaFilter, 
  FaSearch, 
  FaPlus, 
  FaClock, 
  FaExclamationTriangle,
  FaCheckCircle,
  FaPlay,
  FaPause,
  FaBan,
  FaCalendarAlt,
  FaUser,
  FaUsers,
  FaBuilding,
  FaCog,
  FaEye,
  FaThLarge,
  FaArrowLeft,
  FaArrowRight,
  FaTrash,
  FaEdit,
  FaUserCheck,
  FaTimes
} from 'react-icons/fa';
import { useTasks } from '../hooks/useTasks';
import * as TaskDetailModule from '../components/tasks/TaskDetail';
import { useAuth } from '../contexts/AuthContext';
import { TaskSummary, TaskStatus, Priority, TaskType } from '../services/taskApi';
import { orgApi, Department, Section } from '../services/orgApi';
import { userApi, UserListItem } from '../services/userApi';
import './TaskCenterPage.css';

const TaskDetail = TaskDetailModule.default;

interface TaskCenterPageProps {}

type ViewMode = 'list' | 'detail';

const TaskCenterPage: React.FC<TaskCenterPageProps> = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const {
    myTasks,
    assignedByMeTasks,
    assignedToMeTasks,
    teamTasks,
    departmentTasks,
    loading,
    error,
    fetchMyTasks,
    fetchTasksAssignedByMe,
    fetchAssignedToMe,
    fetchTeamTasks,
    fetchDepartmentTasks,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    changeTaskStatus,
    clearError,
    refreshTasks
  } = useTasks();

  // UI State
  const [activeFilter, setActiveFilter] = useState<string>('my-tasks');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskSummary | null>(null);

  // History modal state lifted to page so it can render above everything
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<any[]>([]);

  // Get user role for conditional rendering
  const userRole = user?.role?.toLowerCase() || '';
  const isManager = ['admin', 'manager'].includes(userRole);
  const isAdmin = userRole === 'admin';

  // Helpers to support both nested and flat API shapes
  const getAssignedId = (t: any) => t?.assigned_to?.id || t?.assigned_to_id || t?.assigned_to_id?.toString();
  const getAssignedName = (t: any) => {
    if (t?.assigned_to) return `${t.assigned_to.first_name || ''} ${t.assigned_to.last_name || ''}`.trim();
    if (t?.assigned_to_first_name || t?.assigned_to_last_name) return `${t.assigned_to_first_name || ''} ${t.assigned_to_last_name || ''}`.trim();
    if (t?.assigned_to_username) return t.assigned_to_username;
    return '';
  };

  // View management functions
  const handleShowList = () => {
    setViewMode('list');
    setSelectedTask(null);
  };

  const handleShowDetail = (task: TaskSummary) => {
    setSelectedTask(task);
    setViewMode('detail');
  };

  const handleCloseDetail = () => {
    setViewMode('list');
    setSelectedTask(null);
  };

  // Filter options based on user role
  const filterOptions = [
    { id: 'my-tasks', label: 'My Private Tasks', icon: <FaUser />, available: true },
    { id: 'assigned-to-me', label: 'Assigned To Me', icon: <FaUserCheck />, available: true },
    { id: 'assigned-by-me', label: 'Tasks I Assigned', icon: <FaUsers />, available: isManager },
    { id: 'team-tasks', label: 'Team Tasks', icon: <FaUsers />, available: isManager },
    { id: 'department-tasks', label: 'Department Tasks', icon: <FaBuilding />, available: isManager },
    { id: 'overdue', label: 'Overdue', icon: <FaExclamationTriangle />, available: true },
    { id: 'completed', label: 'Completed', icon: <FaCheckCircle />, available: true }
  ];

  // Get current tasks based on active filter
  const getCurrentTasks = useCallback(() => {
    switch (activeFilter) {
      case 'my-tasks':
        // My Private Tasks: personal tasks created by the user for themself
        return myTasks.filter((task: any) => {
          const assignedId = getAssignedId(task);
          const assignedById = task?.assigned_by?.id || task?.assigned_by_id || (task?.assigned_by_id ? task.assigned_by_id.toString() : undefined);
          const isPersonal = task.task_type === 'PERSONAL';
          return isPersonal && assignedId === user?.id && (assignedById ? String(assignedById) === user?.id : true);
        });
      case 'assigned-to-me':
        // Assigned To Me: tasks fetched specifically for assignments to current user
        return assignedToMeTasks;
      case 'assigned-by-me':
        return assignedByMeTasks;
      case 'team-tasks':
        return teamTasks;
      case 'department-tasks':
        return departmentTasks;
      case 'overdue':
        return [...myTasks, ...assignedByMeTasks].filter(task => 
          task.due_date && new Date(task.due_date) < new Date() && 
          task.status !== 'COMPLETED' && task.status !== 'CANCELLED'
        );
      case 'completed':
        return [...myTasks, ...assignedByMeTasks].filter(task => 
          task.status === 'COMPLETED'
        );
      default:
        return myTasks;
    }
  }, [activeFilter, myTasks, assignedByMeTasks, assignedToMeTasks, teamTasks, departmentTasks, user?.id]);

  // Apply filters to current tasks
  const getFilteredTasks = useCallback(() => {
    let tasks = getCurrentTasks();
    
    // Apply status filter
    if (statusFilter !== 'all') {
      tasks = tasks.filter(task => task.status === statusFilter);
    }
    
    // Apply priority filter
    if (priorityFilter !== 'all') {
      tasks = tasks.filter(task => task.priority === priorityFilter);
    }
    
    // Apply search filter
    if (searchTerm) {
      tasks = tasks.filter(task => 
        task.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return tasks;
  }, [getCurrentTasks, statusFilter, priorityFilter, searchTerm]);

  // Load tasks based on active filter
  useEffect(() => {
    const loadTasks = async () => {
      // Don't load tasks if user is not available or auth is still loading
      if (!user || authLoading) {
        console.log('👤 User not available or auth loading, skipping task load', { user: !!user, authLoading });
        return;
      }
      
      try {
        switch (activeFilter) {
          case 'my-tasks':
            await fetchMyTasks();
            break;
          case 'assigned-to-me':
            await fetchAssignedToMe();
            break;
          case 'assigned-by-me':
            if (isManager) {
              await fetchTasksAssignedByMe();
            }
            break;
          case 'team-tasks':
            if (isManager) {
              await fetchTeamTasks();
            }
            break;
          case 'department-tasks':
            if (isManager) {
              await fetchDepartmentTasks();
            }
            break;
          default:
            await fetchMyTasks();
        }
      } catch (err) {
        console.error('Failed to load tasks:', err);
      }
    };

    loadTasks();
  }, [activeFilter, fetchMyTasks, fetchAssignedToMe, fetchTasksAssignedByMe, fetchTeamTasks, fetchDepartmentTasks, isManager, user, authLoading]);

  // Get status badge color
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'ACTIVE': return '#6b7280';
      case 'IN_PROGRESS': return '#00d9ff';
      case 'COMPLETED': return '#2ed573';
      case 'CANCELLED': return '#dc3545';
      case 'ON_HOLD': return '#ffc107';
      case 'DRAFT': return '#6c757d';
      default: return '#6b7280';
    }
  };

  // Get priority indicator
  const getPriorityIndicator = (priority: Priority) => {
    switch (priority) {
      case 'CRITICAL': return { color: '#dc3545', label: 'Critical' };
      case 'HIGH': return { color: '#fd7e14', label: 'High' };
      case 'MEDIUM': return { color: '#ffc107', label: 'Medium' };
      case 'LOW': return { color: '#28a745', label: 'Low' };
      default: return { color: '#6c757d', label: 'Low' };
    }
  };

  // Get task type icon
  const getTaskTypeIcon = (taskType: TaskType) => {
    switch (taskType) {
      case 'PERSONAL': return <FaUser />;
      case 'TEAM': return <FaUsers />;
      case 'DEPARTMENT': return <FaBuilding />;
      case 'SYSTEM': return <FaCog />;
      default: return <FaTasks />;
    }
  };

  // Format due date
  const formatDueDate = (dueDate: string) => {
    const date = new Date(dueDate);
    const now = new Date();
    const isOverdue = date < now;
    
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOverdue
    };
  };

  // Handle status change
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await changeTaskStatus(taskId, newStatus);
      // Tasks will be refreshed automatically by the hook
    } catch (error) {
      console.error('Failed to change task status:', error);
    }
  };

  // Handle task creation
  const handleCreateTask = async (taskData: any) => {
    try {
      await createTask({
        ...taskData,
        assigned_by_id: user?.id || ''
      });
      setShowCreateModal(false);
      // Tasks will be refreshed automatically by the hook
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const currentTasks = getFilteredTasks();
  const filteredTasks = getFilteredTasks();
  
  // Render main content helper to avoid deeply nested JSX expressions
  const renderMainContent = () => {
    if (authLoading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner">
            <FaTasks className="spin" />
          </div>
        </div>
      );
    }

    return (
      <div className="task-content">
        <div className="task-header">
          <h1><FaTasks /> Task Center</h1>
          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
            {viewMode === 'detail' && selectedTask && (
              <button className="toggle-view-btn" onClick={handleCloseDetail} title="Back to list">
                <FaThLarge className='tc-actn-icon'/> Tasks
              </button>
            )}
            <div className="header-stats">
              <span className="stat-item">{filteredTasks.length} of {currentTasks.length} tasks</span>
              {(statusFilter !== 'all' || priorityFilter !== 'all' || searchTerm) && (
                <button
                  className="clear-filters-btn"
                  onClick={() => { setStatusFilter('all'); setPriorityFilter('all'); setSearchTerm(''); }}
                >
                  <FaBan /> Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="error-banner">
            <FaExclamationTriangle />
            <span>{error}</span>
            <button onClick={clearError} className="dismiss-error">×</button>
          </div>
        )}

        {viewMode === 'detail' && selectedTask ? (
          typeof TaskDetail === 'undefined' ? (
            <div className="task-detail-error">
              <h3>Unable to load task detail</h3>
              <p>TaskDetail component is undefined — check the console for details.</p>
            </div>
          ) : (
            <div className="task-detail-pane">
              <TaskDetail
                taskId={selectedTask.id}
                onClose={handleCloseDetail}
                onRefresh={refreshTasks}
                onRequestHistory={(entries: any[]) => {
                  setHistoryEntries(entries || []);
                  setHistoryModalOpen(true);
                }}
              />
            </div>
          )
        ) : filteredTasks.length === 0 ? (
          <div className="empty-state">
            <FaTasks size={48} />
            <h3>No tasks found</h3>
            <p>{searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'Try adjusting your filters or search terms'
              : 'No tasks match the current criteria'
            }</p>
            {!searchTerm && statusFilter === 'all' && priorityFilter === 'all' && (
              <button className="create-first-task-btn" onClick={() => setShowCreateModal(true)}>
                <FaPlus /> Create Your First Task
              </button>
            )}
          </div>
        ) : (
          <div className="task-grid">
            {filteredTasks.map(task => {
              const priority = getPriorityIndicator(task.priority);
              const dueDate = task.due_date ? formatDueDate(task.due_date) : null;
              const statusColor = getStatusColor(task.status);

              return (
                <div key={task.id} className="task-card" onClick={() => handleShowDetail(task)}>
                  <div className="card-header">
                    <div className="task-type-icon">{getTaskTypeIcon(task.task_type)}</div>
                    <div className="task-priority">
                      <div className="priority-indicator" style={{ backgroundColor: priority.color }} title={priority.label} />
                    </div>
                    <div className="status-badge" style={{ backgroundColor: statusColor }}>{task.status.replace('_', ' ')}</div>
                  </div>

                  <div className="card-body">
                    <h3 className="task-title">{task.title}</h3>
                    <div className="task-meta">
                      {getAssignedName(task) ? (
                        <div className="meta-item"><FaUser /><span>{getAssignedName(task)}</span></div>
                      ) : null}
                      {dueDate && (
                        <div className={`meta-item ${dueDate.isOverdue ? 'overdue' : ''}`}><FaCalendarAlt /><span>{dueDate.date} at {dueDate.time}</span></div>
                      )}
                      <div className="meta-item"><FaClock /><span>Created {new Date(task.created_at).toLocaleDateString()}</span></div>
                    </div>
                  </div>

                  <div className="card-footer">
                    <div className="task-actions">
                      {task.status === 'ACTIVE' && (getAssignedId(task) === user?.id) &&  (
                        <button className="tc-action-btn tc-start" onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'IN_PROGRESS'); }} title="Start Task"><FaPlay className='tc-actn-icon'/></button>
                      )}
                      {task.status === 'IN_PROGRESS' && (getAssignedId(task) === user?.id) && (
                        <>
                          <button className="tc-action-btn tc-complete" onClick={() => handleStatusChange(task.id, 'COMPLETED')} title="Complete Task"><FaCheckCircle className='tc-actn-icon'/></button>
                          <button className="tc-action-btn tc-hold" onClick={() => handleStatusChange(task.id, 'ON_HOLD')} title="Put on Hold"><FaPause className='tc-actn-icon'/></button>
                        </>
                      )}
                      {(getAssignedId(task) === user?.id) && (
                        <>
                          <button className="tc-action-btn tc-edit" onClick={(e) => { e.stopPropagation(); navigate(`/tasks/${task.id}/edit`); }} title="Edit Task"><FaEdit className='tc-actn-icon'/></button>
                        </>
                      )}
                      {task.status === 'ON_HOLD' && (getAssignedId(task) === user?.id) && (
                        <button className="tc-action-btn tc-resume" onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'IN_PROGRESS'); }} title="Resume Task"><FaPlay className='tc-actn-icon'/></button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (loading && currentTasks.length === 0) {
    return (
      <div className="task-center">
        <div className="task-center-layout">
          <TaskCenterSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="task-center">
      <div className="task-center-layout">
        
        {/* Left Sidebar - Filters - always visible */}
        <aside className="task-sidebar">
          <div className="sidebar-section">
            <h3><FaFilter /> Task Filters</h3>
            
            <div className="filter-options">
              {filterOptions.map(option => (
                <button
                  key={option.id}
                  className={`filter-option ${activeFilter === option.id ? 'active' : ''} ${!option.available ? 'disabled' : ''}`}
                  onClick={() => option.available && setActiveFilter(option.id)}
                  disabled={!option.available}
                  title={!option.available ? 'Not available for your role' : ''}
                >
                  <span className="filter-icon">{option.icon}</span>
                  <span className="filter-label">{option.label}</span>
                  {activeFilter === option.id && (
                    <span className="filter-count">
                      {getCurrentTasks().length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <h3><FaSearch /> Search & Filter</h3>
            
            <div className="tc-search-box">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="filter-controls">
              <div className="filter-group">
                <label>Status:</label>
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
                  className="filter-select"
                >
                  <option value="all">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="ON_HOLD">On Hold</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Priority:</label>
                <select 
                  value={priorityFilter} 
                  onChange={(e) => setPriorityFilter(e.target.value as Priority | 'all')}
                  className="filter-select"
                >
                  <option value="all">All Priority</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="sidebar-section">
            <h3><FaPlus /> Quick Actions</h3>
            <button 
              className="quick-action-btn primary"
              onClick={() => setShowCreateModal(true)}
            >
              <FaPlus /> Create Task
            </button>
            <button 
              className="quick-action-btn secondary"
              onClick={refreshTasks}
            >
              <FaArrowRight /> Refresh
            </button>
          </div>
        </aside>

        {/* Main Content - Task Cards or Detail (main content hosts detail) */}
        <main className="task-main">
          {renderMainContent()}
        </main>
      </div>

      {/* Create Task Modal */}
      {historyModalOpen && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div
          className="history-modal-backdrop"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483647, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setHistoryModalOpen(false)}
        >
          <div className="history-modal" style={{ width: '720px', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="td-header">
              <div className="td-title"><h2>Task History</h2><div className="td-sub">History</div></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="td-close" onClick={() => setHistoryModalOpen(false)}>×</button>
              </div>
            </div>
            <div className="history-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {historyEntries.length === 0 ? (
                  <div className="td-small">No history events</div>
                ) : (
                  historyEntries.map((ev: any) => (
                    <div key={ev.id} className="td-event">
                      <div className="td-event-time">{new Date(ev.timestamp).toLocaleString()}</div>
                      <div className="td-event-content">
                        <strong>{ev.action || 'Updated'}</strong>
                        <div className="td-small">{ev.summary}</div>
                        <div className="td-small">by {ev.user?.username || `${ev.user?.first_name || ''} ${ev.user?.last_name || ''}`}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTask}
          user={user}
        />
      )}
    </div>
  );
};

// Enhanced Skeleton Component
const TaskCenterSkeleton: React.FC = () => (
  <div className="task-center">
    <div className="task-center-layout">
      {/* Left Sidebar Skeleton */}
      <aside className="task-sidebar">
        {/* Task Filters Section */}
        <div className="skeleton-section">
          <div className="skeleton-header skeleton-shimmer" />
          <div className="skeleton-filters">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="skeleton-filter-item skeleton-shimmer" />
            ))}
          </div>
        </div>

        {/* Search & Filter Section */}
        <div className="skeleton-section">
          <div className="skeleton-header skeleton-shimmer" />
          <div className="skeleton-search-box skeleton-shimmer" />
          <div className="skeleton-filter-controls">
            <div className="skeleton-filter-group">
              <div className="skeleton-label skeleton-shimmer" />
              <div className="skeleton-select skeleton-shimmer" />
            </div>
            <div className="skeleton-filter-group">
              <div className="skeleton-label skeleton-shimmer" />
              <div className="skeleton-select skeleton-shimmer" />
            </div>
          </div>
        </div>

        {/* Quick Actions Section */}
        <div className="skeleton-section">
          <div className="skeleton-header skeleton-shimmer" />
          <div className="skeleton-quick-actions">
            <div className="skeleton-button skeleton-shimmer primary" />
            <div className="skeleton-button skeleton-shimmer secondary" />
          </div>
        </div>
      </aside>

      {/* Main Content Skeleton */}
      <main className="task-main">
        {/* Header Skeleton */}
        <div className="skeleton-page-header">
          <div className="skeleton-title skeleton-shimmer" />
          <div className="skeleton-header-stats">
            <div className="skeleton-stat skeleton-shimmer" />
            <div className="skeleton-stat skeleton-shimmer" />
          </div>
        </div>

        {/* Task Grid Skeleton */}
        <div className="skeleton-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton-card">
              {/* Card Header */}
              <div className="skeleton-card-header">
                <div className="skeleton-card-icons">
                  <div className="skeleton-icon skeleton-shimmer" />
                  <div className="skeleton-icon skeleton-shimmer" />
                  <div className="skeleton-badge skeleton-shimmer" />
                </div>
              </div>
              
              {/* Card Body */}
              <div className="skeleton-card-body">
                <div className="skeleton-title-line skeleton-shimmer" />
                <div className="skeleton-meta-items">
                  <div className="skeleton-meta-item skeleton-shimmer" />
                  <div className="skeleton-meta-item skeleton-shimmer" />
                  <div className="skeleton-meta-item skeleton-shimmer" />
                </div>
              </div>
              
              {/* Card Footer */}
              <div className="skeleton-card-footer">
                <div className="skeleton-actions">
                  <div className="skeleton-action-btn skeleton-shimmer" />
                  <div className="skeleton-action-btn skeleton-shimmer" />
                  <div className="skeleton-action-btn skeleton-shimmer" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  </div>
);

// Create Task Modal Component
interface CreateTaskModalProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
  user: any;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ onClose, onSubmit, user }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    task_type: 'PERSONAL' as TaskType,
    priority: 'MEDIUM' as Priority,
    due_date: '',
    assigned_to_id: undefined as string | undefined,
    department_id: undefined as number | undefined,
    section_id: undefined as string | undefined,
    estimated_hours: '',
    tags: [] as string[],
    parent_task_id: '',
    is_recurring: false,
    recurrence_pattern: ''
  });

  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [assignees, setAssignees] = useState<UserListItem[]>([]);

  const [tagInput, setTagInput] = useState('');

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()]
      });
      setTagInput('');
    }
  };

  // Load departments and preselect user's department/section if available
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // initialize org data load
        const depts = await orgApi.listDepartments();
        if (!mounted) return;
        const userRole = (user?.role || '').toLowerCase();

        // If regular user, show only their department to avoid confusion
        if (!['admin', 'manager'].includes(userRole) && (user as any)?.department_id) {
          const filtered = depts.filter(d => d.id === (user as any).department_id);
          setDepartments(filtered || []);
        } else {
          setDepartments(depts || []);
        }

        // If API lacks department/section on `user`, try to fetch the full user profile
        let effectiveUser = user as any;
        if (user && !effectiveUser?.department_id && !effectiveUser?.section_id) {
          try {
            const full = await userApi.getUser(user.id);
            effectiveUser = { ...effectiveUser, ...full };
            if (!mounted) return;
          } catch (err) {
            // ignore profile fetch failures — we'll proceed with what we have
          }
        }

        // Preselect user's department if available and load sections (pass debug header)
        if (effectiveUser?.department_id) {
          setFormData(fd => ({ ...fd, department_id: effectiveUser.department_id }));
          const sects = await orgApi.listSections(effectiveUser.department_id, 'TaskCenterCreateModal');
          // loaded sections for user.department_id
          if (!mounted) return;
          if (!['admin', 'manager'].includes(userRole) && effectiveUser?.section_id) {
            setSections(sects.filter(s => s.id === effectiveUser.section_id) || []);
          } else {
            setSections(sects || []);
          }

          // if user has a section, load users for that section
          if (effectiveUser?.section_id) {
            setFormData(fd => ({ ...fd, section_id: effectiveUser.section_id }));
            const users = await userApi.listUsersBySection(effectiveUser.section_id, 'TaskCenterCreateModal');
            // loaded users for user.section_id
            if (!mounted) return;
            setAssignees(users || []);
          }
        }
      } catch (err) {
        console.error('Failed to load org data for task modal', err);
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  const handleDepartmentChange = async (deptId?: number | string) => {
    try {
      const id = deptId === undefined || deptId === '' ? undefined : Number(deptId);
      // department change
      setFormData(fd => ({ ...fd, department_id: id, section_id: undefined, assigned_to_id: undefined }));
      setAssignees([]);
      if (id) {
        const sects = await orgApi.listSections(id);
        // received sections
        setSections(sects || []);
      } else {
        // If no department selected and user wants a TEAM task, load all sections to allow selecting a section
        if (formData.task_type === 'TEAM') {
          const sects = await orgApi.listSections(undefined);
          setSections(sects || []);
        } else {
          setSections([]);
        }
      }
    } catch (err) {
      console.error('Failed to load sections for department', err);
    }
  };

  const handleSectionChange = async (sectionId?: string) => {
    try {
      // section change
      setFormData(fd => ({ ...fd, section_id: sectionId, assigned_to_id: undefined }));
      setAssignees([]);
      if (sectionId) {
        const users = await userApi.listUsersBySection(sectionId);
        setAssignees(users || []);
      }
    } catch (err) {
      console.error('Failed to load users for section', err);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const validateForm = () => {
    const errors = [];
    
    // Title validation
    if (!formData.title.trim()) {
      errors.push("Title is required");
    } else if (formData.title.length > 200) {
      errors.push("Title must be 200 characters or less");
    }
    
    // Description validation
    if (formData.description && formData.description.length > 2000) {
      errors.push("Description must be 2000 characters or less");
    }
    
    // Estimated hours validation
    if (formData.estimated_hours && (isNaN(parseFloat(formData.estimated_hours)) || parseFloat(formData.estimated_hours) <= 0)) {
      errors.push("Estimated hours must be a positive number");
    }
    
    // Due date validation
    if (formData.due_date) {
      const dueDate = new Date(formData.due_date);
      if (isNaN(dueDate.getTime())) {
        errors.push("Invalid due date format");
      } else if (dueDate <= new Date()) {
        errors.push("Due date must be in the future");
      }
    }
    
    // Recurrence pattern validation
    if (formData.is_recurring && !formData.recurrence_pattern.trim()) {
      errors.push("Recurrence pattern is required for recurring tasks");
    }
    
    // Parent task validation
    if (formData.parent_task_id && !formData.parent_task_id.trim()) {
      errors.push("Invalid parent task ID");
    }
    
    return errors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (errors.length > 0) {
      alert(`Please fix the following errors:\n${errors.join('\n')}`);
      return;
    }
    
    const submitData = {
      ...formData,
      assigned_by_id: user?.id || '',
      estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : undefined,
      due_date: formData.due_date || undefined,
      assigned_to_id: formData.assigned_to_id || undefined,
      // department_id should be numeric to align with DB schema
      department_id: formData.department_id ? parseInt(String(formData.department_id), 10) : undefined,
      section_id: formData.section_id || undefined,
      parent_task_id: formData.parent_task_id || undefined,
      recurrence_pattern: formData.is_recurring ? formData.recurrence_pattern : undefined
    };
    
    onSubmit(submitData);
  };

  const userRole = user?.role?.toLowerCase() || '';
  const canCreateTeamTasks = ['admin', 'manager'].includes(userRole);
  const canCreateDepartmentTasks = ['admin', 'manager'].includes(userRole);
  const canCreateSystemTasks = userRole === 'admin';

  return (
    <div className="create-task-modal-overlay" onClick={onClose}>
      <div className="create-task-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="create-task-modal-header">
          <h2><FaPlus /> Create New Task</h2>
          <button onClick={onClose} className="create-task-close-btn" aria-label="Close modal">
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="create-task-form">
          <div className="create-task-form-group">
            <label>Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
              className="create-task-form-input"
              placeholder="Enter task title..."
            />
          </div>

          <div className="create-task-form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="create-task-form-textarea"
              rows={3}
              placeholder="Enter task description..."
            />
          </div>

          <div className="create-task-form-row">
            <div className="create-task-form-group">
              <label>Task Type *</label>
              <select
                value={formData.task_type}
                onChange={(e) => setFormData({...formData, task_type: e.target.value as TaskType})}
                className="create-task-form-select"
                required
              >
                <option value="PERSONAL">Personal</option>
                {canCreateTeamTasks && <option value="TEAM">Team</option>}
                {canCreateDepartmentTasks && <option value="DEPARTMENT">Department</option>}
                {canCreateSystemTasks && <option value="SYSTEM">System</option>}
              </select>
            </div>

          <div className="create-task-form-group">
            <label>Priority *</label>
            <div className="create-task-priority-selection">
              <div className="create-task-priority-options">
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((priorityLevel, index) => {
                  const priorityValue = index + 1;
                  const isActive = formData.priority === priorityLevel;
                  const priorityColors = {
                    LOW: '#22c55e',
                    MEDIUM: '#f59e0b', 
                    HIGH: '#ef4444',
                    CRITICAL: '#a855f7'
                  };
                  
                  return (
                    <button
                      key={priorityLevel}
                      type="button"
                      className={`create-task-priority-option ${isActive ? 'active' : ''}`}
                      onClick={() => setFormData({...formData, priority: priorityLevel as Priority})}
                    >
                      <div className="create-task-priority-label">{priorityLevel}</div>
                      <div className="create-task-priority-indicator" style={{ backgroundColor: priorityColors[priorityLevel as keyof typeof priorityColors] }} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          </div>

          <div className="create-task-form-row">
            <div className="create-task-form-group">
              <label>Due Date</label>
              <input
                type="datetime-local"
                value={formData.due_date}
                onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                className="create-task-form-input"
              />
            </div>

            <div className="create-task-form-group">
              <label>Estimated Hours</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={formData.estimated_hours}
                onChange={(e) => setFormData({...formData, estimated_hours: e.target.value})}
                className="create-task-form-input"
                placeholder="e.g. 2.5"
              />
            </div>
          </div>

          {(formData.task_type === 'TEAM' || formData.task_type === 'DEPARTMENT' || formData.task_type === 'SYSTEM') && (
            <div className="create-task-form-row">
              {formData.task_type === 'DEPARTMENT' && (
                <div className="create-task-form-group">
                  <label>Department</label>
                  <select
                    value={formData.department_id ?? ''}
                    onChange={(e) => handleDepartmentChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    className="create-task-form-select"
                  >
                    <option value="">— Select Department —</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.department_name}</option>
                    ))}
                  </select>
                </div>
              )}

              {(formData.task_type === 'TEAM' || formData.task_type === 'DEPARTMENT') && (
                <div className="create-task-form-group">
                  <label>Section</label>
                  <select
                    value={formData.section_id ?? ''}
                    onChange={(e) => handleSectionChange(e.target.value || undefined)}
                    className="create-task-form-select"
                  >
                    <option value="">— Select Section —</option>
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>{s.section_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="create-task-form-group">
                <label>Assign To</label>
                <select
                  value={formData.assigned_to_id ?? ''}
                  onChange={(e) => setFormData({...formData, assigned_to_id: e.target.value || undefined})}
                  className="create-task-form-select"
                >
                  <option value="">— Unassigned —</option>
                  {assignees.map(u => (
                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name} — {u.username}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="create-task-form-group">
            <label>Parent Task</label>
            <input
              type="text"
              value={formData.parent_task_id}
              onChange={(e) => setFormData({...formData, parent_task_id: e.target.value})}
              placeholder="Parent Task ID (optional)"
              className="create-task-form-input"
            />
          </div>

          <div className="create-task-form-group">
            <label>Tags</label>
            <div className="create-task-tag-input-container">
              <div className="create-task-tags-display">
                {formData.tags.map(tag => (
                  <span key={tag} className="create-task-tag">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="create-task-tag-remove">×</button>
                  </span>
                ))}
              </div>
              <div className="create-task-tag-input-row">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add tag..."
                  className="create-task-tag-input"
                />
                <button type="button" onClick={addTag} className="create-task-tag-add-btn">+</button>
              </div>
            </div>
          </div>

          <div className="create-task-form-group">
            <label className="create-task-checkbox-label">
              <input
                type="checkbox"
                checked={formData.is_recurring}
                onChange={(e) => setFormData({...formData, is_recurring: e.target.checked})}
                className="create-task-form-checkbox"
              />
              Recurring Task
            </label>
          </div>

          {formData.is_recurring && (
            <div className="create-task-form-group">
              <label>Recurrence Pattern</label>
              <input
                type="text"
                value={formData.recurrence_pattern}
                onChange={(e) => setFormData({...formData, recurrence_pattern: e.target.value})}
                placeholder="e.g., 'weekly', 'monthly', 'daily'"
                className="create-task-form-input"
              />
            </div>
          )}

          <div className="create-task-form-actions">
            <button type="button" onClick={onClose} className="create-task-btn-secondary">
              <FaTimes /> Cancel
            </button>
            <button type="submit" className="create-task-btn-primary">
              <FaPlus /> Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskCenterPage;
