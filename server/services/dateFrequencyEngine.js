/**
 * Date & Frequency Scheduling Engine
 * Handles cyclic route visits, recurring shop delivery intervals, and status categorizations.
 */

export const DateFrequencyEngine = {
  FREQUENCY_MAPPING: {
    'Daily': 1,
    'Weekly': 7,
    'Biweekly': 14,
    'Every 3 weeks': 21,
    'Monthly': 30
  },

  getFrequencyDays(frequencyStr, customDays = null) {
    if (customDays && Number(customDays) > 0) return Number(customDays);
    return this.FREQUENCY_MAPPING[frequencyStr] || 21;
  },

  addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + Number(days));
    return d.toISOString().split('T')[0];
  },

  /**
   * Project future visit dates given a base date and frequency
   */
  generateFutureVisits(baseDateStr, frequencyDays = 21, count = 4) {
    const dates = [];
    let current = baseDateStr;
    for (let i = 1; i <= count; i++) {
      current = this.addDays(current, frequencyDays);
      dates.push({
        sequence: i,
        plannedDate: current,
        dayOfWeek: new Date(current).toLocaleDateString('en-US', { weekday: 'short' }),
        formatted: new Date(current).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
      });
    }
    return dates;
  },

  /**
   * Determine shop visit status given a planned date and today's reference date
   */
  getVisitStatus(plannedDateStr, actualVisitDateStr = null, todayStr = null) {
    if (actualVisitDateStr) return 'completed';

    const today = todayStr ? new Date(todayStr) : new Date();
    today.setHours(0, 0, 0, 0);

    const planned = new Date(plannedDateStr);
    planned.setHours(0, 0, 0, 0);

    const diffDays = Math.round((planned - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'due_today';
    if (diffDays > 0 && diffDays <= 7) return 'due_this_week';
    return 'upcoming';
  },

  /**
   * Calculate visit schedule profile for a shop
   */
  getShopScheduleProfile(lastVisitDate, frequencyDays = 21, referenceDate = null) {
    const today = referenceDate || new Date().toISOString().split('T')[0];
    const base = lastVisitDate || today;
    const futureProjections = this.generateFutureVisits(base, frequencyDays, 4);
    const nextVisit = futureProjections[0]?.plannedDate;
    const status = this.getVisitStatus(nextVisit, null, today);

    return {
      lastVisitDate: lastVisitDate || null,
      frequencyDays,
      nextVisitDate: nextVisit,
      futureVisits: futureProjections,
      status
    };
  }
};

export default DateFrequencyEngine;
