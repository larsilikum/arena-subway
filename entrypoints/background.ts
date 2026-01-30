import { Message, ArenaBlock, ArenaChannel, Station, ArenaSource, ArenaImage, ArenaUser } from "@/types"
import { isSameRoute } from "@/utils/compareRoute"

// how many contents to fetch from a channel at once
const per = 50

// retries
const MAX_RETRIES = 4
const RETRY_TIMEOUT = 100
const MAX_REQUESTS = {
  not_logged_in: 30,
  logged_in: 120
}

const requestTimestamps: number[] = []

export default defineBackground(() => {
  let lineIndex = 0
  // stores boolean if url is to be skipped without animation (domain not found by dns or 404 error)
  const tabSkipStationNoAnimation = new Map()
  // stores boolean if goToNextStation was clicked in content script. Here with commuting animation
  const tabSkipStation = new Map()
  let stations: any[] = []

  browser.webRequest.onErrorOccurred.addListener(
    (details) => {
      console.log('Request error for:', details.url, 'Error:', details.error);
      if (details.error === 'net::ERR_NAME_NOT_RESOLVED') {
        console.log('Domain not found');
        tabSkipStationNoAnimation.set(details.tabId, true)
      }
    },
    { urls: ['<all_urls>'] }
  );

  browser.webRequest.onCompleted.addListener(
    details => {
      if(details.statusCode === 404) {
        console.log('404 error')
        tabSkipStationNoAnimation.set(details.tabId, true)
      }
    },             // function
    {
       urls: ['<all_urls>'],
      types: ['main_frame']
    },               //  object
    ['responseHeaders']       //  optional array of strings
  )

  const modeTimes = {
    "leaving": 2000,
    "commuting": 10000,
    "arriving": 2000,
    "resting": 30000,
  }
  // popup config
  let funMode:boolean = false

  // watch storage for popup config values
  storage.watch('local:commutingTime', (newVal: number | null) => {
    if (newVal !== null) modeTimes.commuting = newVal * 1000
  })
  storage.watch('local:restingTime', (newVal: number | null) => {
    if (newVal !== null) modeTimes.resting = newVal * 1000
  })
  storage.watch('local:funMode', (newVal: boolean | null) => {
    if (newVal !== null) funMode = newVal
  })

  // storage.setItem('local:mode', "idle")

  // commuting value 
  // storage.setItem('local:commuting', false)

  browser.runtime.onMessage.addListener(handleMessages)

  // ==================================== MESSAGE HANDLER ===============================================

  function handleMessages(message: Message, sender: Browser.runtime.MessageSender, sendResponse: Function) {
    switch (message.type) {
      case "getTabId":
        sendResponse(sender.tab?.id)
        return true
      case "start":
        startLine(message.value.line, message.value.url, message.value.direction, message.value.fromArena, sender.tab)
        break
      case "goToNextStation":
        tabSkipStation.set(sender.tab?.id, true)
        break
      case "getLine":
        getLine(message.value.slug, sender.tab)
        break
      case "fetchLines":
        getLines(message, sender.tab)
        break
      case "getLineContents":
        getLineContentsHandler(message.value.slug, message.value.length, sendResponse)
        return true
      default:
        console.error("unknown message type")
    }
  }

  async function startLine(line: any, url: string, direction: string, fromArena: boolean, tab: Browser.tabs.Tab | undefined) {
    if (!tab) return
    // set currentLine in store for content script to diplay while commuting
    await storage.setItem(`local:currentLine:${tab.id}`, line)
    await storage.setItem(`local:direction:${tab.id}`, direction)
    await storage.setItem(`local:commuting:${tab.id}`, true)

    // i know this is ugly, but i havent figured out a way to have the lineIndex stay the same for all requests except like this for now
    // this will be automatically updated to 0 in the timeOutLoopArray
    lineIndex = 0

    // only use Links (no images, pdfs etc.)
    stations = line.contents.filter((content: any) => content.class === 'Link')

    // our departure station based on the current url
    let stationIndex: number = 0

    // if we dont start from an arena channel, we need to find where we are on the line and cut the stations in the other direction
    if (!fromArena) {
      // get station index of the current url
      stationIndex = 0
      stationIndex = stations.findIndex(station => isSameRoute(station.source?.url, url))
      if(stationIndex < 0) {
        console.error("Couldnt find station with this url in line", url)
      }
      // depending on which direction we're going we cut the rest of the array and reverse it for going the other direction
      if (direction === 'forwards') {
        stations = stations.slice(stationIndex + 1)
      } else {
        stations = stations.slice(0, stationIndex).reverse()
      }
    } else {
      // if we start from arena we only can go forwards or backwards through all stations
      if (direction === 'backwards') {
        stations = stations.reverse()
      }
    }

    commutingCascade(stations.length, tab, async (i: number) => {
      await browser.tabs.update(tab.id, { url: stations[i].source.url })
    })

  }

  async function commutingCascade(length: number, tab: Browser.tabs.Tab, f: Function) {
    const isCommuting = await storage.getItem(`local:commuting:${tab.id}`)
    if (lineIndex < length && isCommuting) {
      // if animation should be played we set to false here else before going to next url
      tabSkipStation.set(tab.id, false) 
      await secondLoopModeUpdate("leaving", tab)
      if (funMode) await secondLoopModeUpdate("commuting", tab)
      if (funMode) await secondLoopModeUpdate("arriving", tab)
      lineIndex++
    
      // reset tabSkipStation for next page
      tabSkipStationNoAnimation.set(tab.id, false) 
      await f(lineIndex)
      await secondLoopModeUpdate("resting", tab)
      commutingCascade(length, tab, f)
    } else {
      await storage.setItem(`local:mode:${tab.id}`, "idle")
      return
    }
  }

  async function secondLoopModeUpdate(mode: "leaving" | "commuting" | "arriving" | "resting", tab: Browser.tabs.Tab, elapsedTime: number = 0) {
    const isCommuting = await storage.getItem(`local:commuting:${tab.id}`)
    const skipping = tabSkipStation.get(tab.id) || tabSkipStationNoAnimation.get(tab.id)
    if (!isCommuting || skipping) return
    if (elapsedTime === 0) await storage.setItem(`local:mode:${tab.id}`, mode)
    return new Promise((resolve) => {
      setTimeout(async () => {
        const time: number = modeTimes[mode]
        if (!time) resolve("mode doesnt exist")
        if (mode === "resting") await storage.setItem(`local:timeToDeparture:${tab.id}`, time - elapsedTime)
        if (elapsedTime < time) {
          await secondLoopModeUpdate(mode, tab, elapsedTime + 1000)
        }
        resolve("next")
      }, 1000);
    })
  }

  
  // get blocks from arena channel and send response via messages
  function getLineContentsHandler(slug: string, channelLength: number, sendResponse: Function) {
    getChannelContents(slug, channelLength).then(d => sendResponse(d))
  }
  
  // =========================================== DATA RETRIEVAL ============================================
  // get Channel when we are on arena channel page
  async function getLine(slug: string, tab: Browser.tabs.Tab | undefined) {
    if(!tab || !tab.id) return
    // search channel in storage
    let channel:ArenaChannel | null
    channel = await getChannelBySlug(slug)
    // fetch channel if it isnt found in storage
    if (!channel) {
      const response: ArenaChannel = await fetchChannel(slug)
      channel = apiChannelToArenaChannel(response)
      channel.contents = await getChannelContents(slug, channel.length, channel.contents || [])
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
  async function getLines(message: Message, tab: Browser.tabs.Tab | undefined) {
    if (!tab) return
    const firstPromises: any[]= []
    const station = await getStationByUrl(message.value.url)
    console.log(station)
    if (await storage.getItem(`local:commuting:${tab.id}`) && tab.id) {
      firstPromises.push(
        getCurrentStationLines(tab.id)
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
  function getCurrentStationLines(activeTabId: number) {
    getBlockChannels(stations[lineIndex])
      .then(d => {
        browser.tabs.sendMessage(activeTabId, { type: "channelsReceived", channels: d })
      })
  }

  // get channels based on title of page
  function getStationLinesByTitle(message: Message, activeTabId: number) {
    fetchSearchBlocks(message.value.title)
      .then(d => {
        const filtered: ArenaBlock[] = d.blocks.filter((block: ArenaBlock) => block.source && isSameRoute(block.source.url, message.value.url))
        console.log(d, message.value.url)
        console.log("filtered blocks count: ", filtered.length)
        
        if (filtered.length) {
          const promises: Promise<any>[] = []
          for(const block of filtered) {
            promises.push(
              getBlockChannels(block)
                .then((d) => {
                  browser.tabs.sendMessage(activeTabId, { type: "channelsReceived", channels: d })
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

  async function getBlockChannels(block: ArenaBlock): Promise<ArenaChannel[]> {
    const b = await getStationById(block.id)
    if (b) return b.channels
    const fetched = await fetchBlockChannels(block.id)
    const newBlock = block
    newBlock.channels = fetched.channels
    await addBlockToStorage(newBlock)
    return fetched.channels
  }

  async function getChannelContents(slug: string, channelLength: number, contentsFetched: (ArenaBlock | ArenaChannel)[] = []) {
    const channel: any = await storage.getItem(`local:channel-contents-${slug}`)
    if (channel) return channel.data
    const fetched = await fetchChannelContents(slug, channelLength, contentsFetched)
    try {
      await storage.setItem(`local:channel-contents-${slug}`, { data: fetched })
    }
    catch (error) {
      console.error(error)
    }
    return fetched
  }

  // =========================================== DATA FETCHING ===========================================
  async function fetchSearchBlocks(searchTerm: string) {
    return await fetchArena(`search/blocks?q=${searchTerm}&per=100`).then(r => r.json())
  }

  async function fetchBlockChannels(id: number) {
    const blockChannels = await fetchArena(`blocks/${id}/channels`).then(r => r.json())
    return blockChannels
  }

  async function fetchChannel(slug: string): Promise<ArenaChannel> {
    return await fetchArena(`channels/${slug}?per=${per}`).then(r => r.json())
  }

  async function fetchChannelContents(slug: string, channelLength: number, contentsFetched: (ArenaChannel | ArenaBlock)[] = []) {
    const fetchedLength = contentsFetched.length
    // this only works if fetchedLength is perfectly divideble by per
    const fetchedPages = Math.floor(fetchedLength / per)
    const pages = Math.ceil(channelLength / per)
    console.log(`fetching ${pages} pages`)
    const promises: Promise<any>[] = []
    for (let i = 1 + fetchedPages; i <= pages; i++) {
      promises.push(
        Promise.resolve(() => {
          setTimeout(() => {}, i * 30)
        }).then(async () => {
          return fetchArena(`channels/${slug}/contents?per=${per}&page=${i}`)
            .catch(error => console.log(error)) 
        }).then(r => {
          if(r) {
            return r.json()
          }
          return []
          })
      )
    }
    return await Promise.all(promises)
      .then(d => {
        const contents = d.map((r: ArenaChannel) => parseChannelContents(r.contents)).flat()
        return [...contentsFetched, ...contents]
      })
  }

})

// ============================= custom fetch function with ratelimiting ===================================
  
// Clean up old requests (older than 1 minute)
function cleanOldRequests() {
  const oneMinuteAgo = Date.now() - 60000
  while (requestTimestamps.length > 0 && requestTimestamps[0] < oneMinuteAgo) {
    requestTimestamps.shift()
  }
}

// Check if we can make a request, wait if needed
async function waitForRateLimit(isLoggedIn: boolean = false): Promise<void> {
  cleanOldRequests()
  
  const limit = isLoggedIn ? MAX_REQUESTS.logged_in : MAX_REQUESTS.not_logged_in
  
  if (requestTimestamps.length >= limit) {
    // Calculate how long to wait until the oldest request is older than 1 minute
    const oldestRequest = requestTimestamps[0]
    const waitTime = 60000 - (Date.now() - oldestRequest) + 100 // +100ms buffer
    await new Promise((resolve) => setTimeout(resolve, waitTime))
    
    // Recursively check again after waiting
    return waitForRateLimit(isLoggedIn)
  }
}

async function fetchArena(route: string, retry = 0, isLoggedIn: boolean = false): Promise<Response> {
  const BaseURL = "http://api.are.na/v2/"
  
  // Wait for rate limit before making request
  await waitForRateLimit(isLoggedIn)
  
  // Record this request
  requestTimestamps.push(Date.now())
  
  return fetch(BaseURL + route)
    .then(async (r) => {
      if (r.ok) {
        return r
      } else if (r.status === 504 && retry < MAX_RETRIES) {
        const res = await new Promise<Response>((resolve) => {
          setTimeout(async () => {
            const result = await fetchArena(route, retry + 1, isLoggedIn)
            resolve(result)
          }, RETRY_TIMEOUT)
        })
        return res
      } else {
        console.error("an error occured", r.status, r.statusText)
        return r
      }
    })
}

// ========================================== STORAGE HANDLER =====================================

async function getStationById(id: number) {
  const blocks = await storage.getItem<Station[]>('local:stations')
  if (!blocks) return
  let block = blocks.find(b => b.id === id)
  if (block) return block
  block = blocks.find(b => b.searched_ids.some(i => i === id))
  return block
}

async function getStationByUrl(url: string) {
  const blocks = await storage.getItem<Station[]>('local:stations')
  console.log(blocks, url)
  return blocks?.find(b => isSameRoute(b.source.url, url))
}

async function getChannelBySlug(slug: string) {
  return await storage.getItem<ArenaChannel>(`local:channel-${slug}`)
}

async function addBlockToStorage(block: ArenaBlock) {
  let station: Station = blockToStation(block)
  const stations = await storage.getItem<Station[]>('local:stations')
  if (stations?.length) {
    // if this url has already been searched for before only add channels
    const existingStation = stations.find(s => isSameRoute(s.source.url, station.source.url))
    if (existingStation) {
      existingStation.channels.push(...station.channels)
      // remove duplicates
      const channelMap = new Map(existingStation.channels.map(c => [c.id || c.slug, c]))
      existingStation.channels = Array.from(channelMap.values())
      
      existingStation.searched_ids.push(station.id)
      const index = stations.findIndex(s => isSameRoute(s.source.url, station.source.url))
      stations[index] = existingStation
    } else {
      stations.push(station)
    }
    await storage.setItem('local:stations', stations)
  } else {
    await storage.setItem('local:stations', [station])
  }
}

async function addChannelToStorage(channel: ArenaChannel) {
  await storage.setItem(`local:channel-${channel.slug}`, channel)
}

// ======================================= type conversion helper ===================================
function blockToStation(block: ArenaBlock): Station{
  return {
    id: block.id,
    title: block.title,
    generated_title: block.generated_title,
    class: block.class,
    description: block.description,
    source: apiSourceToArenaSource(block.source),
    image: block.image,
    channels: parseBlockChannels(block.channels),
    searched_ids: [block.id]
  }
}

function apiSourceToArenaSource(source: { url: string } | undefined): ArenaSource {
  return {
    url: source?.url || ''
  }
}

function apiImageToArenaImage(image: { original: ArenaSource } | undefined): ArenaImage | undefined {
  if(!image) return undefined
  return {
    original: apiSourceToArenaSource(image.original)
  }
}

function apiUserToArenaUser(user: ArenaUser): ArenaUser {
  return {
    username: user.username,
    slug: user.slug
  }
}

function apiBlockToArenaBlock(block: ArenaBlock): ArenaBlock{
  return {
    id: block.id,
    title: block.title,
    generated_title: block.generated_title,
    class: block.class,
    description: block.description,
    source: apiSourceToArenaSource(block.source),
    image: apiImageToArenaImage(block.image),
    channels: undefined
  }
}

function apiChannelToArenaChannel(channel: ArenaChannel): ArenaChannel {
  return {
    id: channel.id,
    title: channel.title,
    slug: channel.slug,
    length: channel.length,
    class: channel.class,
    metadata: channel.metadata,
    user: apiUserToArenaUser(channel.user),
    contents: parseChannelContents(channel.contents)
  }
}

function parseChannelContents(contents: (ArenaBlock | ArenaChannel)[] | undefined): (ArenaBlock | ArenaChannel)[] {
  if (!contents) return []
  return contents.map((content: ArenaChannel | ArenaBlock) => content.class === 'Channel' ? apiChannelToArenaChannel(content as ArenaChannel) : apiBlockToArenaBlock(content as ArenaBlock))
}


function parseBlockChannels(channels: ArenaChannel[] | undefined): ArenaChannel[]{
  if (!channels) return []
  return channels.map(channel => apiChannelToArenaChannel(channel))
}