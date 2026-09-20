/**
 * Multi-distributor tenant isolation middleware.
 * If user is restricted to a distributor, enforces distributor_id.
 * If user is Admin, allows querying all distributors or selecting a specific distributor.
 */
export function scopeDistributor(req, res, next) {
  const user = req.user;
  const requestedDistributorId = req.query.distributorId || req.headers['x-distributor-id'];

  if (user && user.role !== 'ADMIN' && user.distributor_id) {
    // Restricted user is locked to their assigned tenant
    req.activeDistributorId = user.distributor_id;
  } else {
    // Admin or unrestricted user can specify 'all' or specific distributor
    if (requestedDistributorId && requestedDistributorId !== 'all') {
      req.activeDistributorId = Number(requestedDistributorId);
    } else {
      req.activeDistributorId = null; // Represents 'All Distributors'
    }
  }

  next();
}

export default scopeDistributor;
