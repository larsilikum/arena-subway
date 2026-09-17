import type { Block, Channel } from '@aredotna/sdk'
import type { ArenaBlock, ArenaChannel, Message } from '@/types'
import {
  apiBlockToArenaBlock,
  apiChannelToArenaChannel,
} from '@/types/type_conversions'
import {
  fetchBlockChannels,
  fetchChannel,
  fetchChannelContents,
  fetchSearchBlocks,
  isLoggedIn,
  isPremium,
  PER,
} from './arena-client'
import { delay } from '@/utils'
import { useAppConfig } from '#imports'

// ============================================== storage wrapper =================================================
// get Channel when we are on arena channel page
export async function getLine(slug: string, tab: Browser.tabs.Tab | undefined) {
  if (!tab || !tab.id) return
  // search channel in storage
  let channel: ArenaChannel | null
  channel = await getChannelBySlug(slug)
  // fetch channel if it isnt found in storage
  if (!channel) {
    const response: Channel = await fetchChannel(slug)
    channel = apiChannelToArenaChannel(response)
    // channel.contents = await getChannelContents(slug, channel.length, channel.contents || [])
    // store channel
    await addChannelToStorage(channel)
  }
  // send channel to tab which requested
  browser.tabs.sendMessage(tab.id, {
    type: 'arenaChannelReceived',
    value: {
      channel,
    },
  })
}

// get arena channels for a site based on their title and if we're commuting also the channels for the
// block in the current channel
export async function getLines(
  message: Message,
  tab: Browser.tabs.Tab | undefined,
  currentStation: ArenaBlock
) {
  if (!tab || !tab.id) return
  const commuting = await storage.getItem(`local:commuting:${tab.id}`)
  // when we are commuting we dont want to fetch new lines while browsing the current station, we just send the ones from the current station
  if (
    commuting &&
    currentStation.source &&
    !isSameRoute(currentStation.source.url, message.value.url)
  ) {
    const station = await getStationByUrl(currentStation.source.url)
    sendStoredStationLines(tab.id, station?.channels || [])
    return
  }
  const firstPromises: any[] = []
  // get station if we have already been there
  const station = await getStationByUrl(message.value.url)
  // check if this tab is commuting at the moment
  // when we're commuting we might get new channels for an already existing station by checking the blocks channels?
  if (commuting && tab.id) {
    firstPromises.push(getCurrentStationLines(tab.id, currentStation))
  } else if (station && tab.id) {
    sendStoredStationLines(tab.id, station.channels || [])
  }
  // check if the user has premium account, as it is required for using the search endpoint
  if (tab.id && !station && (await isPremium())) {
    firstPromises.push(getStationLinesByTitle(message, tab.id))
  }
  if (firstPromises.length) Promise.allSettled(firstPromises)
}

function sendStoredStationLines(activeTabId: number, channels: ArenaChannel[]) {
  browser.tabs.sendMessage(activeTabId, { type: 'channelsReceived', channels })
}

// get channels of block from current channel and send them to tab
function getCurrentStationLines(
  activeTabId: number,
  currentStation: ArenaBlock
) {
  getBlockChannels(currentStation).then((d) => {
    browser.tabs.sendMessage(activeTabId, {
      type: 'channelsReceived',
      channels: d,
    })
  })
}

// get channels based on title of page
export function getStationLinesByTitle(message: Message, activeTabId: number) {
  fetchSearchBlocks(message.value.title)
    .then(async (d) => {
      // base_type doesnt seem to exist on arena block type
      const convertedBlocks: (ArenaBlock | null)[] = d.data.map((b) =>
        b.type !== 'Channel' && b.type !== 'User' && b.type !== 'Group'
          ? apiBlockToArenaBlock(b)
          : null
      )
      const filtered: (ArenaBlock | null)[] = convertedBlocks.filter(
        (block: ArenaBlock | null) =>
          block &&
          block.source &&
          isSameRoute(block.source.url, message.value.url)
      )

      // only fetch a maximum of 10 blocks to reduce requests to arena
      filtered.splice(10)

      if (filtered.length) {
        let channelAmount = 0
        for (let i = 0; i < filtered.length; i++) {
          const block = filtered[i]
          // null values should never appear here but typescript is not happy otherwise
          if (!block) continue
          const channels = await getBlockChannels(block)
          // only count channels we are going to use
          const shortChannels = channels.filter(
            (channel) =>
              channel.counts.contents < useAppConfig().max_channel_length
          )
          channelAmount += shortChannels.length
          // could also just send the filtered channels, but i think its more readable filtering again in app.vue
          browser.tabs.sendMessage(activeTabId, {
            type: 'channelsReceived',
            channels: channels,
          })
          // we are happy if we have 20 channels and have fetched at least two blocks, we can stop bothering the arena api
          if (channelAmount > 30 && i > 0) break
          // wait 500 ms before doing next request
          await delay(500)
        }
      }
    })
    .catch((e) => {
      console.error(e)
    })
}

export async function getBlockChannels(
  block: ArenaBlock
): Promise<ArenaChannel[]> {
  const b = await getStationById(block.id)
  if (b) return b.channels || []
  const fetched = await fetchBlockChannels(block.id)
  const newBlock = block
  newBlock.channels = fetched.data.map((channel) =>
    apiChannelToArenaChannel(channel)
  )
  await addBlockToStorage(newBlock)
  return newBlock.channels
}

export async function getChannelContents(
  slug: string,
  page: number,
  activeTabId: number
) {
  const channelPage: any = await cacheGet(`channelContents:${slug}:${page}`)
  console.log(channelPage)
  if (channelPage) {
    browser.tabs.sendMessage(activeTabId, {
      type: 'channel-contents',
      value: {
        contents: channelPage.data,
        page,
        per: PER,
        slug,
        next: channelPage.next,
      },
    })
    return
  }
  const fetched = await fetchChannelContents(slug, page, activeTabId)
  try {
    await cacheSet(`channelContents:${slug}:${page}`, {
      data: fetched.data,
      next: fetched.meta.next_page,
    })
  } catch (error) {
    console.error(error)
  }
}

// ========================================== STORAGE Interactions =====================================

async function getStationById(id: number) {
  const block = await cacheGet<ArenaBlock>(`stations:${id}`)
  if (block) return block
  const blockId = await cacheGet<number>(`stations_same_url:${id}`)
  if (blockId) return await cacheGet<ArenaBlock>(`stations:${blockId}`)
  return null
}

async function getStationByUrl(url: string) {
  const id = await cacheGet<number>(`stations_url:${urlToStorageUrl(url)}`)
  return await cacheGet<ArenaBlock>(`stations:${id}`)
}

async function getChannelBySlug(slug: string) {
  return await cacheGet<ArenaChannel>(`channel:${slug}`)
}

const urlLocks = new Map<string, Promise<void>>()

async function addBlockToStorage(block: ArenaBlock) {
  const station: ArenaBlock = block
  const urlKey = urlToStorageUrl(station.source?.url || station.title)

  // Chain onto any existing write for this URL, or start fresh
  const prev = urlLocks.get(urlKey) ?? Promise.resolve()
  const next = prev.then(async () => {
    const existingStation = await getStationByUrl(
      station.source?.url || station.title
    )
    if (existingStation && station.channels) {
      if (!existingStation.channels) existingStation.channels = []
      existingStation.channels.push(...station.channels)
      const channelMap = new Map(
        existingStation.channels.map((c) => [c.id || c.slug, c])
      )
      existingStation.channels = Array.from(channelMap.values())

      await cacheSet(`stations_same_url:${station.id}`, existingStation.id)
      await cacheSet(`stations:${existingStation.id}`, existingStation)
    } else {
      await cacheSet(`stations:${station.id}`, station)
      await cacheSet(`stations_url:${urlKey}`, station.id)
    }
  })

  urlLocks.set(
    urlKey,
    next.catch(() => {})
  ) // don't let a failure poison the chain
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

  const next = keys.filter((k) => k !== fullKey)
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
    lastAccessed: Date.now(),
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
    size,
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
      lastAccessed: (meta.lastAccessed as number) || 0,
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
