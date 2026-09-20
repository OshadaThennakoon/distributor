/**
 * API client wrapper
 */

const API_BASE = '/api';

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const activeDistributorId = localStorage.getItem('activeDistributorId') || 'all';

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(activeDistributorId ? { 'x-distributor-id': activeDistributorId } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorMsg = 'API request failed';
    try {
      const errJson = await response.json();
      errorMsg = errJson.error || errorMsg;
    } catch (e) {
      errorMsg = await response.text() || errorMsg;
    }
    throw new Error(errorMsg);
  }

  // Check if blob / download
  const contentType = response.headers.get('content-type');
  if (contentType && (contentType.includes('spreadsheetml') || contentType.includes('csv'))) {
    return response.blob();
  }

  return response.json();
}

export const api = {
  get: (url) => apiRequest(url, { method: 'GET' }),
  post: (url, body) => apiRequest(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) => apiRequest(url, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (url) => apiRequest(url, { method: 'DELETE' }),
  download: async (url, filename) => {
    const blob = await apiRequest(url, { method: 'GET' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    a.remove();
  }
};

export default api;
