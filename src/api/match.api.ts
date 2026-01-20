/**
 * Match API
 * 
 * Backend-authoritative match operations.
 */

import api from '@/utils/api';
import type { MatchResult } from '@/types/student';

/**
 * Triggers match computation for the current student.
 */
export const runMatchSimulation = async (): Promise<MatchResult> => {
  const response = await api.post<MatchResult>('/student/match/run');
  return response.data;
};

/**
 * Gets current match status for the authenticated student.
 */
export const getMatchStatus = async (): Promise<MatchResult | null> => {
  const response = await api.get<MatchResult | null>('/student/match/status');
  return response.data;
};

/**
 * Accepts the current match offer.
 */
export const acceptMatch = async (): Promise<boolean> => {
  const response = await api.post<{ success: boolean }>('/student/match/accept');
  return response.data.success;
};

/**
 * Declines the current match offer.
 */
export const declineMatch = async (): Promise<boolean> => {
  const response = await api.post<{ success: boolean }>('/student/match/decline');
  return response.data.success;
};
