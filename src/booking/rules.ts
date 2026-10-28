
export type BookingStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'waitlisted'
  | 'checked_out'
  | 'returned'
  | 'cancelled'
  | 'overdue'

export type BookingAction =
  | 'approve'
  | 'reject'
  | 'waitlist'
  | 'cancel'
  | 'check_out'
  | 'return'

const allowedTransitions: Record<
  BookingStatus,
  Partial<Record<BookingAction, BookingStatus>>
> = {
  pending: {
    approve: 'approved',
    reject: 'rejected',
    waitlist: 'waitlisted',
    cancel: 'cancelled',
  },
  approved: {
    cancel: 'cancelled',
    check_out: 'checked_out',
  },
  rejected: {},
  waitlisted: {
    approve: 'approved',
    cancel: 'cancelled',
  },
  checked_out: {
    return: 'returned',
  },
  returned: {},
  cancelled: {},
  overdue: {
    return: 'returned',
  },
}

export function validateTimeRange(
  startTime: string,
  endTime: string,
): { valid: boolean; error?: string } {
  const start = Date.parse(startTime)
  const end = Date.parse(endTime)

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { valid: false, error: 'INVALID_TIME_FORMAT' }
  }

  if (start <= Date.now()) {
    return { valid: false, error: 'START_TIME_MUST_BE_IN_FUTURE' }
  }

  if (end <= start) {
    return { valid: false, error: 'INVALID_TIME_RANGE' }
  }

  return { valid: true }
}

export function getNextBookingStatus(
  currentStatus: BookingStatus,
  action: BookingAction,
): BookingStatus {
  const nextStatus = allowedTransitions[currentStatus][action]

  if (!nextStatus) {
    throw new Error(
      `INVALID_STATUS_TRANSITION: ${currentStatus} cannot ${action}`,
    )
  }

  return nextStatus
}

export function hasTimeConflict(
  requestedStart: number,
  requestedEnd: number,
  existingStart: number,
  existingEnd: number,
): boolean {
  const timestamps = [
    requestedStart,
    requestedEnd,
    existingStart,
    existingEnd,
  ]

  if (!timestamps.every(Number.isFinite)) {
    throw new Error('INVALID_TIME_RANGE: timestamps must be finite numbers')
  }

  if (
    requestedEnd <= requestedStart ||
    existingEnd <= existingStart
  ) {
    throw new Error('INVALID_TIME_RANGE: interval end must follow start')
  }

  return requestedStart < existingEnd && existingStart < requestedEnd
}
