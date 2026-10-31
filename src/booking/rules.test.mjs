
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateTimeRange,
  getNextBookingStatus,
  hasTimeConflict,
} from './rules.ts'

test('rejects an invalid time range', () => {
  // Keep both timestamps in the future so this test remains deterministic
  // even when the calendar date changes.
  const startTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  const endTime = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  const result = validateTimeRange(startTime, endTime)

  assert.equal(result.valid, false)
  assert.equal(result.error, 'INVALID_TIME_RANGE')
})

test('allows pending booking approval', () => {
  assert.equal(
    getNextBookingStatus('pending', 'approve'),
    'approved',
  )
})

test('rejects an invalid status transition', () => {
  assert.throws(
    () => getNextBookingStatus('pending', 'return'),
    /INVALID_STATUS_TRANSITION/,
  )
})

test('detects overlapping bookings', () => {
  assert.equal(
    hasTimeConflict(10, 12, 11, 13),
    true,
  )
})

test('allows back-to-back bookings', () => {
  assert.equal(
    hasTimeConflict(10, 12, 12, 14),
    false,
  )
})

test('rejects an invalid timestamp', () => {
  const result = validateTimeRange(
    'not-a-date',
    '2026-10-30T15:00:00+05:30',
  )

  assert.equal(result.valid, false)
  assert.equal(result.error, 'INVALID_TIME_FORMAT')
})

test('rejects a start time in the past', () => {
  const result = validateTimeRange(
    '2020-01-01T10:00:00+05:30',
    '2020-01-01T11:00:00+05:30',
  )

  assert.equal(result.valid, false)
  assert.equal(result.error, 'START_TIME_MUST_BE_IN_FUTURE')
})

test('rejects returning a booking that is still pending', () => {
  assert.throws(
    () => getNextBookingStatus('pending', 'return'),
    /INVALID_STATUS_TRANSITION/,
  )
})

test('supports all permitted booking status transitions', () => {
  const cases = [
    ['pending', 'approve', 'approved'],
    ['pending', 'reject', 'rejected'],
    ['pending', 'waitlist', 'waitlisted'],
    ['pending', 'cancel', 'cancelled'],
    ['approved', 'cancel', 'cancelled'],
    ['approved', 'check_out', 'checked_out'],
    ['waitlisted', 'approve', 'approved'],
    ['waitlisted', 'cancel', 'cancelled'],
    ['checked_out', 'return', 'returned'],
    ['overdue', 'return', 'returned'],
  ]

  for (const [current, action, expected] of cases) {
    assert.equal(
      getNextBookingStatus(current, action),
      expected,
      `${current} + ${action} should become ${expected}`,
    )
  }
})
