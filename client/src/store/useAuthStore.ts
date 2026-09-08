import { create } from 'zustand';

export interface UserProfile {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  username: string;
  departmentId?: string;
  designation?: string;
  roles: string[];
  permissions: string[];
}

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: UserProfile, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  setAuth: (user, token) => {
    localStorage.setItem('accessToken', token);
    set({ user, accessToken: token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('accessToken');
    set({ user: null, accessToken: null, isAuthenticated: false });
  },
}));
