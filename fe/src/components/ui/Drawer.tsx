import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from './Badge';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  position?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Drawer: React.FC<DrawerProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children,
  position = 'right',
  size = 'md'
}) => {
  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className={cn("fixed inset-0 z-[100] transition-all duration-300", isOpen ? "visible opacity-100" : "invisible opacity-0")}>
      {/* Backdrop */}
      <div 
        className={cn("absolute inset-0 bg-charcoal-900/40 backdrop-blur-sm transition-opacity duration-300", isOpen ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      
      {/* Drawer Panel */}
      <div 
        className={cn(
          "absolute top-0 h-full bg-white shadow-modal transition-transform duration-300 flex flex-col w-full",
          sizeClasses[size],
          position === 'right' ? 'right-0' : 'left-0',
          isOpen 
            ? "translate-x-0" 
            : position === 'right' ? "translate-x-full" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-charcoal-200">
          <h2 className="text-lg font-bold text-charcoal-900">{title}</h2>
          <button onClick={onClose} className="p-2 text-charcoal-500 hover:text-charcoal-900 hover:bg-charcoal-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
