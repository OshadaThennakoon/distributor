import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api.js';

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const [distributors, setDistributors] = useState([]);
  const [activeDistributorId, setActiveDistributorId] = useState(
    localStorage.getItem('activeDistributorId') || 'all'
  );
  const [loading, setLoading] = useState(true);

  const fetchDistributors = async () => {
    try {
      const data = await api.get('/distributors');
      setDistributors(data);
    } catch (err) {
      console.error('Failed to load distributors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDistributors();
  }, []);

  const changeDistributor = (id) => {
    setActiveDistributorId(id);
    localStorage.setItem('activeDistributorId', id);
  };

  const activeDistributor = distributors.find(d => String(d.id) === String(activeDistributorId));
  const currencySymbol = activeDistributor?.currency_symbol || 'Rs.';

  return (
    <TenantContext.Provider value={{
      distributors,
      activeDistributorId,
      activeDistributor,
      currencySymbol,
      changeDistributor,
      refreshDistributors: fetchDistributors,
      loading
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}

export default TenantContext;
