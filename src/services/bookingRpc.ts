import { AppError, type ErrorCode } from '../lib/errors';
import { getSupabaseClient } from './supabaseClient';

export interface BookingRpcData {
  id: string;
  resourceId: string;
  requesterId: string;
  startTime: string;
  endTime: string;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected' | 'waitlisted' | 'checked_out' | 'returned' | 'cancelled' | 'overdue';
  createdAt: string;
}

type BookingRpcName =
  | 'request_booking'
  | 'review_booking'
  | 'cancel_booking'
  | 'check_in_booking'
  | 'return_booking';

interface BookingRpcEnvelope<T> {
  success: boolean;
  code: string;
  message: string;
  data: T | null;
}

const DATABASE_ERROR_MAP: Record<string, ErrorCode> = {
  UNAUTHENTICATED: 'AUTH_REQUIRED',
  NOT_AUTHORISED: 'NOT_AUTHORIZED',
  RESOURCE_UNAVAILABLE: 'RESOURCE_UNAVAILABLE',
  INELIGIBLE: 'ELIGIBILITY_FAILED',
  INVALID_TIME_RANGE: 'INVALID_TIME_RANGE',
  BOOKING_CONFLICT: 'BOOKING_CONFLICT',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  INVALID_INPUT: 'INVALID_INPUT',
};

async function callBookingRpc<T>(
  functionName: BookingRpcName,
  args: Record<string, unknown>,
): Promise<T> {
  const client = getSupabaseClient();
  if (!client) throw new AppError('MISSING_CONFIG');

  const { data, error } = await client.rpc(functionName, args);
  if (error) {
    throw new AppError('NETWORK_FAILURE', error.message, {
      rpc: functionName,
      databaseError: error,
    });
  }

  const envelope = data as BookingRpcEnvelope<T> | null;
  if (!envelope || typeof envelope.success !== 'boolean' || typeof envelope.code !== 'string') {
    throw new AppError('UNKNOWN_ERROR', `Unexpected response from ${functionName}.`);
  }

  if (!envelope.success) {
    const code = DATABASE_ERROR_MAP[envelope.code] ?? 'UNKNOWN_ERROR';
    throw new AppError(code, envelope.message || 'The booking operation failed.', {
      databaseCode: envelope.code,
      rpc: functionName,
    });
  }

  if (envelope.data === null || envelope.data === undefined) {
    throw new AppError('UNKNOWN_ERROR', `${functionName} succeeded without returning booking data.`);
  }

  return envelope.data;
}

export function requestBookingRpc(input: {
  resourceId: string; startTime: string; endTime: string; purpose: string;
}): Promise<BookingRpcData> {
  return callBookingRpc<BookingRpcData>('request_booking', {
    p_resource_id: input.resourceId,
    p_start_time: input.startTime,
    p_end_time: input.endTime,
    p_purpose: input.purpose,
  });
}

export function reviewBookingRpc(input: {
  bookingId: string; decision: 'approve' | 'reject' | 'waitlist'; reason?: string | null;
}): Promise<BookingRpcData> {
  return callBookingRpc<BookingRpcData>('review_booking', {
    p_booking_id: input.bookingId,
    p_decision: input.decision,
    p_reason: input.reason ?? null,
  });
}

export function cancelBookingRpc(bookingId: string): Promise<BookingRpcData> {
  return callBookingRpc<BookingRpcData>('cancel_booking', { p_booking_id: bookingId });
}

export function checkInBookingRpc(input: {
  bookingId: string; initialConditionNotes?: string | null;
}): Promise<BookingRpcData> {
  return callBookingRpc<BookingRpcData>('check_in_booking', {
    p_booking_id: input.bookingId,
    p_initial_condition_notes: input.initialConditionNotes ?? null,
  });
}

export function returnBookingRpc(input: {
  bookingId: string; finalConditionNotes?: string | null;
}): Promise<BookingRpcData> {
  return callBookingRpc<BookingRpcData>('return_booking', {
    p_booking_id: input.bookingId,
    p_final_condition_notes: input.finalConditionNotes ?? null,
  });
}
