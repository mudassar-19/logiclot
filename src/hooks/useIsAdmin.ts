import { useAuth } from '@/contexts/AuthContext';

export const useIsAdmin = () => {
  const { userRole } = useAuth();
  return userRole === 'admin';
};
