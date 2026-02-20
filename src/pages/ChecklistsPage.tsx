// src/pages/ChecklistsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCalendarAlt, FaClock, FaCheckCircle, FaExclamationTriangle, FaHourglassHalf, FaFilter, FaSearch, FaArrowLeft, FaArrowRight, FaTrash, FaCalendarDay, FaCalendarWeek } from 'react-icons/fa';
import { checklistApi, ChecklistInstanceQueryParams, PaginatedResponse } from '../services/checklistApi';
import { useAuth } from '../contexts/AuthContext';
import { useChecklist } from '../contexts/checklistContext';
import { ChecklistsSkeleton } from '../components/dashboard';
import type { ChecklistInstance } from '../services/checklistApi';
import './ChecklistsPage.css';
import '../components/dashboard/ChecklistsSkeleton.css';

interface ChecklistsPageProps {}

const ChecklistsPage: React.FC<ChecklistsPageProps> = () => {
  const navigate = useNavigate();
  const { deleteInstance: deleteChecklistInstance } = useChecklist();
  const [instances, setInstances] = useState<ChecklistInstance[]>([]);
  const [filteredInstances, setFilteredInstances] = useState<ChecklistInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [shiftFilter, setShiftFilter] = useState<string>('all');
  
  // Date range filtering states
  const [dateFilterMode, setDateFilterMode] = useState<'week' | 'range' | 'day'>('week');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [instancesPerPage] = useState(20);
  const [totalInstances, setTotalInstances] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const { user } = useAuth();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const canDeleteInstance = (user: any) => {
    if (!user) return false;
    const role = user.role?.toUpperCase?.() || user.role;
    return role === 'ADMIN' || role === 'MANAGER';
  };

  const handleDeleteInstance = async () => {
    if (!deleteId) return;
    try {
      await deleteChecklistInstance(deleteId);
      // Also update local state to maintain consistency
      setInstances(prev => prev.filter(i => i.id !== deleteId));
      setShowDeleteConfirm(false);
      setDeleteId(null);
      setDeleteError(null);
    } catch (err) {
      setDeleteError('Failed to delete checklist instance');
    }
  };

  // Load instances with pagination and filtering
  useEffect(() => {
    loadInstances();
  }, [currentDate, dateFilterMode, startDate, endDate, currentPage]);

  // Filter instances (client-side for search, status, shift)
  useEffect(() => {
    filterInstances();
  }, [instances, searchTerm, statusFilter, shiftFilter]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, shiftFilter, dateFilterMode, startDate, endDate]);

  const getDateRange = useCallback(() => {
    switch (dateFilterMode) {
      case 'day':
        const dayDate = startDate || currentDate.toISOString().split('T')[0];
        return { start: dayDate, end: dayDate };
      
      case 'range':
        return {
          start: startDate || new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end: endDate || new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        };
      
      case 'week':
      default:
        const weekStart = new Date(currentDate);
        weekStart.setDate(weekStart.getDate() - 7);
        const weekEnd = new Date(currentDate);
        weekEnd.setDate(weekEnd.getDate() + 7);
        return {
          start: weekStart.toISOString().split('T')[0],
          end: weekEnd.toISOString().split('T')[0]
        };
    }
  }, [dateFilterMode, startDate, endDate, currentDate]);

  const loadInstances = async () => {
    try {
      setLoading(true);
      
      const { start, end } = getDateRange();
      
      // Use existing API endpoint for now (backend needs paginated endpoint)
      const realInstances = await checklistApi.getAllInstances(
        start,
        end,
        undefined // Shift filter handled client-side for now
      );
      
      // Apply client-side filtering for status, shift, and search
      let filtered = [...realInstances];
      
      // Status filter
      if (statusFilter !== 'all') {
        filtered = filtered.filter(instance => instance.status === statusFilter);
      }
      
      // Shift filter
      if (shiftFilter !== 'all') {
        filtered = filtered.filter(instance => instance.shift === shiftFilter);
      }
      
      // Search filter
      if (searchTerm) {
        filtered = filtered.filter(instance =>
          instance.template?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          instance.shift.toLowerCase().includes(searchTerm.toLowerCase()) ||
          instance.checklist_date.includes(searchTerm)
        );
      }
      
      // Sort by date descending
      filtered.sort((a, b) => new Date(b.checklist_date).getTime() - new Date(a.checklist_date).getTime());
      
      // Calculate pagination
      const startIndex = (currentPage - 1) * instancesPerPage;
      const endIndex = startIndex + instancesPerPage;
      const paginatedInstances = filtered.slice(startIndex, endIndex);
      
      setInstances(paginatedInstances);
      setFilteredInstances(paginatedInstances);
      setTotalInstances(filtered.length);
      setTotalPages(Math.ceil(filtered.length / instancesPerPage));
      setHasMore(endIndex < filtered.length);
      setError(null);
    } catch (err) {
      console.error('Failed to load instances:', err);
      setError('Failed to load checklist instances');
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };


  // Filter instances (now handled in loadInstances, but keeping for compatibility)
  const filterInstances = () => {
    // Filtering is now handled in loadInstances function
    // This function is kept for compatibility but instances are already filtered
    setFilteredInstances(instances);
  };

  const handleInstanceClick = (instance: ChecklistInstance) => {
    if (instance?.id) {
      navigate(`/checklist/${instance.id}`);
    } else {
      console.error('Instance ID is missing:', instance);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <FaCheckCircle className="status-icon completed" />;
      case 'IN_PROGRESS':
        return <FaClock className="status-icon in-progress" />;
      case 'OPEN':
        return <FaHourglassHalf className="status-icon scheduled" />;
      case 'PENDING_REVIEW':
        return <FaExclamationTriangle className="status-icon pending" />;
      case 'COMPLETED_WITH_EXCEPTIONS':
        return <FaExclamationTriangle className="status-icon exception" />;
      case 'CLOSED_BY_EXCEPTION':
        return <FaExclamationTriangle className="status-icon closed" />;
      default:
        return <FaExclamationTriangle className="status-icon unknown" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return '#00ff9d';
      case 'IN_PROGRESS':
        return '#00d9ff';
      case 'OPEN':
        return '#ffa502';
      case 'PENDING_REVIEW':
        return '#f39c12';
      case 'COMPLETED_WITH_EXCEPTIONS':
        return '#e74c3c';
      case 'CLOSED_BY_EXCEPTION':
        return '#c0392b';
      default:
        return '#ff6b6b';
    }
  };

  const getShiftColor = (shift: string) => {
    switch (shift) {
      case 'MORNING':
        return '#ffa502';
      case 'AFTERNOON':
        return '#00d9ff';
      case 'NIGHT':
        return '#9b59b6';
      default:
        return '#6c757d';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    
    if (dateFilterMode === 'week') {
      if (direction === 'prev') {
        newDate.setDate(newDate.getDate() - 7);
      } else {
        newDate.setDate(newDate.getDate() + 7);
      }
    } else if (dateFilterMode === 'day') {
      if (direction === 'prev') {
        newDate.setDate(newDate.getDate() - 1);
      } else {
        newDate.setDate(newDate.getDate() + 1);
      }
    }
    
    setCurrentDate(newDate);
  };

  const handleDateFilterModeChange = (mode: 'week' | 'range' | 'day') => {
    setDateFilterMode(mode);
    if (mode === 'week') {
      setStartDate('');
      setEndDate('');
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Get paginated instances for display (now handled server-side)
  const getPaginatedInstances = () => {
    return instances;
  };

  const totalPagesCalculated = totalPages;

  // Group instances by date, sorted by date descending
  const groupInstancesByDate = () => {
    const grouped: { [date: string]: ChecklistInstance[] } = {};
    
    // Use paginated instances for display
    const displayInstances = getPaginatedInstances();
    
    // Sort instances by date descending, then by shift order
    const shiftOrder = { 'MORNING': 0, 'AFTERNOON': 1, 'NIGHT': 2 };
    const sortedInstances = [...displayInstances].sort((a, b) => {
      const dateCompare = new Date(b.checklist_date).getTime() - new Date(a.checklist_date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return (shiftOrder[a.shift] || 0) - (shiftOrder[b.shift] || 0);
    });
    
    sortedInstances.forEach(instance => {
      if (!grouped[instance.checklist_date]) {
        grouped[instance.checklist_date] = [];
      }
      grouped[instance.checklist_date].push(instance);
    });

    return grouped;
  };

  if (loading) {
    return <ChecklistsSkeleton />;
  }

  if (error) {
    return (
      <div className="checklists-page">
        <div className="error-container">
          <FaExclamationTriangle className="error-icon" />
          <h3>Error Loading Checklists</h3>
          <p>{typeof error === 'string' ? error : JSON.stringify(error)}</p>
          <button onClick={loadInstances} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const groupedInstances = groupInstancesByDate();

  return (
    <div className="checklists-page">
      <div className="checklists-header">
        <div className="header-content">
          <h1>
            <FaCalendarAlt className="header-icon" />
            Checklists Timeline
          </h1>
          <p className="header-subtitle">
            Manage and track all checklist instances across shifts and dates
          </p>
        </div>

        <div className="header-controls">
          <div className="controls-row">
            <div className="search-container">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search checklists..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="filter-container">
              <FaFilter className="filter-icon" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Status</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING_REVIEW">Pending Review</option>
                <option value="COMPLETED_WITH_EXCEPTIONS">Completed with Exceptions</option>
                <option value="CLOSED_BY_EXCEPTION">Closed by Exception</option>
              </select>

              <select
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Shifts</option>
                <option value="MORNING">Morning</option>
                <option value="AFTERNOON">Afternoon</option>
                <option value="NIGHT">Night</option>
              </select>
            </div>
          </div>

          <div className="date-filter-container">
            <div className="date-filter-modes">
              <button
                className={`date-mode-btn ${dateFilterMode === 'week' ? 'active' : ''}`}
                onClick={() => handleDateFilterModeChange('week')}
                title="Week view"
              >
                <FaCalendarWeek /> Week
              </button>
              <button
                className={`date-mode-btn ${dateFilterMode === 'day' ? 'active' : ''}`}
                onClick={() => handleDateFilterModeChange('day')}
                title="Day view"
              >
                <FaCalendarDay /> Day
              </button>
              <button
                className={`date-mode-btn ${dateFilterMode === 'range' ? 'active' : ''}`}
                onClick={() => handleDateFilterModeChange('range')}
                title="Date range"
              >
                <FaCalendarAlt /> Range
              </button>
            </div>

            {(dateFilterMode === 'week' || dateFilterMode === 'day') && (
              <div className="date-navigation">
                <button
                  onClick={() => navigateDate('prev')}
                  className="nav-btn"
                  title={dateFilterMode === 'week' ? 'Previous week' : 'Previous day'}
                >
                  <FaArrowLeft />
                </button>
                <span className="date-range">
                  {dateFilterMode === 'week' 
                    ? formatDate(currentDate.toISOString().split('T')[0])
                    : formatDate(startDate || currentDate.toISOString().split('T')[0])
                  }
                </span>
                <button
                  onClick={() => navigateDate('next')}
                  className="nav-btn"
                  title={dateFilterMode === 'week' ? 'Next week' : 'Next day'}
                >
                  <FaArrowRight />
                </button>
              </div>
            )}

            {dateFilterMode === 'range' && (
              <div className="date-range-picker">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="date-input"
                  placeholder="Start date"
                />
                <span className="date-separator">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="date-input"
                  placeholder="End date"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="checklists-content">
        <div className="timeline-container">
          {Object.keys(groupedInstances).length === 0 ? (
            <div className="no-results">
              <FaCalendarAlt className="no-results-icon" />
              <h3>No Checklists Found</h3>
              <p>Try adjusting your filters or search terms</p>
            </div>
          ) : (
            Object.entries(groupedInstances).map(([date, dayInstances]) => {
              return (
                <div key={date} className="timeline-day">
                  <div className="day-header">
                    <h3 className="day-date">{formatDate(date)}</h3>
                    <div className="day-stats">
                      <span className="stat-item">
                        {dayInstances.filter(i => i.status === 'COMPLETED').length} completed
                      </span>
                      <span className="stat-item">
                        {dayInstances.filter(i => i.status === 'IN_PROGRESS').length} in progress
                      </span>
                      <span className="stat-item">
                        {dayInstances.filter(i => i.status === 'OPEN').length} scheduled
                      </span>
                    </div>
                  </div>

                  <div className="instances-grid">
                    {dayInstances.map((instance) => (
                      <div
                        key={instance.id}
                        className="instance-card"
                        onClick={() => handleInstanceClick(instance)}
                        style={{
                          borderLeftColor: getShiftColor(instance.shift),
                          backgroundColor: instance.status === 'IN_PROGRESS' ? 'rgba(0, 217, 255, 0.05)' : 'transparent'
                        }}
                      >
                        <div className="instance-header">
                          <div className="instance-info">
                            <div className="instance-title">
                              {instance.template?.name || 'Unknown Checklist'}
                            </div>
                            <div className="instance-meta">
                              <span 
                                className="shift-badge"
                                style={{ backgroundColor: getShiftColor(instance.shift) }}
                              >
                                {instance.shift}
                              </span>
                              <span className="date-badge">
                                {formatDate(instance.checklist_date)}
                              </span>
                            </div>
                          </div>
                          <div className="instance-status">
                            {getStatusIcon(instance.status)}
                            <span 
                              className="status-text"
                              style={{ color: getStatusColor(instance.status) }}
                            >
                              {instance.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>

                        <div className="instance-details">
                          <div className="time-info">
                            <div className="time-item">
                              <FaClock className="time-icon" />
                              <span>Start: {formatTime(instance.shift_start)}</span>
                            </div>
                            <div className="time-item">
                              <FaClock className="time-icon" />
                              <span>End: {formatTime(instance.shift_end)}</span>
                            </div>
                          </div>

                          {instance.closed_at && (
                            <div className="completion-info">
                              <FaCheckCircle className="completion-icon" />
                              <span>Completed: {formatTime(instance.closed_at)}</span>
                            </div>
                          )}
                        </div>

                        <div className="instance-footer">
                          <div className="instance-id">ID: {instance.id}</div>
                          <div className="click-hint">Click to open →</div>
                          {canDeleteInstance(user) && (
                            <button
                              className="instance-delete-btn"
                              title="Delete instance"
                              onClick={e => {
                                e.stopPropagation();
                                setDeleteId(instance.id);
                                setShowDeleteConfirm(true);
                              }}
                            >
                              <FaTrash />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
          {/* Pagination Controls */}
          {totalPagesCalculated > 1 && (
            <div className="pagination-container">
              <div className="pagination-info">
                <span>
                  Showing {instances.length} of {totalInstances} instances
                  {totalInstances > instancesPerPage && ` (page ${currentPage} of ${totalPagesCalculated})`}
                </span>
              </div>
              
              <div className="pagination-controls">
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || isLoadingMore}
                >
                  <FaArrowLeft /> Previous
                </button>
                
                <div className="pagination-numbers">
                  {Array.from({ length: Math.min(5, totalPagesCalculated) }, (_, i) => {
                    let pageNum: number;
                    if (totalPagesCalculated <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPagesCalculated - 2) {
                      pageNum = totalPagesCalculated - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        className={`pagination-number ${currentPage === pageNum ? 'active' : ''}`}
                        onClick={() => handlePageChange(pageNum)}
                        disabled={isLoadingMore}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPagesCalculated || isLoadingMore}
                >
                  Next <FaArrowRight />
                </button>
              </div>
            </div>
          )}
          
          {/* Delete Confirmation Modal (should be outside the map) */}
          {showDeleteConfirm && (
            <div className="stl-modal-backdrop" onClick={() => setShowDeleteConfirm(false)}>
              <div className="stl-delete-confirm-modal" onClick={e => e.stopPropagation()}>
                <h3>Delete Checklist Instance?</h3>
                <p>This action cannot be undone.</p>
                {deleteError && <div className="error-message">{deleteError}</div>}
                <div className="stl-modal-actions">
                  <button
                    className="stl-btn stl-btn-cancel"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteId(null);
                      setDeleteError(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button className="stl-btn stl-btn-danger" onClick={handleDeleteInstance}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChecklistsPage;
