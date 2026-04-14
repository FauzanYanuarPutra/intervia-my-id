import { expect, test } from '@playwright/test';

test('registration via OTP flow', async ({ request }) => {
  const phone = `08124${Date.now().toString().slice(-7)}`;

  const sendOtp = await request.post('/api/auth/send-otp', {
    data: {
      type: 'phone',
      target: phone,
      purpose: 'register',
    },
  });
  expect(sendOtp.ok()).toBeTruthy();

  const sendOtpData = (await sendOtp.json().catch(() => ({}))) as {
    devOtp?: string;
    success?: boolean;
  };

  test.skip(
    !sendOtpData.devOtp,
    'DEV_OTP_ECHO must be enabled for automated OTP registration test.',
  );

  const verifyOtp = await request.post('/api/auth/verify-otp', {
    data: {
      type: 'phone',
      target: phone,
      otp: sendOtpData.devOtp,
      purpose: 'register',
    },
  });
  expect(verifyOtp.ok()).toBeTruthy();

  const verifyOtpData = (await verifyOtp.json()) as { token?: string };
  expect(verifyOtpData.token).toBeTruthy();

  const registerRes = await request.post('/api/auth/register', {
    data: {
      phone,
      full_name: 'E2E User',
      phone_otp_token: verifyOtpData.token,
    },
  });

  expect([200, 201]).toContain(registerRes.status());
});
