/**
 * Vercel Edge function — dynamic OG image generator for share URLs.
 *
 * Request shape:
 *   GET /api/og?title=Hello%20Record&kind=record&code=...
 *
 * Query params:
 *   title  — contract name or user-supplied label (≤ 64 chars)
 *   kind   — record | token | ballot | vault | ceremony | ... (styles the badge)
 *   code   — optional code snippet (truncated to ≤ 320 chars for render)
 *
 * Emits a 1200×630 PNG using Satori (via @vercel/og). Cached 1h at the
 * CDN edge; the URL is deterministic in its query string so repeat
 * share-links get hot cache hits.
 *
 * Deployed at `covenant-playground/api/og.tsx` → served from the same
 * origin as the playground (`playground.covenant-lang.org/api/og`).
 * Share.ts embeds the full URL in og:image meta for X/Discord/Telegram.
 */

import { ImageResponse } from '@vercel/og';
import React from 'react';

export const config = {
  runtime: 'edge',
};

const PAPER = '#FCFBF8';
const INK = '#1A1A1A';
const MUTE = '#555555';
const ACCENT = '#7C3AED';

export default function handler(req: Request): Response {
  const url = new URL(req.url);
  const title = truncate(url.searchParams.get('title') ?? 'Covenant Playground', 64);
  const kind = truncate(url.searchParams.get('kind') ?? '', 16);
  const rawCode = url.searchParams.get('code') ?? '';
  const code = truncate(rawCode, 320);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: PAPER,
          display: 'flex',
          flexDirection: 'column',
          padding: '56px 64px',
          fontFamily: 'Georgia, serif',
          color: INK,
        }}
      >
        {/* Brand row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            marginBottom: '48px',
          }}
        >
          <div style={{ display: 'flex', width: '32px', height: '32px', background: ACCENT }} />
          <div
            style={{
              fontSize: '28px',
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            Covenant
          </div>
          <div
            style={{
              fontSize: '12px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: ACCENT,
              border: `1px solid ${ACCENT}`,
              padding: '4px 10px',
              fontFamily: 'monospace',
              marginLeft: '4px',
            }}
          >
            Playground
          </div>
          {kind && (
            <div
              style={{
                fontSize: '14px',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: MUTE,
                fontFamily: 'monospace',
                marginLeft: 'auto',
              }}
            >
              {kind}
            </div>
          )}
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: '72px',
            lineHeight: 1.08,
            fontWeight: 400,
            maxWidth: '960px',
            marginBottom: code ? '36px' : '0',
            display: 'flex',
          }}
        >
          {title}
        </div>

        {/* Code preview */}
        {code && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '20px 28px',
              background: '#F5F4F0',
              border: '1px solid rgba(26,26,26,0.15)',
              fontFamily: 'monospace',
              fontSize: '18px',
              lineHeight: 1.45,
              color: '#2D2D2D',
              whiteSpace: 'pre-wrap',
              maxHeight: '260px',
              overflow: 'hidden',
            }}
          >
            {code}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            marginTop: 'auto',
            fontSize: '18px',
            color: MUTE,
            fontFamily: 'monospace',
            letterSpacing: '0.04em',
          }}
        >
          playground.covenant-lang.org
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

// react import kept so tsc doesn't prune it — the JSX factory resolves
// back to React.createElement in classic runtime mode.
void React;
