// src/pages/ChecklistsPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCalendarAlt, FaClock, FaCheckCircle, FaExclamationTriangle, FaHourglassHalf, FaFilter, FaSearch, FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import { checklistApi } from '../services/checklistApi';
import type { ChecklistInstance } from '../services/checklistApi';
import './ChecklistsPage.css';

interface ChecklistsPageProps {}

const ChecklistsPage: React.FC<ChecklistsPageProps> = () => {
  const navigate = useNavigate();
  const [instances, setInstances] = useState<ChecklistInstance[]>([]);
  const [filteredInstances, setFilteredInstances] = useState<ChecklistInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [shiftFilter, setShiftFilter] = useState<string>('all');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Load all instances
  useEffect(() => {
    loadInstances();
  }, [currentDate]);

  // Filter instances
  useEffect(() => {
    filterInstances();
  }, [instances, searchTerm, statusFilter, shiftFilter]);

  const loadInstances = async () => {
    try {
      setLoading(true);
      // For now, we'll get today's instances. In a real implementation, 
      // we'd need an API endpoint to get instances for a date range
      const todayInstances = await checklistApi.getTodayInstances();
      
      // Generate instances for the past 7 days and next 7 days for demo
      const generatedInstances = generateInstanceRange(todayInstances, currentDate);
      
      setInstances(generatedInstances);
      setError(null);
    } catch (err) {
      console.error('Failed to load instances:', err);
      setError('Failed to load checklist instances');
    } finally {
      setLoading(false);
    }
  };

  const generateInstanceRange = (todayInstances: ChecklistInstance[], baseDate: Date): ChecklistInstance[] => {
    const instances: ChecklistInstance[] = [];
    const shifts = ['MORNING', 'AFTERNOON', 'NIGHT'];
    
    // Generate instances for 7 days before and after current date
    for (let i = -7; i <= 7; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      shifts.forEach(shift => {
        // Check if we have a template for this shift
        const templateId = `${shift.toLowerCase()}-template`;
        const dateForInstance = new Date(dateStr);
        
        const template = {
          id: templateId,
          name: `${shift.charAt(0) + shift.slice(1).toLowerCase()} Operations Checklist`,
          description: `${shift.charAt(0) + shift.slice(1).toLowerCase()} shift checklist for daily operations`,
          shift: shift as 'MORNING' | 'AFTERNOON' | 'NIGHT',
          version: 1,
          is_active: true,
          created_at: dateForInstance.toISOString()
        };
        
        // Calculate status based on current time and shift schedule
        const now = new Date();
        const status = calculateInstanceStatus(shift, dateForInstance, now);
        
        const startTime = calculateShiftStartTime(shift, dateForInstance);
        const endTime = calculateShiftEndTime(shift, dateForInstance);
        
        const instance: ChecklistInstance = {
          id: `${dateStr}-${shift.toLowerCase()}`,
          template: template,
          checklist_date: dateStr,
          shift: shift as 'MORNING' | 'AFTERNOON' | 'NIGHT',
          shift_start: startTime.toISOString(),
          shift_end: endTime.toISOString(),
          status: status as 'OPEN' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'COMPLETED' | 'COMPLETED_WITH_EXCEPTIONS' | 'CLOSED_BY_EXCEPTION',
          created_by: null,
          closed_by: null,
          closed_at: status === 'COMPLETED' ? endTime.toISOString() : null,
          created_at: dateForInstance.toISOString(),
          items: [],
          participants: [],
          notes: [],
          attachments: [],
          exceptions: [],
          handover_notes: []
        };
        
        instances.push(instance);
      });
    }
    
    return instances.sort((a, b) => new Date(b.checklist_date).getTime() - new Date(a.checklist_date).getTime());
  };

  const calculateInstanceStatus = (shift: string, instanceDate: Date, now: Date): string => {
    const startTime = calculateShiftStartTime(shift, instanceDate);
    const endTime = calculateShiftEndTime(shift, instanceDate);
    
    if (now >= endTime) {
      return 'COMPLETED';
    } else if (now >= startTime) {
      return 'IN_PROGRESS';
    } else {
      return 'OPEN';
    }
  };

  const calculateShiftStartTime = (shift: string, date: Date): Date => {
    const startTime = new Date(date);
    switch (shift) {
      case 'MORNING':
        startTime.setHours(7, 0, 0, 0);
        break;
      case 'AFTERNOON':
        startTime.setHours(15, 0, 0, 0);
        break;
      case 'NIGHT':
        startTime.setHours(23, 0, 0, 0);
        break;
    }
    return startTime;
  };

  const calculateShiftEndTime = (shift: string, date: Date): Date => {
    const endTime = new Date(date);
    switch (shift) {
      case 'MORNING':
        endTime.setHours(15, 0, 0, 0);
        break;
      case 'AFTERNOON':
        endTime.setHours(23, 0, 0, 0);
        break;
      case 'NIGHT':
        endTime.setDate(endTime.getDate() + 1);
        endTime.setHours(7, 0, 0, 0);
        break;
    }
    return endTime;
  };

  const filterInstances = () => {
    let filtered = [...instances];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(instance =>
        instance.template?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        instance.shift.toLowerCase().includes(searchTerm.toLowerCase()) ||
        instance.checklist_date.includes(searchTerm)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(instance => instance.status === statusFilter);
    }

    // Shift filter
    if (shiftFilter !== 'all') {
      filtered = filtered.filter(instance => instance.shift === shiftFilter);
    }

    setFilteredInstances(filtered);
  };

  const handleInstanceClick = (instance: ChecklistInstance) => {
    navigate(`/checklist/${instance.id}`);
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
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  const groupInstancesByDate = () => {
    const grouped: { [date: string]: ChecklistInstance[] } = {};
    
    filteredInstances.forEach(instance => {
      if (!grouped[instance.checklist_date]) {
        grouped[instance.checklist_date] = [];
      }
      grouped[instance.checklist_date].push(instance);
    });

    return grouped;
  };

  if (loading) {
    return (
      <div className="checklists-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading checklist instances...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="checklists-page">
        <div className="error-container">
          <FaExclamationTriangle className="error-icon" />
          <h3>Error Loading Checklists</h3>
          <p>{error}</p>
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

          <div className="date-navigation">
            <button
              onClick={() => navigateDate('prev')}
              className="nav-btn"
              title="Previous 7 days"
            >
              <FaArrowLeft />
            </button>
            <span className="date-range">
              {formatDate(currentDate.toISOString().split('T')[0])}
            </span>
            <button
              onClick={() => navigateDate('next')}
              className="nav-btn"
              title="Next 7 days"
            >
              <FaArrowRight />
            </button>
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
            Object.entries(groupedInstances).map(([date, dayInstances]) => (
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
                        <div className="instance-id">
                          ID: {instance.id}
                        </div>
                        <div className="click-hint">
                          Click to open →
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ChecklistsPage;
