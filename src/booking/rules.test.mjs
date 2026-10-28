
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateTimeRange,
  getNextBookingStatus,
  hasTimeConflict,
} from './rules.ts'

test('rejects an invalid time range', () => {
  const result = validateTimeRange(
    '2026-10-30T14:00:00+05:30',
    '2026-10-30T13:00:00+05:30',
  )

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
