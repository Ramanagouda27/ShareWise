
import type { BookingStatus } from './rules'

export interface BookingRequestInput {
  resourceId: string
  startTime: string
  endTime: string
  purpose: string
}

export interface Booking {
  id: string
  resourceId: string
  requesterId: string
  startTime: string
  endTime: string
  purpose: string
  status: BookingStatus
  createdAt: string
}

export type BookingRpcErrorCode =
  | 'UNAUTHENTICATED'
  | 'NOT_AUTHORISED'
  | 'RESOURCE_UNAVAILABLE'
  | 'INELIGIBLE'
  | 'INVALID_TIME_RANGE'
  | 'BOOKING_CONFLICT'
  | 'INVALID_STATUS_TRANSITION'

export type BookingRpcResponse<T> =
  | {
      success: true
      code: 'OK'
      message: string
      data: T
    }
  | {
      success: false
      code: BookingRpcErrorCode
      message: string
      data: null
    }

export type BookingErrorCode =
  | BookingRpcErrorCode
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR'

export interface BookingError {
  code: BookingErrorCode
  message: string
}

export type BookingResult<T> =
  | { success: true; data: T }
  | { success: false; error: BookingError }
