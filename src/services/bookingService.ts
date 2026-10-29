
import {
  Booking,
  BookingRequestInput,
  BookingReviewInput,
  CheckoutInput,
  ReturnInput,
  BookingSummaryStats,
  BookingStatus,
} from '../types/booking';
import { User } from '../types/auth';
import { Resource, ResourceCategory } from '../types/resource';
import { ConditionReport } from '../types/conditionReport';
import { mockStore } from './mock/mockStore';
import { isProductionDataMode } from './resourceService';
import { getSupabaseClient } from './supabaseClient';
import { AppError } from '../lib/errors';

type BookingRpcData = {
  id: string;
  resourceId: string;
  requesterId: string;
  startTime: string;
  endTime: string;
  purpose: string;
  status: string;
  createdAt: string;
};

type BookingRpcEnvelope = {
  success: boolean;
  code: string;
  message: string;
  data: BookingRpcData | null;
};

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

type DbRecord = Record<string, unknown>;

const BOOKING_RPC_NAMES = [
  'request_booking',
  'review_booking',
  'cancel_booking',
  'check_in_booking',
  'return_booking',
] as const;

type BookingRpcName = (typeof BOOKING_RPC_NAMES)[number];

const isRecord = (value: unknown): value is DbRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const nullableString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const asRecords = (value: unknown): DbRecord[] => {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  return isRecord(value) ? [value] : [];
};

const mapRpcError = (code: string, message: string): AppError => {
  switch (code) {
    case 'UNAUTHENTICATED':
      return new AppError('AUTH_REQUIRED', message);
    case 'NOT_AUTHORISED':
      return new AppError('NOT_AUTHORIZED', message);
    case 'RESOURCE_UNAVAILABLE':
      return new AppError('RESOURCE_UNAVAILABLE', message);
    case 'INELIGIBLE':
      return new AppError('ELIGIBILITY_FAILED', message);
    case 'INVALID_TIME_RANGE':
      return new AppError('INVALID_TIME_RANGE', message);
    case 'BOOKING_CONFLICT':
      return new AppError('BOOKING_CONFLICT', message);
    case 'INVALID_STATUS_TRANSITION':
      return new AppError('INVALID_STATUS_TRANSITION', message);
    default:
      return new AppError('NETWORK_FAILURE', `${code}: ${message}`);
  }
};

const parseBookingRpcResponse = (
  data: unknown,
  rpcName: BookingRpcName,
): BookingRpcData => {
  if (!isRecord(data)) {
    throw new AppError(
      'NETWORK_FAILURE',
      `Invalid response received from ${rpcName}.`,
    );
  }

  if (
    typeof data.success !== 'boolean' ||
    typeof data.code !== 'string' ||
    typeof data.message !== 'string' ||
    !('data' in data)
  ) {
    throw new AppError(
      'NETWORK_FAILURE',
      `The ${rpcName} response has an invalid format.`,
    );
  }

  const envelope = data as unknown as BookingRpcEnvelope;

  if (!envelope.success) {
    throw mapRpcError(envelope.code, envelope.message);
  }

  const result = envelope.data;

  if (
    !result ||
    typeof result.id !== 'string' ||
    typeof result.resourceId !== 'string' ||
    typeof result.requesterId !== 'string' ||
    typeof result.startTime !== 'string' ||
    typeof result.endTime !== 'string' ||
    typeof result.purpose !== 'string' ||
    typeof result.status !== 'string' ||
    typeof result.createdAt !== 'string'
  ) {
    throw new AppError(
      'NETWORK_FAILURE',
      `The ${rpcName} response did not contain valid booking data.`,
    );
  }

  return result;
};

const callBookingRpc = async (
  rpcName: BookingRpcName,
  args: Record<string, unknown>,
): Promise<BookingRpcData> => {
  const client = getSupabaseClient();

  if (!client) {
    throw new AppError('MISSING_CONFIG');
  }

  const rpcClient = client as unknown as {
    rpc: (
      name: string,
      parameters: Record<string, unknown>,
    ) => Promise<RpcResult>;
  };

  const { data, error } = await rpcClient.rpc(rpcName, args);

  if (error) {
    throw new AppError('NETWORK_FAILURE', error.message);
  }

  return parseBookingRpcResponse(data, rpcName);
};

const mapResource = (value: unknown): Resource | undefined => {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return undefined;
  }

  const status = asString(value.status);

  const imagePath = nullableString(value.image_path);
  const imageUrl =
    imagePath && /^https?:\/\//i.test(imagePath)
      ? imagePath
      : undefined;

  const requiredTraining = nullableString(value.required_training);
  const usageRules = nullableString(value.usage_rules);
  const maxBookingMinutes = value.max_booking_minutes;

  const specifications: Record<string, string> = {};

  if (usageRules) {
    specifications.usageRules = usageRules;
  }

  if (requiredTraining) {
    specifications.requiredTraining = requiredTraining;
  }

  if (typeof maxBookingMinutes === 'number') {
    specifications.maxBookingMinutes = String(maxBookingMinutes);
  }

  return {
    id: value.id,
    title: asString(value.name, 'Untitled resource'),
    description: asString(value.description),
    category: asString(value.category) as ResourceCategory,
    location: asString(value.location),
    ownerId: asString(value.owner_id),
    ...(imageUrl ? { imageUrl } : {}),
    availability: {
      isAvailable: status === 'active',
    },
    ...(requiredTraining
      ? { eligibilityRequirements: [requiredTraining] }
      : {}),
    ...(Object.keys(specifications).length > 0
      ? { specifications }
      : {}),
    createdAt: asString(value.created_at) || undefined,
  };
};

const mapConditionReport = (
  value: unknown,
): ConditionReport | undefined => {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.booking_id !== 'string' ||
    typeof value.reporter_id !== 'string'
  ) {
    return undefined;
  }

  const reportType = value.report_type;

  if (reportType !== 'initial' && reportType !== 'final') {
    return undefined;
  }

  return {
    id: value.id,
    bookingId: value.booking_id,
    resourceId: '',
    inspectorId: value.reporter_id,
    stage: reportType === 'initial' ? 'checkout' : 'return',
    notes: asString(value.notes),
    createdAt: asString(value.created_at),
  };
};

const mapBooking = (value: unknown): Booking => {
  if (!isRecord(value) || typeof value.id !== 'string') {
    throw new AppError(
      'NETWORK_FAILURE',
      'The database returned an invalid booking record.',
    );
  }

  const status = asString(value.status);

  const validStatuses: BookingStatus[] = [
    'pending',
    'approved',
    'rejected',
    'waitlisted',
    'checked_out',
    'returned',
    'cancelled',
    'overdue',
  ];

  if (!validStatuses.includes(status as BookingStatus)) {
    throw new AppError(
      'NETWORK_FAILURE',
      `Unknown booking status received: ${status || '(empty)'}.`,
    );
  }

  const resource = mapResource(value.resource);

  const conditionReports = asRecords(value.condition_reports)
    .map(mapConditionReport)
    .filter(
      (report): report is ConditionReport => report !== undefined,
    )
    .map((report) => ({
      ...report,
      resourceId: asString(value.resource_id),
    }));

  return {
    id: value.id,
    resourceId: asString(value.resource_id),
    ...(resource ? { resource } : {}),
    requesterId: asString(value.requester_id),
    // The current schema does not expose another user's display name
    // through the profile's own-row SELECT policy.
    requesterName: 'Requester',
    startTime: asString(value.start_time),
    endTime: asString(value.end_time),
    status: status as BookingStatus,
    purposeNotes: asString(value.purpose) || undefined,
    rejectionReason: nullableString(value.decision_reason),
    createdAt: asString(value.created_at),
    updatedAt: asString(value.updated_at, asString(value.created_at)),
    conditionReports,
    ...(nullableString(value.checked_in_at)
      ? { checkedOutAt: asString(value.checked_in_at) }
      : {}),
    ...(nullableString(value.returned_at)
      ? { returnedAt: asString(value.returned_at) }
      : {}),
  };
};

const BOOKING_SELECT =
  '*, resource:resources(*), condition_reports(*)';

class BookingService {
  async requestBooking(
    input: BookingRequestInput,
    currentUser: User,
  ): Promise<Booking> {
    if (isProductionDataMode()) {
      const result = await callBookingRpc('request_booking', {
        p_resource_id: input.resourceId,
        p_start_time: input.startTime,
        p_end_time: input.endTime,
        p_purpose: input.purposeNotes,
      });

      return this.getBookingById(result.id);
    }

    return mockStore.requestBooking(input, currentUser);
  }

  async listMyBookings(userId: string): Promise<Booking[]> {
    if (isProductionDataMode()) {
      const client = getSupabaseClient();
      if (!client) throw new AppError('MISSING_CONFIG');

      const { data, error } = await client
        .from('bookings')
        .select(BOOKING_SELECT)
        .eq('requester_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new AppError('NETWORK_FAILURE', error.message);
      }

      return (data ?? []).map(mapBooking);
    }

    return mockStore.listMyBookings(userId);
  }

  async getBookingById(bookingId: string): Promise<Booking> {
    if (isProductionDataMode()) {
      const client = getSupabaseClient();
      if (!client) throw new AppError('MISSING_CONFIG');

      const { data, error } = await client
        .from('bookings')
        .select(BOOKING_SELECT)
        .eq('id', bookingId)
        .single();

      if (error) {
        throw new AppError('RESOURCE_UNAVAILABLE', error.message);
      }

      return mapBooking(data);
    }

    return mockStore.getBookingById(bookingId);
  }

  async getBookingSummaryStats(
    userId: string,
  ): Promise<BookingSummaryStats> {
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

  async cancelBooking(
    bookingId: string,
    userId: string,
  ): Promise<Booking> {
    if (isProductionDataMode()) {
      // The RPC enforces permissions. Retain userId for caller compatibility.
      void userId;

      const result = await callBookingRpc('cancel_booking', {
        p_booking_id: bookingId,
      });

      return this.getBookingById(result.id);
    }

    return mockStore.cancelBooking(bookingId, userId);
  }

  async listOwnerRequests(ownerId?: string): Promise<Booking[]> {
    if (isProductionDataMode()) {
      const client = getSupabaseClient();
      if (!client) throw new AppError('MISSING_CONFIG');

      let query = client
        .from('bookings')
        .select('*, resource:resources!inner(*), condition_reports(*)')
        .order('created_at', { ascending: false });

      if (ownerId) {
        query = query.eq('resource.owner_id', ownerId);
      }

      const { data, error } = await query;

      if (error) {
        throw new AppError('NETWORK_FAILURE', error.message);
      }

      return (data ?? []).map(mapBooking);
    }

    return mockStore.listOwnerRequests(ownerId);
  }

  async reviewBooking(
    input: BookingReviewInput,
    reviewer: User,
  ): Promise<Booking> {
    if (isProductionDataMode()) {
      // Authorization is enforced by the database RPC, not this argument.
      void reviewer;

      const result = await callBookingRpc('review_booking', {
        p_booking_id: input.bookingId,
        p_decision: input.decision,
        p_reason: input.rejectionReason ?? null,
      });

      return this.getBookingById(result.id);
    }

    return mockStore.reviewBooking(input, reviewer);
  }

  async checkOutBooking(
    input: CheckoutInput,
    inspector: User,
  ): Promise<Booking> {
    if (isProductionDataMode()) {
      // The RPC creates the initial condition report. Grades are not stored.
      void inspector;
      void input.grade;

      const result = await callBookingRpc('check_in_booking', {
        p_booking_id: input.bookingId,
        p_initial_condition_notes: input.notes || null,
      });

      return this.getBookingById(result.id);
    }

    return mockStore.checkOutBooking(input, inspector);
  }

  async returnBooking(
    input: ReturnInput,
    inspector: User,
  ): Promise<Booking> {
    if (isProductionDataMode()) {
      // The RPC creates the final condition report. Grades are not stored.
      void inspector;
      void input.grade;

      const result = await callBookingRpc('return_booking', {
        p_booking_id: input.bookingId,
        p_final_condition_notes: input.notes || null,
      });

      return this.getBookingById(result.id);
    }

    return mockStore.returnBooking(input, inspector);
  }
}

export const bookingService = new BookingService();
