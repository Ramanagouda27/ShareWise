import { Resource } from './resource';
import { ConditionReport } from './conditionReport';

export type BookingStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'waitlisted'
  | 'checked_out'
  | 'returned'
  | 'cancelled'
  | 'overdue';

export interface Booking {
  id: string;
  resourceId: string;
  resource?: Resource;
  requesterId: string;
  requesterName: string;
  requesterEmail?: string;
  requesterDepartment?: string;
  requesterStudentId?: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  purposeNotes?: string;
  rejectionReason?: string;
  ownerNotes?: string;
  createdAt: string;
  updatedAt: string;
  conditionReports?: ConditionReport[];
  checkedOutAt?: string;
  returnedAt?: string;
}

export interface BookingRequestInput {
  resourceId: string;
  startTime: string;
  endTime: string;
  purposeNotes: string;
}

export interface BookingReviewInput {
  bookingId: string;
  decision: 'approve' | 'reject' | 'waitlist';
  rejectionReason?: string;
}

export interface CheckoutInput {
  bookingId: string;
  grade: ConditionReport['grade'];
  notes: string;
}

export interface ReturnInput {
  bookingId: string;
  grade: ConditionReport['grade'];
  notes: string;
}

export interface BookingSummaryStats {
  total: number;
  pending: number;
  approved: number;
  checkedOut: number;
  returned: number;
  rejected: number;
  cancelled: number;
}
