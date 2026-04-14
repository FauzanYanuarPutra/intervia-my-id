import { describe, expect, it } from 'vitest';
import {
  extractFirstUploadedImageUrl,
  extractUploadedDocumentFiles,
  normalizeProfilePayloadMedia,
} from './profileMedia';

describe('profileMedia helpers', () => {
  it('extracts the first uploaded image URL and normalizes content proxy paths', () => {
    expect(
      extractFirstUploadedImageUrl({
        urls: ['https://cdn.example.com/laju-chat/content/avatar.webp'],
      }),
    ).toBe('/api/content/media/laju-chat/content/avatar.webp');
  });

  it('extracts uploaded documents from files payloads', () => {
    expect(
      extractUploadedDocumentFiles({
        files: [
          {
            name: 'Resume.pdf',
            url: 'https://cdn.example.com/laju-chat/content/resume.pdf',
            size: 1024,
            mime: 'application/pdf',
          },
        ],
      }),
    ).toEqual([
      {
        name: 'Resume.pdf',
        url: '/api/content/media/laju-chat/content/resume.pdf',
        size: 1024,
        mime: 'application/pdf',
      },
    ]);
  });

  it('normalizes avatar, cover, gallery, and documents into a consistent profile payload', () => {
    expect(
      normalizeProfilePayloadMedia({
        avatar_url: 'https://cdn.example.com/laju-chat/content/avatar.webp',
        cover_image: '/uploads/content/cover.jpg',
        image_urls: ['/uploads/content/gallery-1.jpg'],
        document_urls: ['https://cdn.example.com/laju-chat/content/resume.pdf'],
        metadata: {
          media: {},
        },
      }),
    ).toEqual({
      avatarUrl: '/api/content/media/laju-chat/content/avatar.webp',
      avatar_url: '/api/content/media/laju-chat/content/avatar.webp',
      cover_image: '/uploads/content/cover.jpg',
      image_urls: ['/uploads/content/gallery-1.jpg'],
      document_urls: ['/api/content/media/laju-chat/content/resume.pdf'],
      media: {
        avatar_url: '/api/content/media/laju-chat/content/avatar.webp',
        cover_image: '/uploads/content/cover.jpg',
        gallery_images: ['/uploads/content/gallery-1.jpg'],
        documents: ['/api/content/media/laju-chat/content/resume.pdf'],
      },
      metadata: {
        avatar_url: '/api/content/media/laju-chat/content/avatar.webp',
        cover_image: '/uploads/content/cover.jpg',
        gallery_images: ['/uploads/content/gallery-1.jpg'],
        documents: ['/api/content/media/laju-chat/content/resume.pdf'],
        media: {
          avatar_url: '/api/content/media/laju-chat/content/avatar.webp',
          cover_image: '/uploads/content/cover.jpg',
          gallery_images: ['/uploads/content/gallery-1.jpg'],
          documents: ['/api/content/media/laju-chat/content/resume.pdf'],
        },
      },
    });
  });
});
