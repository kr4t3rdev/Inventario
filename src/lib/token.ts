export const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('token') || '';
    return token ? `Bearer ${token}` : '';
  }
  return '';
};

export const setAuthToken = (token: string) => {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('token', token);
  }
};

export const clearAuthToken = () => {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('token');
  }
};
