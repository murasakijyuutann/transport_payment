export type JourneyStatus =
  | 'OPEN'
  | 'COMPLETED'
  | 'INCOMPLETE_ENTRY'
  | 'INCOMPLETE_EXIT'
  | 'EXPIRED'
  | 'CORRECTED';

export type JourneyEvent =
  | { type: 'ENTRY_ACCEPTED' }
  | { type: 'EXIT_ACCEPTED' }
  | { type: 'EXPIRE' };

export function nextJourneyStatus(
  current: JourneyStatus | null,
  event: JourneyEvent,
): JourneyStatus {
  if (current === null && event.type === 'ENTRY_ACCEPTED') return 'OPEN';
  if (current === 'OPEN' && event.type === 'EXIT_ACCEPTED') return 'COMPLETED';
  if (current === 'OPEN' && event.type === 'EXPIRE') return 'INCOMPLETE_ENTRY';
  throw new Error(`Invalid transition: ${current} + ${event.type}`);
}
