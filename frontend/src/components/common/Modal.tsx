import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-xl' }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog (Native Bottom Sheet on Mobile, Centered Dialog on Desktop) */}
      <div className={`relative w-full ${maxWidth} bg-white border border-[#E9EAEE] rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden z-10 transition-all duration-200 max-h-[90vh] flex flex-col`}>
        {/* Mobile Pull Handle Indicator */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 bg-[#F8F9FB]">
          <div className="w-10 h-1 bg-[#D8DCE3] rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-[#E9EAEE] bg-[#F8F9FB] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-5 bg-[#D62839] rounded-full" />
            <h2 className="text-base font-bold text-[#20242C] tracking-tight">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#667085] hover:text-[#D62839] hover:bg-[#FFF1F2] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 safe-area-bottom">
          {children}
        </div>
      </div>
    </div>
  );
};
