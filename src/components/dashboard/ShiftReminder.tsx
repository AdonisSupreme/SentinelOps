// src/components/dashboard/ShiftReminder.tsx
import React, { useState, useEffect } from 'react';
import { FaClock, FaHourglassHalf, FaSun, FaMoon, FaCloudSun } from 'react-icons/fa';
import './ShiftReminder.css';

const ShiftReminder: React.FC = () => {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [currentShift, setCurrentShift] = useState<string>('');
  const [shiftProgress, setShiftProgress] = useState<number>(0);

  useEffect(() => {
    const calculateShiftInfo = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;

      let shiftName = '';
      let shiftStart = 0;
      let shiftEnd = 0;
      let shiftIcon = <FaClock />;
      let shiftColor = '';

      // Determine current shift based on updated times (07:00-15:00, 15:00-23:00, 23:00-07:00)
      if (currentHour >= 7 && currentHour < 15) {
        // Morning shift: 07:00 - 15:00
        shiftName = 'Morning Shift';
        shiftStart = 7 * 60; // 420 minutes
        shiftEnd = 15 * 60; // 900 minutes
        shiftIcon = <FaSun />;
        shiftColor = '#ffa502';
      } else if (currentHour >= 15 && currentHour < 23) {
        // Afternoon shift: 15:00 - 23:00
        shiftName = 'Afternoon Shift';
        shiftStart = 15 * 60; // 900 minutes
        shiftEnd = 23 * 60; // 1380 minutes
        shiftIcon = <FaCloudSun />;
        shiftColor = '#00d9ff';
      } else {
        // Night shift: 23:00 - 07:00 (next day)
        shiftName = 'Night Shift';
        if (currentHour >= 23) {
          shiftStart = 23 * 60; // 1380 minutes (today 23:00)
          shiftEnd = (24 * 60) + (7 * 60); // 1860 minutes (next day 07:00)
        } else {
          shiftStart = 0; // Midnight (start of day)
          shiftEnd = 7 * 60; // 420 minutes (07:00)
        }
        shiftIcon = <FaMoon />;
        shiftColor = '#9b59b6';
      }

      // Calculate time remaining
      let remainingMinutes;
      if (currentHour >= 23) {
        // Night shift, after 23:00
        remainingMinutes = shiftEnd - currentTimeInMinutes;
      } else if (currentHour < 7) {
        // Night shift, before 07:00 (next day calculation)
        remainingMinutes = shiftEnd - currentTimeInMinutes;
      } else {
        // Morning or afternoon shift
        remainingMinutes = shiftEnd - currentTimeInMinutes;
      }

      // Calculate progress
      let totalShiftMinutes;
      let elapsedMinutes;
      
      if (currentHour >= 23) {
        // Night shift after midnight
        totalShiftMinutes = 8 * 60; // 480 minutes
        elapsedMinutes = currentTimeInMinutes - shiftStart;
      } else if (currentHour < 7) {
        // Night shift before 07:00
        totalShiftMinutes = 8 * 60; // 480 minutes
        elapsedMinutes = currentTimeInMinutes + (24 * 60) - shiftStart;
      } else {
        // Morning or afternoon shift
        totalShiftMinutes = 8 * 60; // 480 minutes
        elapsedMinutes = currentTimeInMinutes - shiftStart;
      }
      
      const progress = Math.min(100, Math.max(0, (elapsedMinutes / totalShiftMinutes) * 100));

      // Format time remaining
      let timeString = '';
      if (remainingMinutes <= 0) {
        timeString = 'Shift Ending';
      } else if (remainingMinutes < 60) {
        timeString = `${remainingMinutes}m left`;
      } else {
        const hours = Math.floor(remainingMinutes / 60);
        const minutes = remainingMinutes % 60;
        timeString = `${hours}h ${minutes}m left`;
      }

      setCurrentShift(shiftName);
      setTimeRemaining(timeString);
      setShiftProgress(progress);
    };

    calculateShiftInfo();
    const interval = setInterval(calculateShiftInfo, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const getShiftIcon = () => {
    const hour = new Date().getHours();
    if (hour >= 7 && hour < 15) return <FaSun />;
    if (hour >= 15 && hour < 23) return <FaCloudSun />;
    return <FaMoon />;
  };

  const getShiftColor = () => {
    const hour = new Date().getHours();
    if (hour >= 7 && hour < 15) return '#ffa502';
    if (hour >= 15 && hour < 23) return '#00d9ff';
    return '#9b59b6';
  };

  return (
    <div className="shift-reminder">
      <div className="shift-content">
        <div className="shift-icon" style={{ color: getShiftColor() }}>
          {getShiftIcon()}
        </div>
        <div className="shift-info">
          <div className="shift-name">{currentShift}</div>
          <div className="shift-time">{timeRemaining}</div>
        </div>
        <div className="shift-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ 
                width: `${shiftProgress}%`,
                background: getShiftColor()
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShiftReminder;
