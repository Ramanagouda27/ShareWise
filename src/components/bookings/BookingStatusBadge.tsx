import React from 'react';
import { BookingStatus } from '../../types/booking';
import { getStatusMeta } from '../../lib/status';

export interface BookingStatusBadgeProps {
  status: BookingStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export const BookingStatusBadge: React.FC<BookingStatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const meta = getStatusMeta(status);

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ring-1 ring-inset tracking-wide select-none ${meta.badgeClasses} ${sizeClasses[size]} ${className}`}
      title={meta.description}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotColor}`} />
      <span>{meta.label}</span>
    </span>
  );
};
