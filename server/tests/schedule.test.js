import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import DateFrequencyEngine from '../services/dateFrequencyEngine.js';

describe('Date & Frequency Scheduling Engine (Section 10 & 40)', () => {
  it('should project 21-day recurrence dates accurately', () => {
    // Sept 1 base date -> 22 Sept -> 13 Oct -> 3 Nov
    const visits = DateFrequencyEngine.generateFutureVisits('2026-09-01', 21, 3);
    assert.equal(visits.length, 3);
    assert.equal(visits[0].plannedDate, '2026-09-22');
    assert.equal(visits[1].plannedDate, '2026-10-13');
    assert.equal(visits[2].plannedDate, '2026-11-03');
  });

  it('should accurately categorize visit statuses', () => {
    const today = '2026-09-20';

    // Overdue: planned date was 3 days ago
    assert.equal(DateFrequencyEngine.getVisitStatus('2026-09-17', null, today), 'overdue');

    // Due Today: planned date is today
    assert.equal(DateFrequencyEngine.getVisitStatus('2026-09-20', null, today), 'due_today');

    // Due This Week: planned date is in 3 days
    assert.equal(DateFrequencyEngine.getVisitStatus('2026-09-23', null, today), 'due_this_week');

    // Upcoming: planned date is in 20 days
    assert.equal(DateFrequencyEngine.getVisitStatus('2026-10-10', null, today), 'upcoming');

    // Completed: actual visit date logged
    assert.equal(DateFrequencyEngine.getVisitStatus('2026-09-17', '2026-09-17', today), 'completed');
  });
});
