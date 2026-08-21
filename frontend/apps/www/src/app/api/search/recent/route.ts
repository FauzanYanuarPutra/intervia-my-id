import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json(
    {
      items: [],
      storage: 'client',
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  );
}
