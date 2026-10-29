import {
  Booking,
  BookingRequestInput,
  BookingReviewInput,
  CheckoutInput,
  ReturnInput,
  BookingSummaryStats,
} from '../types/booking';
import { User } from '../types/auth';
import { mockStore } from './mock/mockStore';
import { isProductionDataMode } from './resourceService';
import { getSupabaseClient } from './supabaseClient';
import { AppError } from '../lib/errors';

class BookingService {
  async requestBooking(input: BookingRequestInput, currentUser: User): Promise<Booking> {
    if (isProductionDataMode()) {
      const client = getSupabaseClient();
      if (!client) throw new AppError('MISSING_CONFIG');

      const { data, error } = await client
        .from('bookings')
        .insert({
          resource_id: input.resourceId,
          requester_id: currentUser.id,
          start_time: input.startTime,
          end_time: input.endTime,
          purpose_notes: input.purposeNotes,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        throw new AppError('BOOKING_CONFLICT', error.message);
      }
      return data as Booking;
    }

    // Mock Adapter
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

      if (error) {
        throw new AppError('NETWORK_FAILURE', error.message);
      }
      return (data as Booking[]) || [];
    }

    return mockStore.listMyBookings(userId);
  }

  async getBookingById(bookingId: string): Promise<Booking> {
    if (isProductionDataMode()) {
      const client = getSupabaseClient();
      if (!client) throw new AppError('MISSING_CONFIG');

      const { data, error } = await client
        .from('bookings')
        .select('*, resource:resources(*), condition_reports(*)')
        .eq('id', bookingId)
        .single();

      if (error) {
        throw new AppError('RESOURCE_UNAVAILABLE', error.message);
      }
      return data as Booking;
    }

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
      const client = getSupabaseClient();
      if (!client) throw new AppError('MISSING_CONFIG');

      const { data, error } = await client
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId)
        .eq('requester_id', userId)
        .select()
        .single();

      if (error) {
        throw new AppError('INVALID_STATUS_TRANSITION', error.message);
      }
      return data as Booking;
    }

    return mockStore.cancelBooking(bookingId, userId);
  }

  async listOwnerRequests(ownerId?: string): Promise<Booking[]> {
    if (isProductionDataMode()) {
      const client = getSupabaseClient();
      if (!client) throw new AppError('MISSING_CONFIG');

      const { data, error } = await client
        .from('bookings')
        .select('*, resource:resources(*)')
        .order('created_at', { ascending: false });

      if (error) {
        throw new AppError('NETWORK_FAILURE', error.message);
      }
      return (data as Booking[]) || [];
    }

    return mockStore.listOwnerRequests(ownerId);
  }

  async reviewBooking(input: BookingReviewInput, reviewer: User): Promise<Booking> {
    if (isProductionDataMode()) {
      const client = getSupabaseClient();
      if (!client) throw new AppError('MISSING_CONFIG');

      const newStatus = input.decision === 'approve' ? 'approved' : 'rejected';
      const { data, error } = await client
        .from('bookings')
        .update({
          status: newStatus,
          rejection_reason: input.rejectionReason,
        })
        .eq('id', input.bookingId)
        .select()
        .single();

      if (error) {
        throw new AppError('INVALID_STATUS_TRANSITION', error.message);
      }
      return data as Booking;
    }

    return mockStore.reviewBooking(input, reviewer);
  }

  async checkOutBooking(input: CheckoutInput, inspector: User): Promise<Booking> {
    if (isProductionDataMode()) {
      const client = getSupabaseClient();
      if (!client) throw new AppError('MISSING_CONFIG');

      const { data, error } = await client
        .from('bookings')
        .update({
          status: 'checked_out',
          checked_out_at: new Date().toISOString(),
        })
        .eq('id', input.bookingId)
        .select()
        .single();

      if (error) {
        throw new AppError('INVALID_STATUS_TRANSITION', error.message);
      }
      return data as Booking;
    }

    return mockStore.checkOutBooking(input, inspector);
  }

  async returnBooking(input: ReturnInput, inspector: User): Promise<Booking> {
    if (isProductionDataMode()) {
      const client = getSupabaseClient();
      if (!client) throw new AppError('MISSING_CONFIG');

      const { data, error } = await client
        .from('bookings')
        .update({
          status: 'returned',
          returned_at: new Date().toISOString(),
        })
        .eq('id', input.bookingId)
        .select()
        .single();

      if (error) {
        throw new AppError('INVALID_STATUS_TRANSITION', error.message);
      }
      return data as Booking;
    }

    return mockStore.returnBooking(input, inspector);
  }
}

export const bookingService = new BookingService();
