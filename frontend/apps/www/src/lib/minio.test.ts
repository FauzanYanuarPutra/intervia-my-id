import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.fn();

vi.mock('@aws-sdk/client-s3', () => {
  class Command {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  return {
    S3Client: class {
      send = send;
    },
    CreateBucketCommand: class extends Command {},
    GetObjectCommand: class extends Command {},
    HeadBucketCommand: class extends Command {},
    HeadObjectCommand: class extends Command {},
    PutObjectCommand: class extends Command {},
  };
});

beforeEach(() => {
  vi.resetModules();
  send.mockReset();
  process.env.MINIO_ENDPOINT = 'http://minio:9002';
  process.env.MINIO_ACCESS_KEY = 'test-access';
  process.env.MINIO_SECRET_KEY = 'test-secret';
  process.env.MINIO_BUCKET = 'laju-chat';
  process.env.APP_ENV = 'test';
});

describe('uploadToMinIO durability', () => {
  it('verifies the exact object with HEAD before returning success', async () => {
    send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ ContentLength: 3, ContentType: 'image/jpeg' });

    const { uploadToMinIO } = await import('./minio');
    const result = await uploadToMinIO(
      'content',
      Buffer.from([1, 2, 3]),
      'image/jpeg',
      'photo.jpg',
    );

    expect(send).toHaveBeenCalledTimes(3);
    const put = send.mock.calls[1]?.[0] as { input: { Bucket: string; Key: string } };
    const head = send.mock.calls[2]?.[0] as { input: { Bucket: string; Key: string } };
    expect(head.input).toEqual({ Bucket: put.input.Bucket, Key: put.input.Key });
    expect(result.key).toBe(put.input.Key);
  });

  it('returns a reversible room URL while keeping the storage key safe', async () => {
    send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ ContentLength: 3, ContentType: 'image/jpeg' });

    const { uploadToMinIO } = await import('./minio');
    const result = await uploadToMinIO(
      'dm:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222',
      Buffer.from([1, 2, 3]),
      'image/jpeg',
      'photo.jpg',
    );

    expect(result.key).toMatch(
      /^chat\/dm_11111111-1111-4111-8111-111111111111_22222222-2222-4222-8222-222222222222\/[a-f0-9]{64}\.jpg$/,
    );
    expect(result.url).toMatch(
      /^\/api\/chat\/media\/laju-chat\/chat\/dm%3A11111111-1111-4111-8111-111111111111%3A22222222-2222-4222-8222-222222222222\/[a-f0-9]{64}\.jpg$/,
    );
  });

  it('rejects an upload when post-PUT verification reports an empty object', async () => {
    send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ ContentLength: 0 });

    const { uploadToMinIO } = await import('./minio');
    await expect(
      uploadToMinIO('content', Buffer.from([1]), 'image/jpeg', 'photo.jpg'),
    ).rejects.toThrow(/verification/i);
  });
});
