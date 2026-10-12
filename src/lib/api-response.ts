/**
 * API Response Helpers and Security Headers
 */

import { NextResponse } from 'next/server';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  meta?: Record<string, any>;
}

export function jsonResponse<T = any>(
  data: T,
  status = 200,
  meta?: Record<string, any>
): NextResponse {
  const body: ApiResponse<T> = {
    success: true,
    data,
    meta
  };

  return NextResponse.json(body, {
    status,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache'
    }
  });
}

export function errorResponse(
  error: string,
  status = 400,
  code?: string
): NextResponse {
  const body: ApiResponse = {
    success: false,
    error,
    code: code || `ERR_${status}`
  };

  return NextResponse.json(body, {
    status,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Cache-Control': 'no-store, no-cache'
    }
  });
}
