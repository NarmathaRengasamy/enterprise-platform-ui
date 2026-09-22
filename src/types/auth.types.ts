export type UserRole = 'Admin' | 'Editor' | 'Viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  status?: 'Active' | 'Pending' | 'Inactive';
  avatar?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  department?: string;
  role?: UserRole;
}

export interface AuthResponseData {
  token: string;
  expiresIn?: string;
  user: User;
}

export interface ApiFieldError {
  path: string;
  message: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  error?: string;
  /** Present only on a 400 from schema validation. `path` is dotted and carries
      its source prefix (`body.name`, `query.page`, `params.id`), which is what
      lets a failure be mapped back to the form field that caused it. */
  errors?: ApiFieldError[];
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}
