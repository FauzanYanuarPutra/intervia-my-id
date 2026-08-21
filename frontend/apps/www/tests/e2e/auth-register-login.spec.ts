import { expect, test } from '@playwright/test';

test('register then login with OTP and fetch /auth/me', async ({ request }) => {
  const phone = `08123${Date.now().toString().slice(-7)}`;

  const sendRegisterOtp = await request.post('/api/auth/send-otp', {
    data: {
      type: 'phone',
      target: phone,
      purpose: 'register',
    },
  });
  expect(sendRegisterOtp.ok()).toBeTruthy();
  const sendRegisterOtpData = (await sendRegisterOtp.json().catch(() => ({}))) as {
    devOtp?: string;
  };
  test.skip(
    !sendRegisterOtpData.devOtp,
    'DEV_OTP_ECHO must be enabled for OTP-based auth E2E test.',
  );

  const verifyRegisterOtp = await request.post('/api/auth/verify-otp', {
    data: {
      type: 'phone',
      target: phone,
      otp: sendRegisterOtpData.devOtp,
      purpose: 'register',
    },
  });
  expect(verifyRegisterOtp.ok()).toBeTruthy();
  const verifyRegisterOtpData = (await verifyRegisterOtp.json().catch(() => ({}))) as {
    token?: string;
  };
  expect(typeof verifyRegisterOtpData.token).toBe('string');

  const registerRes = await request.post('/api/auth/register', {
    data: {
      phone,
      full_name: 'E2E Auth Flow User',
      phone_otp_token: verifyRegisterOtpData.token,
    },
  });
  expect([200, 201]).toContain(registerRes.status());

  const sendLoginOtp = await request.post('/api/auth/send-otp', {
    data: {
      type: 'phone',
      target: phone,
      purpose: 'login',
    },
  });
  expect(sendLoginOtp.ok()).toBeTruthy();
  const sendLoginOtpData = (await sendLoginOtp.json().catch(() => ({}))) as {
    devOtp?: string;
  };
  test.skip(
    !sendLoginOtpData.devOtp,
    'DEV_OTP_ECHO must be enabled for OTP-based auth E2E test.',
  );

  const verifyLoginOtp = await request.post('/api/auth/verify-otp', {
    data: {
      type: 'phone',
      target: phone,
      otp: sendLoginOtpData.devOtp,
      purpose: 'login',
    },
  });
  expect(verifyLoginOtp.ok()).toBeTruthy();
  const verifyLoginOtpData = (await verifyLoginOtp.json().catch(() => ({}))) as {
    token?: string;
  };
  expect(typeof verifyLoginOtpData.token).toBe('string');

  const loginRes = await request.post('/api/auth/login-phone', {
    data: {
      phone,
      phone_otp_token: verifyLoginOtpData.token,
    },
  });
  expect(loginRes.ok()).toBeTruthy();
  const loginData = (await loginRes.json().catch(() => ({}))) as {
    access_token?: string;
  };

  const meHeaders: Record<string, string> = {};
  if (typeof loginData.access_token === 'string' && loginData.access_token.length > 0) {
    meHeaders.Authorization = `Bearer ${loginData.access_token}`;
  }
  const meRes = await request.get('/api/auth/me', {
    headers: meHeaders,
  });
  expect(meRes.ok()).toBeTruthy();
  const meData = (await meRes.json().catch(() => ({}))) as {
    id?: string;
    email?: string;
    phone?: string;
    user?: { id?: string; email?: string; phone?: string };
  };

  const userId = meData.id || meData.user?.id;
  const userPhone = meData.phone || meData.user?.phone;
  expect(typeof userId).toBe('string');
  expect(userPhone).toBe(phone);

  const authHeaders: Record<string, string> = {};
  if (typeof loginData.access_token === 'string' && loginData.access_token.length > 0) {
    authHeaders.Authorization = `Bearer ${loginData.access_token}`;
  }

  const onboardingPayload = {
    step: 'completed',
    profile: {
      roles: ['buyer', 'seller'],
      sectors: ['technology', 'realestate'],
      full_name: 'E2E Auth Flow User',
      bio: 'Onboarding saved by automation.',
    },
  };
  const onboardingRes = await request.put('/api/auth/onboarding', {
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    data: onboardingPayload,
  });

  if (!onboardingRes.ok()) {
    const fallbackRes = await request.put('/api/auth/update-profile', {
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      data: {
        full_name: onboardingPayload.profile.full_name,
        bio: `${onboardingPayload.profile.bio}\nRoles: ${onboardingPayload.profile.roles.join(', ')}\nSectors: ${onboardingPayload.profile.sectors.join(', ')}`,
      },
    });
    expect(fallbackRes.ok()).toBeTruthy();
  }

  const listingTitle = `E2E First Listing ${Date.now()}`;
  const createDraftRes = await request.post('/api/content/create', {
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    data: {
      type: 'job',
      title: listingTitle,
      summary: 'First listing after register and onboarding.',
      body: 'Automation validates register -> login -> onboarding -> draft flow.',
      content_status: 'draft',
      metadata: {
        sector: 'technology',
        level: 'junior',
        employment_type: 'fulltime',
        location: 'Jakarta',
      },
    },
  });
  expect([200, 201]).toContain(createDraftRes.status());
  const createDraftData = (await createDraftRes.json().catch(() => ({}))) as {
    id?: string;
    content_type?: string;
    type?: string;
    content_status?: string;
    status?: string;
  };
  expect(typeof createDraftData.id).toBe('string');
  expect(String(createDraftData.type || createDraftData.content_type || '').toLowerCase()).toBe(
    'job',
  );
  expect(String(createDraftData.content_status || createDraftData.status || '').toLowerCase()).toBe(
    'draft',
  );

  const topupRes = await request.post('/api/wallet/topups', {
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `e2e-wallet-sync-${Date.now()}`,
    },
    data: {
      amount_cents: 150_000,
      currency: 'IDR',
      environment: 'development',
      payment_provider: 'mock',
      auto_settle: true,
      description: 'E2E wallet sync check',
    },
  });
  expect([200, 201]).toContain(topupRes.status());

  let walletBalanceCents = 0;
  let walletHeldCents = 0;
  let statsWalletBalanceCents = -1;
  let statsPendingCents = -1;
  let statsWalletEnv = '';

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const walletRes = await request.get('/api/wallet/balance', { headers: authHeaders });
    expect(walletRes.ok()).toBeTruthy();
    const walletData = (await walletRes.json().catch(() => ({}))) as {
      default_environment?: string;
      accounts?: Array<{
        environment?: string;
        available_balance_cents?: number;
        held_balance_cents?: number;
      }>;
    };
    const accounts = Array.isArray(walletData.accounts) ? walletData.accounts : [];
    const defaultEnv = String(walletData.default_environment || 'development').toLowerCase();
    const selectedAccount =
      accounts.find((account) => String(account.environment || '').toLowerCase() === defaultEnv) ||
      accounts.find((account) => String(account.environment || '').toLowerCase() === 'development') ||
      accounts[0];

    walletBalanceCents = Number(selectedAccount?.available_balance_cents || 0);
    walletHeldCents = Number(selectedAccount?.held_balance_cents || 0);
    const normalizedWalletEnv = String(selectedAccount?.environment || defaultEnv || 'development').toLowerCase();

    const statsRes = await request.get('/api/dashboard/stats', { headers: authHeaders });
    expect(statsRes.ok()).toBeTruthy();
    const statsData = (await statsRes.json().catch(() => ({}))) as {
      wallet_balance_cents?: number;
      balance_cents?: number;
      pending_payout_cents?: number;
      pending_balance_cents?: number;
      wallet_environment?: string;
    };
    statsWalletBalanceCents = Number(statsData.wallet_balance_cents ?? statsData.balance_cents ?? 0);
    statsPendingCents = Number(statsData.pending_payout_cents ?? statsData.pending_balance_cents ?? 0);
    statsWalletEnv = String(statsData.wallet_environment || '');

    if (
      statsWalletBalanceCents === walletBalanceCents &&
      statsPendingCents === walletHeldCents &&
      statsWalletEnv.toLowerCase() === normalizedWalletEnv
    ) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  expect(statsWalletBalanceCents).toBe(walletBalanceCents);
  expect(statsPendingCents).toBe(walletHeldCents);
  expect(statsWalletEnv.toLowerCase()).toMatch(/^(development|live)$/);

  const pendingTopupRes = await request.post('/api/wallet/topups', {
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `e2e-wallet-cancel-${Date.now()}`,
    },
    data: {
      amount_cents: 120_000,
      currency: 'IDR',
      environment: 'development',
      payment_provider: 'mock',
      auto_settle: false,
      description: 'E2E wallet cancel check',
    },
  });
  expect([200, 201]).toContain(pendingTopupRes.status());
  const pendingTopupData = (await pendingTopupRes.json().catch(() => ({}))) as {
    topup?: {
      id?: string;
      status?: string;
    };
  };
  const pendingTopupId = pendingTopupData.topup?.id;
  expect(typeof pendingTopupId).toBe('string');
  expect(String(pendingTopupData.topup?.status || '').toLowerCase()).toBe('pending');

  const cancelTopupRes = await request.post(
    `/api/wallet/topups/${encodeURIComponent(String(pendingTopupId))}/cancel`,
    {
      headers: {
        ...authHeaders,
        'X-Idempotency-Key': `e2e-wallet-cancel-action-${Date.now()}`,
      },
    },
  );
  expect(cancelTopupRes.ok()).toBeTruthy();
  const cancelTopupData = (await cancelTopupRes.json().catch(() => ({}))) as {
    topup?: {
      status?: string;
    };
  };
  expect(String(cancelTopupData.topup?.status || '').toLowerCase()).toBe('cancelled');
});
