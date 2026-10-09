import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from './Badge';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title,
  children,
  maxWidth = 'md'
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-charcoal-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal Panel */}
      <div 
        className={cn(
          "relative bg-white rounded-xl shadow-modal w-full animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-full",
          maxWidthClasses[maxWidth]
        )}
      >
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-charcoal-200 bg-charcoal-50">
            <h2 className="text-lg font-bold text-charcoal-900">{title}</h2>
            <button onClick={onClose} className="p-2 text-charcoal-500 hover:text-charcoal-900 hover:bg-charcoal-200 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        )}
        
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
