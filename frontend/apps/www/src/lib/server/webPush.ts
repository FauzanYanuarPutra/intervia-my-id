import 'server-only';

import { createCipheriv, createECDH, createHmac, randomBytes } from 'node:crypto';
import { importJWK, SignJWT, type JWK } from 'jose';

function base64UrlToBuffer(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function bufferToBase64Url(value: Buffer): string {
  return value
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function hkdfExtract(salt: Buffer, input: Buffer): Buffer {
  return createHmac('sha256', salt).update(input).digest();
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number): Buffer {
  const chunks: Buffer[] = [];
  let previous = Buffer.alloc(0);
  let counter = 0;

  while (Buffer.concat(chunks).length < length) {
    counter += 1;
    previous = createHmac('sha256', prk)
      .update(Buffer.concat([previous, info, Buffer.from([counter])]))
      .digest();
    chunks.push(previous);
  }

  return Buffer.concat(chunks).subarray(0, length);
}

function getVapidConfig() {
  const privateKey = String(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || '').trim();
  const subject = String(
    process.env.WEB_PUSH_VAPID_SUBJECT || 'mailto:admin@lajukan.com',
  ).trim();

  if (!privateKey) {
    throw new Error('WEB_PUSH_VAPID_PRIVATE_KEY is not configured');
  }

  const privateBytes = base64UrlToBuffer(privateKey);
  if (privateBytes.length !== 32) {
    throw new Error('WEB_PUSH_VAPID_PRIVATE_KEY must be a base64url P-256 private key');
  }

  const sender = createECDH('prime256v1');
  sender.setPrivateKey(privateBytes);
  const senderPublicKey = sender.getPublicKey(undefined, 'uncompressed');

  const jwk: JWK = {
    kty: 'EC',
    crv: 'P-256',
    d: bufferToBase64Url(privateBytes),
    x: bufferToBase64Url(senderPublicKey.subarray(1, 33)),
    y: bufferToBase64Url(senderPublicKey.subarray(33, 65)),
  };

  return {
    privateKey: jwk,
    publicKey: bufferToBase64Url(senderPublicKey),
    subject,
  };
}

export function getWebPushPublicKey(): string | null {
  try {
    return getVapidConfig().publicKey;
  } catch {
    return null;
  }
}

async function createVapidToken(audience: string) {
  const config = getVapidConfig();
  const key = await importJWK(config.privateKey, 'ES256');

  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .setAudience(audience)
    .setSubject(config.subject)
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(key);
}

export async function sendWebPush(
  subscription: {
    endpoint: string;
    p256dh: string;
    auth_secret: string;
  },
  payload: Record<string, unknown>,
): Promise<'ok' | 'expired'> {
  const receiverPublicKey = base64UrlToBuffer(subscription.p256dh);
  const authSecret = base64UrlToBuffer(subscription.auth_secret);

  if (receiverPublicKey.length !== 65 || authSecret.length < 16) {
    throw new Error('Invalid push subscription key material');
  }

  const ephemeral = createECDH('prime256v1');
  ephemeral.generateKeys();
  const senderPublicKey = ephemeral.getPublicKey(undefined, 'uncompressed');
  const sharedSecret = ephemeral.computeSecret(receiverPublicKey);

  const authInfo = Buffer.concat([
    Buffer.from('WebPush: info\\0', 'utf8'),
    receiverPublicKey,
    senderPublicKey,
  ]);

  const authPrk = hkdfExtract(authSecret, sharedSecret);
  const ikm = hkdfExpand(authPrk, authInfo, 32);

  const salt = randomBytes(16);
  const prk = hkdfExtract(salt, ikm);
  const cek = hkdfExpand(
    prk,
    Buffer.from('Content-Encoding: aes128gcm\\0', 'utf8'),
    16,
  );
  const nonce = hkdfExpand(
    prk,
    Buffer.from('Content-Encoding: nonce\\0', 'utf8'),
    12,
  );

  const paddedPayload = Buffer.concat([
    Buffer.from(JSON.stringify(payload), 'utf8'),
    Buffer.from([2]),
  ]);

  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(paddedPayload),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  const recordSize = 4096;
  const body = Buffer.concat([
    salt,
    Buffer.from([
      (recordSize >>> 24) & 0xff,
      (recordSize >>> 16) & 0xff,
      (recordSize >>> 8) & 0xff,
      recordSize & 0xff,
    ]),
    Buffer.from([senderPublicKey.length]),
    senderPublicKey,
    ciphertext,
  ]);

  const endpoint = new URL(subscription.endpoint);
  const audience = endpoint.origin;
  const token = await createVapidToken(audience);
  const vapidPublicKey = getVapidConfig().publicKey;

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      TTL: '60',
      Urgency: 'high',
      Authorization: `vapid t=${token}, k=${vapidPublicKey}`,
      'Crypto-Key': `p256ecdsa=${vapidPublicKey}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'Content-Length': String(body.byteLength),
    },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });

  if (response.status === 404 || response.status === 410) {
    return 'expired';
  }

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(
      `Push provider rejected request: ${response.status} ${details.slice(0, 240)}`,
    );
  }

  return 'ok';
}