import { env } from './env.js';

export const fareConfig = {
  incompleteJourneyPenaltyPence: 500,
  dailyCapPence: 1500,
  get maxJourneyDurationHours() {
    return env.MAX_JOURNEY_DURATION_HOURS;
  },
};
