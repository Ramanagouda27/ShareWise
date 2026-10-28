import { Resource, ResourceFilters } from '../../types/resource';
import {
  Booking,
  BookingRequestInput,
  BookingReviewInput,
  CheckoutInput,
  ReturnInput,
  BookingSummaryStats,
} from '../../types/booking';
import { ConditionReport } from '../../types/conditionReport';
import { INITIAL_MOCK_RESOURCES } from '../../mocks/resources';
import { INITIAL_MOCK_BOOKINGS } from '../../mocks/bookings';
import { AppError } from '../../lib/errors';
import { User } from '../../types/auth';

const STORAGE_KEY_RESOURCES = 'sharewise_mock_resources_v1';
const STORAGE_KEY_BOOKINGS = 'sharewise_mock_bookings_v1';

export const CURRENT_MOCK_STUDENT: User = {
  id: 'user-student-1',
  email: 'alex.mercer@campus.edu',
  fullName: 'Alex Mercer',
  role: 'student',
  studentId: 'STU-2024-8831',
  department: 'Robotics Engineering',
  collegeName: 'Campus Institute of Technology',
};

export const CURRENT_MOCK_OWNER: User = {
  id: 'owner-ece-1',
  email: 'david.vance@campus.edu',
  fullName: 'Prof. David Vance',
  role: 'owner',
  department: 'Electrical & Computer Engineering',
  collegeName: 'Campus Institute of Technology',
};

class MockDataStore {
  private resources: Resource[] = [];
  private bookings: Booking[] = [];

  constructor() {
    this.init();
  }

  private init() {
    try {
      const storedRes = localStorage.getItem(STORAGE_KEY_RESOURCES);
      const storedBook = localStorage.getItem(STORAGE_KEY_BOOKINGS);

      this.resources = storedRes ? JSON.parse(storedRes) : [...INITIAL_MOCK_RESOURCES];
      this.bookings = storedBook ? JSON.parse(storedBook) : [...INITIAL_MOCK_BOOKINGS];
    } catch {
      this.resources = [...INITIAL_MOCK_RESOURCES];
      this.bookings = [...INITIAL_MOCK_BOOKINGS];
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY_RESOURCES, JSON.stringify(this.resources));
      localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(this.bookings));
    } catch {
      // storage unavailable or full
    }
  }

  public resetToDefault() {
    this.resources = [...INITIAL_MOCK_RESOURCES];
    this.bookings = [...INITIAL_MOCK_BOOKINGS];
    this.persist();
  }

  private async delay(ms = 250): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // --- Resource Operations ---
  async listResources(filters?: ResourceFilters): Promise<Resource[]> {
    await this.delay();
    let result = [...this.resources];

    if (filters?.query) {
      const q = filters.query.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.location.toLowerCase().includes(q) ||
          r.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (filters?.category && filters.category !== 'All') {
      result = result.filter((r) => r.category === filters.category);
    }

    if (filters?.location && filters.location !== 'All') {
      result = result.filter((r) => r.location.toLowerCase().includes(filters.location!.toLowerCase()));
    }

    if (filters?.availableOnly) {
      result = result.filter((r) => r.availability.isAvailable);
    }

    return result;
  }

  async getResourceById(id: string): Promise<Resource> {
    await this.delay();
    const found = this.resources.find((r) => r.id === id);
    if (!found) {
      throw new AppError('RESOURCE_UNAVAILABLE', `Resource with ID "${id}" was not found.`);
    }
    return found;
  }

  // --- Booking Operations ---
  async requestBooking(input: BookingRequestInput, currentUser: User): Promise<Booking> {
    await this.delay();
    const resource = this.resources.find((r) => r.id === input.resourceId);
    if (!resource) {
      throw new AppError('RESOURCE_UNAVAILABLE', 'The requested resource does not exist.');
    }

    const start = new Date(input.startTime);
    const end = new Date(input.endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      throw new AppError('INVALID_TIME_RANGE', 'Booking end time must be at least 30 minutes after start time.');
    }

    // Check for explicit conflicting approved/checked_out bookings on this exact resource
    const hasConflict = this.bookings.some((b) => {
      if (b.resourceId !== input.resourceId) return false;
      if (b.status !== 'approved' && b.status !== 'checked_out') return false;
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      return start < bEnd && end > bStart;
    });

    if (hasConflict && resource.availability.availableQuantity <= 1) {
      throw new AppError(
        'BOOKING_CONFLICT',
        'This equipment already has an approved reservation during this time window. Please choose another time.'
      );
    }

    const newBooking: Booking = {
      id: `book-${Date.now()}`,
      resourceId: resource.id,
      resource,
      requesterId: currentUser.id,
      requesterName: currentUser.fullName,
      requesterEmail: currentUser.email,
      requesterDepartment: currentUser.department || 'Engineering',
      requesterStudentId: currentUser.studentId || 'STU-2024-DEMO',
      startTime: input.startTime,
      endTime: input.endTime,
      status: 'pending',
      purposeNotes: input.purposeNotes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      conditionReports: [],
    };

    this.bookings.unshift(newBooking);
    this.persist();
    return newBooking;
  }

  async listMyBookings(userId: string): Promise<Booking[]> {
    await this.delay();
    return this.bookings.filter((b) => b.requesterId === userId);
  }

  async getBookingById(bookingId: string): Promise<Booking> {
    await this.delay();
    const found = this.bookings.find((b) => b.id === bookingId);
    if (!found) {
      throw new AppError('NOT_AUTHORIZED', `Booking with ID "${bookingId}" was not found.`);
    }
    return found;
  }

  async getBookingSummaryStats(userId: string): Promise<BookingSummaryStats> {
    await this.delay(100);
    const userBookings = this.bookings.filter((b) => b.requesterId === userId);
    return {
      total: userBookings.length,
      pending: userBookings.filter((b) => b.status === 'pending').length,
      approved: userBookings.filter((b) => b.status === 'approved').length,
      checkedOut: userBookings.filter((b) => b.status === 'checked_out').length,
      returned: userBookings.filter((b) => b.status === 'returned').length,
      rejected: userBookings.filter((b) => b.status === 'rejected').length,
      cancelled: userBookings.filter((b) => b.status === 'cancelled').length,
    };
  }

  async cancelBooking(bookingId: string, userId: string): Promise<Booking> {
    await this.delay();
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      throw new AppError('NOT_AUTHORIZED', 'Booking not found.');
    }
    if (booking.requesterId !== userId) {
      throw new AppError('NOT_AUTHORIZED', 'You are not authorized to cancel this booking.');
    }
    if (booking.status === 'checked_out' || booking.status === 'returned') {
      throw new AppError('INVALID_STATUS_TRANSITION', 'Cannot cancel an active or completed checkout.');
    }

    booking.status = 'cancelled';
    booking.updatedAt = new Date().toISOString();
    this.persist();
    return booking;
  }

  // --- Owner Operations ---
  async listOwnerRequests(ownerId?: string): Promise<Booking[]> {
    await this.delay();
    if (!ownerId) {
      return [...this.bookings];
    }
    // Filter bookings where the resource belongs to ownerId, or all if demo
    return this.bookings.filter(
      (b) => b.resource?.ownerId === ownerId || b.resource?.owner?.id === ownerId || ownerId === 'owner-ece-1'
    );
  }

  async reviewBooking(input: BookingReviewInput, reviewer: User): Promise<Booking> {
    await this.delay();
    const booking = this.bookings.find((b) => b.id === input.bookingId);
    if (!booking) {
      throw new AppError('RESOURCE_UNAVAILABLE', 'Booking record not found.');
    }
    if (booking.status !== 'pending' && booking.status !== 'waitlisted') {
      throw new AppError('INVALID_STATUS_TRANSITION', `Cannot review a booking that is currently ${booking.status}.`);
    }

    if (input.decision === 'approve') {
      booking.status = 'approved';
      booking.ownerNotes = `Approved by ${reviewer.fullName}`;
    } else {
      booking.status = 'rejected';
      booking.rejectionReason = input.rejectionReason || 'Equipment is reserved for institutional lab maintenance.';
    }
    booking.updatedAt = new Date().toISOString();
    this.persist();
    return booking;
  }

  async checkOutBooking(input: CheckoutInput, inspector: User): Promise<Booking> {
    await this.delay();
    const booking = this.bookings.find((b) => b.id === input.bookingId);
    if (!booking) {
      throw new AppError('RESOURCE_UNAVAILABLE', 'Booking not found.');
    }
    if (booking.status !== 'approved') {
      throw new AppError('INVALID_STATUS_TRANSITION', 'Booking must be approved before equipment checkout.');
    }

    const report: ConditionReport = {
      id: `rep-chk-${Date.now()}`,
      bookingId: booking.id,
      resourceId: booking.resourceId,
      inspectorId: inspector.id,
      inspectorName: inspector.fullName,
      stage: 'checkout',
      grade: input.grade,
      notes: input.notes,
      createdAt: new Date().toISOString(),
    };

    booking.status = 'checked_out';
    booking.checkedOutAt = new Date().toISOString();
    booking.updatedAt = new Date().toISOString();
    booking.conditionReports = [...(booking.conditionReports || []), report];

    this.persist();
    return booking;
  }

  async returnBooking(input: ReturnInput, inspector: User): Promise<Booking> {
    await this.delay();
    const booking = this.bookings.find((b) => b.id === input.bookingId);
    if (!booking) {
      throw new AppError('RESOURCE_UNAVAILABLE', 'Booking not found.');
    }
    if (booking.status !== 'checked_out') {
      throw new AppError('INVALID_STATUS_TRANSITION', 'Booking must be in checked_out state to process return.');
    }

    const report: ConditionReport = {
      id: `rep-ret-${Date.now()}`,
      bookingId: booking.id,
      resourceId: booking.resourceId,
      inspectorId: inspector.id,
      inspectorName: inspector.fullName,
      stage: 'return',
      grade: input.grade,
      notes: input.notes,
      createdAt: new Date().toISOString(),
    };

    booking.status = 'returned';
    booking.returnedAt = new Date().toISOString();
    booking.updatedAt = new Date().toISOString();
    booking.conditionReports = [...(booking.conditionReports || []), report];

    this.persist();
    return booking;
  }

  async createConditionReport(report: Omit<ConditionReport, 'id' | 'createdAt'>): Promise<ConditionReport> {
    await this.delay();
    const fullReport: ConditionReport = {
      ...report,
      id: `rep-custom-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    const booking = this.bookings.find((b) => b.id === report.bookingId);
    if (booking) {
      booking.conditionReports = [...(booking.conditionReports || []), fullReport];
      this.persist();
    }

    return fullReport;
  }
}

export const mockStore = new MockDataStore();
