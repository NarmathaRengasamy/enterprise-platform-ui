import { client, setToken, clearToken } from './client';
import {
  AuthResponseData,
  LoginCredentials,
  RegisterData,
  User,
} from '../types/auth.types';

export const authService = {
  /**
   * Log in user with email & password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponseData> {
    const response = await client.post<AuthResponseData>('/auth/login', {
      email: credentials.email,
      password: credentials.password,
      rememberMe: credentials.rememberMe ?? true,
    });

    if (!response.data || !response.data.token) {
      throw new Error('Invalid authentication response from server');
    }

    setToken(response.data.token, credentials.rememberMe ?? true);
    return response.data;
  },

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<AuthResponseData> {
    const response = await client.post<AuthResponseData>('/auth/register', {
      name: data.name,
      email: data.email,
      password: data.password,
      department: data.department || 'Operations',
      role: data.role || 'Editor',
    });

    if (!response.data || !response.data.token) {
      throw new Error('Invalid registration response from server');
    }

    setToken(response.data.token, true);
    return response.data;
  },

  /**
   * Fetch currently authenticated user profile
   */
  async getCurrentUser(): Promise<User> {
    const response = await client.get<User>('/auth/me');
    if (!response.data) {
      throw new Error('Could not retrieve user profile');
    }
    return response.data;
  },

  /**
   * Log out user
   */
  logout(): void {
    clearToken();
  },
};
