import { BookingStatus } from '../types/booking';

export interface StatusMeta {
  label: string;
  description: string;
  badgeClasses: string;
  dotColor: string;
}

export const BOOKING_STATUS_CONFIG: Record<BookingStatus, StatusMeta> = {
  pending: {
    label: 'Pending Review',
    description: 'Awaiting approval from equipment owner',
    badgeClasses: 'bg-amber-50 text-amber-700 border-amber-200/80 ring-amber-500/20',
    dotColor: 'bg-amber-500',
  },
  approved: {
    label: 'Approved',
    description: 'Booking approved. Ready for scheduled checkout',
    badgeClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 ring-emerald-500/20',
    dotColor: 'bg-emerald-500',
  },
  rejected: {
    label: 'Rejected',
    description: 'Request declined by equipment owner',
    badgeClasses: 'bg-rose-50 text-rose-700 border-rose-200/80 ring-rose-500/20',
    dotColor: 'bg-rose-500',
  },
  waitlisted: {
    label: 'Waitlisted',
    description: 'Queue position reserved if prior booking cancels',
    badgeClasses: 'bg-sky-50 text-sky-700 border-sky-200/80 ring-sky-500/20',
    dotColor: 'bg-sky-500',
  },
  checked_out: {
    label: 'Checked Out',
    description: 'Currently in borrower possession',
    badgeClasses: 'bg-blue-50 text-blue-700 border-blue-200/80 ring-blue-500/20',
    dotColor: 'bg-blue-500',
  },
  returned: {
    label: 'Returned',
    description: 'Returned and verified in good condition',
    badgeClasses: 'bg-teal-50 text-teal-700 border-teal-200/80 ring-teal-500/20',
    dotColor: 'bg-teal-500',
  },
  cancelled: {
    label: 'Cancelled',
    description: 'Booking cancelled before checkout',
    badgeClasses: 'bg-neutral-100 text-neutral-600 border-neutral-200 ring-neutral-400/20',
    dotColor: 'bg-neutral-400',
  },
  overdue: {
    label: 'Overdue',
    description: 'Return deadline passed; please return immediately',
    badgeClasses: 'bg-red-50 text-red-700 border-red-200 ring-red-500/20 font-medium animate-pulse',
    dotColor: 'bg-red-600',
  },
};

export const getStatusMeta = (status: BookingStatus): StatusMeta => {
  return (
    BOOKING_STATUS_CONFIG[status] || {
      label: status,
      description: '',
      badgeClasses: 'bg-neutral-50 text-neutral-700 border-neutral-200 ring-neutral-400/20',
      dotColor: 'bg-neutral-400',
    }
  );
};
