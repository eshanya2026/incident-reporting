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
  setUser: (user: UserProfile) => void;
  logout: () => void;
}

const getStoredUser = (): UserProfile | null => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  accessToken: localStorage.getItem('accessToken'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  setAuth: (user, token) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, accessToken: token, isAuthenticated: true });
  },
  setUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    set({ user: null, accessToken: null, isAuthenticated: false });
  },
}));
