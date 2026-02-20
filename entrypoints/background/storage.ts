import { ArenaBlock, ArenaChannel, Station, Message } from "@/types"
import { apiChannelToArenaChannel, blockToStation } from "@/types/type_conversions"
import { fetchBlockChannels, fetchChannel, fetchChannelContents, fetchSearchBlocks, isLoggedIn } from "./arena-client"


// ============================================== storage wrapper =================================================
// get Channel when we are on arena channel page
export async function getLine(slug: string, tab: Browser.tabs.Tab | undefined) {
  if(!tab || !tab.id) return
  // search channel in storage
  let channel:ArenaChannel | null
  channel = await getChannelBySlug(slug)
  // fetch channel if it isnt found in storage
  if (!channel) {
    const response: ArenaChannel = await fetchChannel(slug)
    channel = apiChannelToArenaChannel(response)
    // channel.contents = await getChannelContents(slug, channel.length, channel.contents || [])
    // store channel
    await addChannelToStorage(channel)
  }
  // send channel to tab which requested
  browser.tabs.sendMessage(tab.id, {
    type: "arenaChannelReceived",
    value: {
      channel
    }
  })
}

// get arena channels for a site based on their title and if we're commuting also the channels for the
// block in the current channel
export async function getLines(message: Message, tab: Browser.tabs.Tab | undefined, currentStation: ArenaBlock) {
  if (!tab) return
  const firstPromises: any[]= []
  const station = await getStationByUrl(message.value.url)
  if (await storage.getItem(`local:commuting:${tab.id}`) && tab.id) {
    firstPromises.push(
      getCurrentStationLines(tab.id, currentStation)
    )
  } else if (station && tab.id) {
    sendStoredStationLines(tab.id, station.channels)
  }
  if (tab.id && !station) {
    firstPromises.push(
      getStationLinesByTitle(message, tab.id)
    )
  }
  if (firstPromises.length) Promise.allSettled(firstPromises)
}

function sendStoredStationLines(activeTabId: number, channels: ArenaChannel[]) {
  browser.tabs.sendMessage(activeTabId, { type: "channelsReceived", channels})
}

// get channels of block from current channel
function getCurrentStationLines(activeTabId: number, currentStation: ArenaBlock) {
  getBlockChannels(currentStation)
    .then(d => {
      browser.tabs.sendMessage(activeTabId, { type: "channelsReceived", channels: d })
    })
}

// get channels based on title of page
export function getStationLinesByTitle(message: Message, activeTabId: number) {
  fetchSearchBlocks(message.value.title)
    .then(async d => {
      let filtered: ArenaBlock[] = d.blocks.filter((block: ArenaBlock) => block.source && isSameRoute(block.source.url, message.value.url))
      console.log(d, message.value.url)
      console.log("filtered blocks count: ", filtered.length)

      // only fetch a maximum of 10 blocks to reduce requests to arena
      if(!(await isLoggedIn())) filtered.splice(10)

      if (filtered.length) {
        const promises: Promise<any>[] = []
        for(let i = 0; i < filtered.length; i++) {
          const block = filtered[i]          
          promises.push(
            // Dont fetch everything simultaneously
            Promise.resolve(() => {
              setTimeout(() => {}, 200)
            }).then(() => {
              getBlockChannels(block)
                .then((d) => {
                  browser.tabs.sendMessage(activeTabId, { type: "channelsReceived", channels: d })
                })
            })
          )
        }
        Promise.allSettled(promises).catch(error => console.error(error))
      }
    })
    .catch(e => {
      console.error(e)
    })
}

export async function getBlockChannels(block: ArenaBlock): Promise<ArenaChannel[]> {
  const b = await getStationById(block.id)
  if (b) return b.channels
  const fetched = await fetchBlockChannels(block.id)
  const newBlock = block
  newBlock.channels = fetched.channels
  await addBlockToStorage(newBlock)
  return fetched.channels
}

export async function getChannelContents(slug: string, channelLength: number, contentsFetched: (ArenaBlock | ArenaChannel)[] = [], activeTabId: number) {
  const channel: any = await cacheGet(`channelContents:${slug}`)
  if (channel) {
    browser.tabs.sendMessage(activeTabId, { type: "channel-contents", value: { contents: channel.data, page: 1, per: channel.data.length, contentLength: channel.length }})
    return
  }
  // reverse fetched data to have newest blocks in the beginning
  const fetched = (await fetchChannelContents(slug, channelLength, contentsFetched, activeTabId))
  try {
    await cacheSet(`channelContents:${slug}`, { data: fetched })
  }
  catch (error) {
    console.error(error)
  }
}

// ========================================== STORAGE Interactions =====================================

async function getStationById(id: number) {
  const block = await cacheGet<Station>(`stations:${id}`)
  if (block) return block
  const blockId = await cacheGet<number>(`stations_same_url:${id}`)
  if (blockId) return await cacheGet<Station>(`stations:${blockId}`)
  return null
}

async function getStationByUrl(url: string) {
  const id = await cacheGet<number>(`stations_url:${urlToStorageUrl(url)}`)
  return await cacheGet<Station>(`stations:${id}`)
}

async function getChannelBySlug(slug: string) {
  return await cacheGet<ArenaChannel>(`channel:${slug}`)
}

const urlLocks = new Map<string, Promise<void>>()

async function addBlockToStorage(block: ArenaBlock) {
  const station: Station = blockToStation(block)
  const urlKey = urlToStorageUrl(station.source.url)

  // Chain onto any existing write for this URL, or start fresh
  const prev = urlLocks.get(urlKey) ?? Promise.resolve()
  const next = prev.then(async () => {
    const existingStation = await getStationByUrl(station.source.url)
    if (existingStation) {
      existingStation.channels.push(...station.channels)
      const channelMap = new Map(existingStation.channels.map(c => [c.id || c.slug, c]))
      existingStation.channels = Array.from(channelMap.values())

      await cacheSet(`stations_same_url:${station.id}`, existingStation.id)
      await cacheSet(`stations:${existingStation.id}`, existingStation)
    } else {
      await cacheSet(`stations:${station.id}`, station)
      await cacheSet(`stations_url:${urlKey}`, station.id)
    }
  })

  urlLocks.set(urlKey, next.catch(() => {})) // don't let a failure poison the chain
  return next
}

async function addChannelToStorage(channel: ArenaChannel) {
  await cacheSet(`channel:${channel.slug}`, channel)
}

function urlToStorageUrl(url: string): string {
  return new URL(url).hostname + new URL(url).pathname
}


// =================================== cache storage wrapper ================================================

const MAX_CACHE_SIZE = 8 * 1024 * 1024 // 8MB safety threshold
const CACHE_PREFIX = 'local:cache:'
const CACHE_KEYS_KEY = 'local:__cacheKeys'

const memoryCache = new Map<string, any>()

function buildKey(key: string): StorageItemKey {
  return `${CACHE_PREFIX}${key}`
}

async function registerCacheKey(fullKey: string) {
  const keys = (await storage.getItem<string[]>(CACHE_KEYS_KEY)) || []

  if (!keys.includes(fullKey)) {
    keys.push(fullKey)
    await storage.setItem(CACHE_KEYS_KEY, keys)
  }
}

async function unregisterCacheKey(fullKey: string) {
  const keys = (await storage.getItem<string[]>(CACHE_KEYS_KEY)) || []

  const next = keys.filter(k => k !== fullKey)
  await storage.setItem(CACHE_KEYS_KEY, next)
}

async function cacheGet<T>(key: string): Promise<T | null> {
  const fullKey = buildKey(key)

  if (memoryCache.has(fullKey)) {
    return memoryCache.get(fullKey)
  }

  const value = await storage.getItem<T>(fullKey)
  if (!value) return null

  memoryCache.set(fullKey, value)

  await storage.setMeta(fullKey, {
    lastAccessed: Date.now()
  })

  return value
}

async function cacheSet<T>(key: string, value: T) {
  const fullKey = buildKey(key)

  const serialized = JSON.stringify(value)
  const size = serialized.length

  await storage.setItem(fullKey, value)

  await storage.setMeta(fullKey, {
    lastAccessed: Date.now(),
    size
  })

  memoryCache.set(fullKey, value)

  await registerCacheKey(fullKey)

  await pruneIfNeeded()
}

async function pruneIfNeeded() {
  const keys = (await storage.getItem<StorageItemKey[]>(CACHE_KEYS_KEY)) || []

  if (keys.length === 0) return

  let totalSize = 0
  const entries: {
    key: StorageItemKey
    size: number
    lastAccessed: number
  }[] = []

  // Gather metadata
  for (const key of keys) {
    const meta = await storage.getMeta(key)
    if (!meta?.size) continue

    totalSize += meta.size as number

    entries.push({
      key,
      size: meta.size as number,
      lastAccessed: meta.lastAccessed as number || 0
    })
  }
  console.log(totalSize)
  if (totalSize <= MAX_CACHE_SIZE) return

  // Sort oldest first
  entries.sort((a, b) => a.lastAccessed - b.lastAccessed)

  for (const entry of entries) {
    if (totalSize <= MAX_CACHE_SIZE) break

    await storage.removeItem(entry.key)
    await storage.removeMeta(entry.key)
    await unregisterCacheKey(entry.key)

    memoryCache.delete(entry.key)

    totalSize -= entry.size
  }
}
