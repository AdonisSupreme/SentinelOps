import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import TeamScheduleCalendar from '../components/team/TeamScheduleCalendar';
import './UserScheduleDashboard.css';

const TeamManagementCalendarPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin';
  const userSectionId = (currentUser as any)?.section_id || '';

  if (!isAdmin && !userSectionId) {
    return (
      <div className="user-schedule-dashboard">
        <div className="empty-inline">
          <div>
            <strong>Access Denied</strong>
            <div>You need manager or admin rights to view team schedules.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="user-schedule-dashboard">
      <TeamScheduleCalendar 
        sectionId={isAdmin ? undefined : userSectionId}
      />
    </div>
  );
};

export default TeamManagementCalendarPage;
