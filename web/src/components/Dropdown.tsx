import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import './Dropdown.css';

interface DropdownOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface DropdownProps<T extends string> {
  options: DropdownOption<T>[];
  selectedValue: T;
  onChange: (value: T) => void;
  className?: string;
  label?: string;
}

export function Dropdown<T extends string>({ 
  options, 
  selectedValue, 
  onChange,
  className = '',
  label
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === selectedValue) || options[0];

  const handleOptionClick = (value: T) => {
    onChange(value);
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`dropdown ${className}`} ref={dropdownRef}>
      {label && <span className="dropdown-label-text">{label}</span>}
      <button
        className="dropdown-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="dropdown-label">{selectedOption.label}</span>
        {selectedOption.icon && <span className="dropdown-icon">{selectedOption.icon}</span>}
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>
      
      {isOpen && (
        <div className="dropdown-menu">
          {options.map((option) => (
            <button
              key={option.value}
              className={`dropdown-option ${option.value === selectedValue ? 'active' : ''}`}
              onClick={() => handleOptionClick(option.value)}
            >
              <span className="dropdown-label">{option.label}</span>
              {option.icon && <span className="dropdown-icon">{option.icon}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
