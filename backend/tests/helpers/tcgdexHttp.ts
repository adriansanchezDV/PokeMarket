import { vi } from 'vitest';
import { tcgdexCards, tcgdexSet } from '../fixtures/tcgdex/catalog.js';

// Only the external HTTP boundary is replaced. Unexpected URLs fail closed.
export const mockTcgdexHttp = (
  responses: Record<string, unknown> = {
    '/sets/base1': tcgdexSet,
    ...Object.fromEntries(tcgdexCards.map((card) => ['/cards/' + card.id, card])),
  },
) => {
  const fetchMock = vi.fn<typeof fetch>(async (input, options) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.origin !== 'https://api.tcgdex.net' || !url.pathname.startsWith('/v2/en/')) {
      throw new Error('Unexpected external HTTP destination');
    }
    if (!(options?.signal instanceof AbortSignal)) throw new Error('Missing TCGdex timeout signal');
    const path = url.pathname.slice('/v2/en'.length);
    if (!Object.hasOwn(responses, path)) throw new Error('Missing TCGdex fixture: ' + path);
    return Response.json(responses[path]);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};
