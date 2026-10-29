
import type {
  Booking,
  BookingRequestInput,
  BookingReviewInput,
  BookingStatus,
  CheckoutInput,
  ReturnInput,
  BookingSummaryStats,
} from '../types/booking';
import type { User } from '../types/auth';
import { mockStore } from './mock/mockStore';
import { isProductionDataMode, mapResourceRow } from './resourceService';
import { getSupabaseClient } from './supabaseClient';
import { AppError } from '../lib/errors';
import {
  cancelBookingRpc,
  checkInBookingRpc,
  requestBookingRpc,
  returnBookingRpc,
  reviewBookingRpc,
} from './bookingRpc';

type DbRecord = Record<string, unknown>;

function asRecord(value: unknown): DbRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as DbRecord
    : null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function mapBookingRow(value: unknown): Booking {
  const row = asRecord(value);
  if (!row) {
    throw new AppError('UNKNOWN_ERROR', 'The database returned an invalid booking record.');
  }

  const resourceId = asString(row.resource_id ?? row.resourceId);
  const createdAt = asString(row.created_at ?? row.createdAt);
  const status = asString(row.status, 'pending') as BookingStatus;
  const resource = mapResourceRow(row.resource);

  return {
    id: asString(row.id),
    resourceId,
    resource,
    requesterId: asString(row.requester_id ?? row.requesterId),
    // The current contract does not guarantee another user's profile details in this query.
    requesterName: asString(asRecord(row.requester)?.display_name, 'Campus member'),
    startTime: asString(row.start_time ?? row.startTime),
    endTime: asString(row.end_time ?? row.endTime),
    status,
    purposeNotes: asString(row.purpose ?? row.purposeNotes) || undefined,
    rejectionReason: asString(row.decision_reason ?? row.rejectionReason) || undefined,
    createdAt,
    updatedAt: asString(row.updated_at ?? row.updatedAt, createdAt),
    checkedOutAt: asString(row.checked_in_at ?? row.checkedOutAt) || undefined,
    returnedAt: asString(row.returned_at ?? row.returnedAt) || undefined,
    // The database report schema has no dedicated grade field; don't fabricate one here.
  };
}

async function reloadBooking(bookingId: string): Promise<Booking> {
  const client = getSupabaseClient();
  if (!client) throw new AppError('MISSING_CONFIG');

  const { data, error } = await client
    .from('bookings')
    .select('*, resource:resources(*)')
    .eq('id', bookingId)
    .single();

  if (error) throw new AppError('NETWORK_FAILURE', error.message);
  return mapBookingRow(data);
}

class BookingService {
  async requestBooking(input: BookingRequestInput, currentUser: User): Promise<Booking> {
    if (isProductionDataMode()) {
      const result = await requestBookingRpc({
        resourceId: input.resourceId,
        startTime: input.startTime,
        endTime: input.endTime,
        purpose: input.purposeNotes,
      });
      return reloadBooking(result.id);
    }

    return mockStore.requestBooking(input, currentUser);
  }

  async listMyBookings(userId: string): Promise<Booking[]> {
    if (isProductionDataMode()) {
      const client = getSupabaseClient();
      if (!client) throw new AppError('MISSING_CONFIG');

      const { data, error } = await client
        .from('bookings')
        .select('*, resource:resources(*)')
        .eq('requester_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw new AppError('NETWORK_FAILURE', error.message);
      return (data ?? []).map(mapBookingRow);
    }

    return mockStore.listMyBookings(userId);
  }

  async getBookingById(bookingId: string): Promise<Booking> {
    if (isProductionDataMode()) return reloadBooking(bookingId);
    return mockStore.getBookingById(bookingId);
  }

  async getBookingSummaryStats(userId: string): Promise<BookingSummaryStats> {
    if (isProductionDataMode()) {
      const bookings = await this.listMyBookings(userId);

      return {
        total: bookings.length,
        pending: bookings.filter((b) => b.status === 'pending').length,
        approved: bookings.filter((b) => b.status === 'approved').length,
        checkedOut: bookings.filter((b) => b.status === 'checked_out').length,
        returned: bookings.filter((b) => b.status === 'returned').length,
        rejected: bookings.filter((b) => b.status === 'rejected').length,
        cancelled: bookings.filter((b) => b.status === 'cancelled').length,
      };
    }

    return mockStore.getBookingSummaryStats(userId);
  }

  async cancelBooking(bookingId: string, userId: string): Promise<Booking> {
    if (isProductionDataMode()) {
      const result = await cancelBookingRpc(bookingId);
      return reloadBooking(result.id);
    }

    return mockStore.cancelBooking(bookingId, userId);
  }
  async listOwnerRequests(ownerId?: string): Promise<Booking[]> {
    if (isProductionDataMode()) {
      // Never fetch owner requests when the authenticated owner ID is missing.
      if (!ownerId) return [];

      const client = getSupabaseClient();
      if (!client) throw new AppError('MISSING_CONFIG');

      const { data, error } = await client
        .from('bookings')
        .select('*, resource:resources!inner(*)')
        .eq('resource.owner_id', ownerId)
        .order('created_at', { ascending: false });

      if (error) throw new AppError('NETWORK_FAILURE', error.message);
      return (data ?? []).map(mapBookingRow);
    }

    return mockStore.listOwnerRequests(ownerId);
  }

  async reviewBooking(input: BookingReviewInput, reviewer: User): Promise<Booking> {
    if (isProductionDataMode()) {
      const result = await reviewBookingRpc({
        bookingId: input.bookingId,
        decision: input.decision,
        reason: input.rejectionReason ?? null,
      });
      return reloadBooking(result.id);
    }

    return mockStore.reviewBooking(input, reviewer);
  }

  async checkOutBooking(input: CheckoutInput, inspector: User): Promise<Booking> {
    if (isProductionDataMode()) {
      // The database stores condition notes, not a dedicated grade field.
      const result = await checkInBookingRpc({
        bookingId: input.bookingId,
        initialConditionNotes: `Inspection grade: ${input.grade}\n${input.notes}`,
      });
      return reloadBooking(result.id);
    }

    return mockStore.checkOutBooking(input, inspector);
  }

  async returnBooking(input: ReturnInput, inspector: User): Promise<Booking> {
    if (isProductionDataMode()) {
      // The database stores condition notes, not a dedicated grade field.
      const result = await returnBookingRpc({
        bookingId: input.bookingId,
        finalConditionNotes: `Inspection grade: ${input.grade}\n${input.notes}`,
      });
      return reloadBooking(result.id);
    }

    return mockStore.returnBooking(input, inspector);
  }
}

export const bookingService = new BookingService();
