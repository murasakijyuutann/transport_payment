import type {
  AccountView,
  AuthResult,
  CapStatusView,
  FareView,
  JourneyView,
  LedgerView,
  StationView,
  TapResult,
} from './types';

const BASE = '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    if (!location.pathname.endsWith('index.html') && location.pathname !== '/') {
      location.href = '/index.html';
    }
  }

  if (!res.ok) {
    let message = res.statusText;
    let code: string | undefined;
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      message = body.error ?? message;
      code = body.code;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status, code);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function register(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<AuthResult> {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getAccount(): Promise<AccountView> {
  return request('/account');
}

export async function topUp(amount: number): Promise<AccountView> {
  return request('/wallet/topup', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

export async function postTap(
  mediaToken: string,
  validatorId: string,
): Promise<TapResult> {
  return request('/taps', {
    method: 'POST',
    body: JSON.stringify({
      mediaToken,
      validatorId,
      timestamp: new Date().toISOString(),
    }),
  });
}

export async function listJourneys(): Promise<JourneyView[]> {
  return request('/account/journeys');
}

export async function getJourney(id: string): Promise<JourneyView> {
  return request(`/account/journeys/${id}`);
}

export async function getJourneyFare(id: string): Promise<FareView> {
  return request(`/account/journeys/${id}/fare`);
}

export async function getLedger(): Promise<LedgerView> {
  return request('/account/wallet/ledger');
}

export async function getCapStatus(): Promise<CapStatusView> {
  return request('/account/cap-status');
}

export async function listStations(): Promise<StationView[]> {
  return request('/admin/stations');
}

export async function expireJourneys(): Promise<{ expired: number; charged: number }> {
  return request('/admin/jobs/expire-journeys', { method: 'POST' });
}
