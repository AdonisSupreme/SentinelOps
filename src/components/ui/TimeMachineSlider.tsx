// components/ui/TimeMachineSlider.tsx
import React, { useState, useEffect } from 'react';
import { FaCalendarAlt } from 'react-icons/fa';
import { useTheme } from '../../contexts/ThemeContext';

interface TimeMachineSliderProps {
  onChange: (date: Date) => void;
}

export const TimeMachineSlider: React.FC<TimeMachineSliderProps> = ({ onChange }) => {
  const { theme } = useTheme();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [timelineDates, setTimelineDates] = useState<Date[]>([]);

  useEffect(() => {
    // Generate timeline (past 6 months to future 6 months)
    const dates = [];
    const today = new Date();
    for (let i = -6; i <= 6; i++) {
      const date = new Date();
      date.setMonth(today.getMonth() + i);
      dates.push(date);
    }
    setTimelineDates(dates);
  }, []);

  const handleDateChange = (index: number) => {
    const selectedDate = timelineDates[index];
    setCurrentDate(selectedDate);
    onChange(selectedDate);
  };

  return (
    <div className={`time-machine ${theme}`}>
      <div className="header">
        <FaCalendarAlt />
        <h3>Time Explorer</h3>
      </div>
      
      <div className="timeline">
        {timelineDates.map((date, index) => (
          <div 
            key={index}
            className={`timeline-point ${date.getMonth() === currentDate.getMonth() ? 'active' : ''}`}
            onClick={() => handleDateChange(index)}
          >
            <div className="point-indicator"></div>
            <span className="date-label">
              {date.toLocaleString('default', { month: 'short' })}
              <br />
              {date.getFullYear()}
            </span>
          </div>
        ))}
      </div>
      
      <div className="current-date">
        Viewing: {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </div>
    </div>
  );
};