
import type {
  BookingRequestInput,
  BookingResult,
  Booking,
} from './types'

/**
 * Contract for booking operations.
 *
 * A future Supabase implementation will call the confirmed
 * database RPCs. This interface does not access the database.
 */
export interface BookingService {
  requestBooking(
    input: BookingRequestInput,
  ): Promise<BookingResult<Booking>>

  getMyBookings(): Promise<BookingResult<Booking[]>>
}
