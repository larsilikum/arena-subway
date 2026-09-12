import { createArena, PaginationMeta } from '@aredotna/sdk'
import {
  generatePKCE,
  generateState,
  OAuth,
  OAuthMissingCodeError,
  OAuthProviderError,
  OAuthStateMismatchError,
  parseOAuthCallback,
} from '@aredotna/sdk/oauth'
import type { ArenaBlock, ArenaChannel } from '@/types'
import { parseChannelContents } from '@/types/type_conversions'

// how many contents to fetch from a channel at once
export const PER = 50

let loggedIn: boolean | null = null

export async function isLoggedIn(): Promise<boolean> {
  if (loggedIn === null) {
    // check for token
    const _token = await storage.getItem<string>('local:token')
    if (_token !== null) loggedIn = true
    else loggedIn = false
  }
  return loggedIn
}

let arena = createArena({
  token: async () => (await storage.getItem<string>('local:token')) || '',
  retry: { respectRateLimits: true, maxRetries: 1 },
})

// =========================================== DATA FETCHING ===========================================
export async function fetchSearchBlocks(searchTerm: string) {
  return await arena.search.query({
    query: searchTerm,
    type: ['Link'],
    scope: 'all',
    sort: 'score_desc',
    per: 50,
  })
}

export async function fetchBlockChannels(id: number) {
  return await arena.blocks.connections(id, {
    per: 100,
    sort: 'created_at_desc',
  })
}

export async function fetchChannel(slug: string) {
  return await arena.channels.get(slug)
}

export async function fetchChannelContents(
  slug: string,
  page: number,
  activeTabId: number
): Promise<{ data: (ArenaChannel | ArenaBlock)[]; meta: PaginationMeta }> {
  const contents = await arena.channels.contents(slug, {
    per: PER,
    page: page,
    sort: 'position_desc',
  })
  const parsedContents = parseChannelContents(contents.data)
  browser.tabs.sendMessage(activeTabId, {
    type: 'channel-contents',
    value: {
      contents: parsedContents,
      page,
      per: PER,
      slug,
      next: contents.meta.next_page,
    },
  })
  return { data: parsedContents, meta: contents.meta }
}

// ========================================== ARE.NA AUTH =========================================

const CLIENT_ID = 'OrdORBujGQriu963U--4jJtCP3aeo4m5unixjW6T-u8'

export async function getArenaToken(): Promise<string | null> {
  const redirectUri = browser.identity.getRedirectURL()

  console.log(redirectUri)

  const token = await storage.getItem<string>('local:token')
  if (token) {
    loggedIn = true
    arena = createArena({
      token,
      retry: { respectRateLimits: true, maxRetries: 1 },
    })
    return token
  }

  const oauth = new OAuth({ clientId: CLIENT_ID, redirectUri })
  const pkce = await generatePKCE()
  const state = generateState()

  const authUrl = oauth.authorizeUrl({
    codeChallenge: pkce.codeChallenge,
    scope: 'write',
    state,
  })

  const redirectUrl = await browser.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  })

  if (!redirectUrl) return null

  const callback = parseOAuthCallback(redirectUrl)

  if (!callback.ok) {
    if (callback.error === 'missing_code') {
      throw new OAuthMissingCodeError()
    }
    throw new OAuthProviderError(callback)
  }

  if (callback.state !== state) {
    throw new OAuthStateMismatchError({
      expectedState: state ?? undefined,
      state: callback.state,
    })
  }

  const tokenRes = await oauth.exchangeCode({
    code: callback.code,
    codeVerifier: pkce.codeVerifier ?? undefined,
    expectedState: state ?? undefined,
    state: callback.state,
  })

  loggedIn = true

  await storage.setItem('local:token', tokenRes.access_token)
  arena = createArena({
    token: tokenRes.access_token,
    retry: { respectRateLimits: true, maxRetries: 1 },
  })
  return tokenRes.access_token
}
