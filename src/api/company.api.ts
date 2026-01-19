/**
 * Company API
 *
 * JWT-ONLY AUTH MODEL:
 * - Stores ONE JWT in localStorage under 'aura_access_token'
 * - Company state is hydrated ONLY via /company/auth/me
 */

import api from '@/utils/api';
import { AuthTokenResponseSchema, CompanyUserSchema, MessageResponseSchema, OtpResponseSchema } from '@/schemas/api.schemas';
import type { CompanyUser } from '@/types/company';
import { clearToken, getAccessToken, setToken } from '@/api/auth.api';

// ============================================================================
// AUTH APIs - Backend-authoritative
// ============================================================================

export const registerCompany = async (
  email: string,
  password: string,
  companyName: string
): Promise<void> => {
  const response = await api.post('/company/auth/register', { email, password, companyName });

  const parsed = MessageResponseSchema.safeParse(response.data);
  if (!parsed.success) {
    throw new Error('Schema validation failed: company register');
  }
};

/**
 * Login company
 *
 * CONTRACT:
 * - Stores JWT only
 * - Does NOT return company
 * - Caller MUST hydrate via /company/auth/me
 */
export const loginCompany = async (email: string, password: string): Promise<void> => {
  const response = await api.post('/company/auth/login', { email, password });

  const parsed = AuthTokenResponseSchema.safeParse(response.data);
  if (!parsed.success) {
    throw new Error('Schema validation failed: company login');
  }

  setToken(parsed.data.access_token);
};

/**
 * Get current company session
 *
 * THIS IS THE ONLY SOURCE OF TRUTH FOR COMPANY STATE
 */
export const getCurrentCompany = async (): Promise<CompanyUser | null> => {
  const token = getAccessToken();
  if (!token) return null;

  try {
    const response = await api.get('/company/auth/me');

    const parsed = CompanyUserSchema.safeParse(response.data);
    if (!parsed.success) {
      throw new Error('Schema validation failed: company auth/me');
    }

    return parsed.data as CompanyUser;
  } catch {
    // 401 handled by axios interceptor; still clear local token for consistency
    clearToken();
    return null;
  }
};

export const requestCompanyEmailOtp = async (email: string): Promise<void> => {
  const response = await api.post('/company/auth/otp/request', { email });

  const parsed = OtpResponseSchema.safeParse(response.data);
  if (!parsed.success) {
    throw new Error('Schema validation failed: company email OTP request');
  }
};

export const verifyCompanyEmailOtp = async (email: string, otp: string): Promise<void> => {
  const response = await api.post('/company/auth/otp/verify', { email, otp });

  const parsed = MessageResponseSchema.safeParse(response.data);
  if (!parsed.success) {
    throw new Error('Schema validation failed: company email OTP verify');
  }
};

export const verifyCompanyGst = async (gstNumber: string): Promise<void> => {
  const response = await api.post('/company/verify/gst', { gstNumber });

  const parsed = MessageResponseSchema.safeParse(response.data);
  if (!parsed.success) {
    throw new Error('Schema validation failed: company GST verify');
  }
};

export const updateCompanyProfile = async (data: Partial<CompanyUser>): Promise<CompanyUser> => {
  const response = await api.patch('/company/profile', data);

  const parsed = CompanyUserSchema.safeParse(response.data);
  if (!parsed.success) {
    throw new Error('Schema validation failed: company profile update');
  }

  return parsed.data as CompanyUser;
};

export const logoutCompany = async (): Promise<void> => {
  try {
    await api.post('/company/auth/logout');
  } catch {
    // Ignore logout errors
  } finally {
    clearToken();
  }
};

