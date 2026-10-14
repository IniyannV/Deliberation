export const REQUEST_STATUSES = ['pending', 'acknowledged', 'fulfilled'];

export const publicRequest = (r) => ({
  id: r.id,
  seat: r.seat,
  type: r.type,
  payload: r.payload,
  status: r.status,
  createdAt: r.createdAt,
  history: r.history,
});

/** Requests only move forward: pending → acknowledged → fulfilled. */
export const canAdvance = (from, to) => REQUEST_STATUSES.indexOf(to) > REQUEST_STATUSES.indexOf(from);
