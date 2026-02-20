import { ArenaBlock, ArenaChannel } from "@/types"
import { parseChannelContents } from "@/types/type_conversions"

// how many contents to fetch from a channel at once
const PER = 50

// retries
const MAX_RETRIES = 4
const RETRY_TIMEOUT = 100
const MAX_REQUESTS = {
  not_logged_in: 30,
  logged_in: 120
}
const requestTimestamps: number[] = []

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



// =========================================== DATA FETCHING ===========================================
export async function fetchSearchBlocks(searchTerm: string) {
  return await fetchArena(`search/blocks?q=${searchTerm}&per=100`).then(r => r.json())
}

export async function fetchBlockChannels(id: number) {
  const blockChannels = await fetchArena(`blocks/${id}/channels`).then(r => r.json())
  return blockChannels
}

export async function fetchChannel(slug: string): Promise<ArenaChannel> {
  return await fetchArena(`channels/${slug}?per=${PER}`).then(r => r.json())
}

export async function fetchChannelContents(slug: string, channelLength: number, contentsFetched: (ArenaChannel | ArenaBlock)[] = [], activeTabId: number) {
  // const fetchedLength = contentsFetched.length
  // this only works if fetchedLength is perfectly divideble by per
  // const fetchedPages = Math.floor(fetchedLength / PER)
  const pages = Math.ceil(channelLength / PER)
  console.log(`fetching ${pages} pages`)
  const promises: Promise<any>[] = []
  for (let i = 1; i <= pages; i++) {
    promises.push(
      Promise.resolve(() => {
        setTimeout(() => {}, i * 200)
      }).then(async () => {
        return fetchArena(`channels/${slug}/contents?per=${PER}&page=${i}&sort=position_desc`)
          .catch(error => console.log(error)) 
      }).then(async r => {
        if(r) {
          const json = await r.json()
          browser.tabs.sendMessage(activeTabId, { type: "channel-contents", value: { contents: parseChannelContents(json.contents), page: i, per: PER, contentLength: channelLength }})
          return json
        }
        return []
        })
    )
  }
  return await Promise.all(promises)
    .then(d => {
      const contents = d.map((r: ArenaChannel) => parseChannelContents(r.contents)).flat()
      // return [...contentsFetched, ...contents]
      return contents
    })
}

// ============================= custom fetch function with ratelimiting ===================================
  
// Clean up old requests (older than 1 minute)
function cleanOldRequests() {
  const oneMinuteAgo = Date.now() - 60000
  while (requestTimestamps.length > 0 && requestTimestamps[0] < oneMinuteAgo) {
    requestTimestamps.shift()
  }
}

// Check if we can make a request, wait if needed
async function waitForRateLimit(): Promise<void> {
  cleanOldRequests()
  
  const limit = loggedIn ? MAX_REQUESTS.logged_in : MAX_REQUESTS.not_logged_in
  
  if (requestTimestamps.length >= limit) {
    // Calculate how long to wait until the oldest request is older than 1 minute
    const oldestRequest = requestTimestamps[0]
    const waitTime = 60000 - (Date.now() - oldestRequest) + 100 // +100ms buffer
    await new Promise((resolve) => setTimeout(resolve, waitTime))
    
    // Recursively check again after waiting
    return waitForRateLimit()
  }
}

async function fetchArena(route: string, retry = 0): Promise<Response> {
  const BaseURL = "https://api.are.na/v2/"

  try {
    await waitForRateLimit()
    requestTimestamps.push(Date.now())

    const r = await fetch(BaseURL + route)

    if (r.ok) return r

    if ((r.status === 504 || r.status === 500) && retry < MAX_RETRIES) {
      await delay(RETRY_TIMEOUT)
      return fetchArena(route, retry + 1)
    }

    console.error("HTTP error:", r.status, r.statusText)
    return r

  } catch (err) {
    // This catches CORS errors + network failures
    if (retry < MAX_RETRIES) {
      await delay(RETRY_TIMEOUT)
      return fetchArena(route, retry + 1)
    }

    throw err
  }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}


// ========================================== ARE.NA AUTH =========================================

const CLIENT_ID = 'OrdORBujGQriu963U--4jJtCP3aeo4m5unixjW6T-u8'

export async function getArenaToken(): Promise<string | null> {
  const redirectUri = browser.identity.getRedirectURL()

  const token = await storage.getItem<string>('local:token')
  if (token) return token

  const state = crypto.randomUUID()
  await storage.setItem('local:arenaState', state);

  const authUrl =
    `https://dev.are.na/oauth/authorize` +
    `?response_type=code` +
    `&client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`;

  const redirectUrl = await browser.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true
  });

  if (!redirectUrl) return null
  const url = new URL(redirectUrl)
  const code = url.searchParams.get("code")
  const returnedState = url.searchParams.get("state")

  const arenaState = await storage.getItem<string>('local:arenaState')
  if (!code || returnedState !== arenaState) {
    throw new Error("OAuth failed, wrong state");
  }

  const tokenRes = await fetch("https://dev.are.na/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code,
      redirect_uri: redirectUri
    })
  });

  const { access_token } = await tokenRes.json();
  if (!access_token) throw new Error("No access token");

  loggedIn = true

  await storage.setItem('local:token', access_token);
  return access_token;
}