// src/components/ui/Tabs.tsx
import React from 'react';

interface TabProps {
  id: string;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  activeTab: string;
  onChange: (id: string) => void;
  children: React.ReactElement<TabProps>[];
}

export const Tabs: React.FC<TabsProps> = ({ activeTab, onChange, children }) => {
  return (
    <div className="tabs-container">
      <div className="tabs-header">
        {React.Children.map(children, (child) => (
          <button
            key={child.props.id}
            className={`tab ${activeTab === child.props.id ? 'active' : ''} ${child.props.disabled ? 'disabled' : ''}`}
            onClick={() => !child.props.disabled && onChange(child.props.id)}
            disabled={child.props.disabled}
          >
            {child.props.label}
            {child.props.disabled && <span className="coming-soon">Soon</span>}
          </button>
        ))}
      </div>
      
      <div className="tabs-content">
        {React.Children.map(children, (child) => (
          activeTab === child.props.id && (
            <div key={child.props.id} className="tab-panel">
              {child.props.children}
            </div>
          )
        ))}
      </div>
    </div>
  );
};

export const Tab: React.FC<TabProps> = ({ children }) => {
  return <>{children}</>;
};

export const Input: React.FC<{
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon?: React.ReactNode;
}> = ({ type, placeholder, value, onChange, icon }) => (
  <div className="input-wrapper">
    {icon && <span className="input-icon">{icon}</span>}
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
    />
  </div>
);

export const Button: React.FC<{
  variant?: 'primary' | 'secondary' | 'outline';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  'aria-label'?: string;
}> = ({ 
  variant = 'primary', 
  children, 
  onClick, 
  disabled = false, 
  type = 'button',
  className = '',
  'aria-label': ariaLabel 
}) => (
  <button 
    className={`btn-${variant} ${className}`}
    onClick={onClick}
    disabled={disabled}
    type={type}
    aria-label={ariaLabel}
  >
    {children}
  </button>
);

export const Select: React.FC<{
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  label?: string;
  'aria-label'?: string;
  disabled?: boolean;
}> = ({ 
  options, 
  value, 
  onChange, 
  placeholder, 
  id, 
  label, 
  'aria-label': ariaLabel,
  disabled = false 
}) => (
  <div className="select-wrapper">
    {label && <label htmlFor={id} className="select-label">{label}</label>}
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="select-input"
      aria-label={ariaLabel || label || placeholder || 'Select an option'}
      disabled={disabled}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <div className="select-arrow">▼</div>
  </div>
);

export const DateRangePicker: React.FC<{
  ranges: { startDate: Date; endDate: Date }[];
  onChange: (range: { startDate: Date; endDate: Date }) => void;
}> = ({ ranges, onChange }) => {
  const handleSelect = (startDate: Date, endDate: Date) => {
    onChange({ startDate, endDate });
  };

  return (
    <div className="date-range-picker">
      {ranges.map((range, index) => (
        <button
          key={index}
          onClick={() => handleSelect(range.startDate, range.endDate)}
        >
          {range.startDate.toLocaleDateString()} - {range.endDate.toLocaleDateString()}
        </button>
      ))}
    </div>
  );
};