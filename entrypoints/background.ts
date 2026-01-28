import { Message, ArenaBlock, ArenaChannel, Station } from "@/types"
import { isSameRoute } from "@/utils/compareRoute"

export default defineBackground(() => {
  let lineIndex = 0
  let stations: any[] = []

  browser.runtime.onMessage.addListener(handleMessages)
  storage.setItem('local:commuting', false)

  // ==================================== MESSAGE HANDLER ===============================================

  function handleMessages(message: Message, _sender: any, sendResponse: Function) {
    switch (message.type) {
      case "start":
        startLine(message.value.line, message.value.url, message.value.direction)
        break
      case "fetchLines":
        getLines(message)
        break
      case "getLineContents":
        getLineContentsHandler(message.value.slug, message.value.length, sendResponse)
        return true
      default:
        console.error("unknown message type")
    }
  }

  async function startLine(line: any, url: string, direction: string) {
    // set currentLine in store for content script to diplay while commuting
    await storage.setItem('local:currentLine', line)
    await storage.setItem('local:direction', direction)
    await storage.setItem('local:commuting', true)

    // i know this is ugly, but i havent figured out a way to have the lineIndex stay the same for all requests except like this for now
    lineIndex = 0

    // only use Links (no images, pdfs etc.)
    stations = line.contents.filter((content: any) => content.class === 'Link')

    // our departure station based on the current url
    const stationIndex = stations.findIndex(station => isSameRoute(station.source?.url, url))
    if(stationIndex < 0) {
      console.error("Couldnt find station with this url in line", url)
    }

    // depending on which direction we're going we cut the rest of the array and reverse it for going the other direction
    if (direction === 'forwards') {
      stations = stations.slice(stationIndex)
    } else {
      stations = stations.slice(0, stationIndex + 1).reverse()
    }

    // start the commute
    timeOutLoopArray(stations.length, async (i: number) => {
      const query = await browser.tabs.query({active: true})
      const activeTab = query[0]
      if (activeTab.id) browser.tabs.update(activeTab.id, { url: stations[i].source.url })
    })
  }

  async function timeOutLoopArray(length: number, f: Function) {
    lineIndex++
    // if leave button was pressed or we stopped for another reason -> stop loop
    const isCommuting: boolean = await storage.getItem<boolean | null>('local:commuting') || false 

    // calculate new Values for timeout in case popup sliders have been changed
    const funMode: boolean = await storage.getItem<boolean>('local:funMode') || false

    const commutingTime: number = (funMode ? await storage.getItem<number | null>('local:commutingTime') || 10 : 2) * 1000
    const restingTime: number = (await storage.getItem<number | null>('local:restingTime') || 15) * 1000
    const delay = restingTime + commutingTime

    if (lineIndex < length && isCommuting) {
      // the first station has to wait for the leaving animation to finish then navigate away
      if(lineIndex === 1) {
        setTimeout(async () => {
          await f(lineIndex)
          setTimeout(() => timeOutLoopArray(length, f), delay)
        }, commutingTime)
      } else {
        await f(lineIndex)
        setTimeout(() => timeOutLoopArray(length, f), delay)
      }
    } else {
      await storage.setItem('local:commuting', false)
      await storage.setItem('local:currentLine', null)
      lineIndex = 0
    }
  }

  // get blocks from arena channel and send response via messages
  function getLineContentsHandler(slug: string, channelLength: number, sendResponse: Function) {
    getChannelContents(slug, channelLength).then(d => sendResponse(d))
  }

  // =========================================== DATA RETRIEVAL ============================================
  // get arena channels for a site based on their title and if we're commuting also the channels for the
  // block in the current channel
  async function getLines(message: Message) {
    const query = await browser.tabs.query({active: true})
    const activeTab = query[0]
    const firstPromises: any[]= []
    const station = await getStationByUrl(message.value.url)
    console.log(station)
    if (await storage.getItem('local:commuting') && activeTab.id) {
      firstPromises.push(
        getCurrentStationLines(activeTab.id)
      )
    } else if (station && activeTab.id) {
      sendStoredStationLines(activeTab.id, station.channels)
    }
    if (activeTab.id && !station) {
      firstPromises.push(
        getStationLinesByTitle(message, activeTab.id)
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

  async function getChannelContents(slug: string, channelLength: number) {
    const channel: any = await storage.getItem(`local:channel-contents-${slug}`)
    if (channel) return channel.data
    const fetched = await fetchChannelContents(slug, channelLength)
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
    return await fetch(`http://api.are.na/v2/search/blocks?q=${searchTerm}&per=100`).then(r => r.json())
  }

  async function fetchBlockChannels(id: number) {
    const blockChannels = await fetch(`http://api.are.na/v2/blocks/${id}/channels`).then(r => r.json())
    return blockChannels
  }

  async function fetchChannelContents(slug: string, channelLength: number) {
    const per = 30
    const pages = Math.ceil(channelLength / per)
    console.log(`fetching ${pages} pages`)
    const promises: Promise<any>[] = []
    for (let i = 1; i <= pages; i++) {
      promises.push(
        Promise.resolve(() => {
          setTimeout(() => {}, i * 30)
        }).then(() => {
          return fetch(`http://api.are.na/v2/channels/${slug}/contents?per=${per}&page=${i}`)
        }).then(r => r.json())
      )
    }
    return await Promise.all(promises)
      .then(d => {
        return d.map(r => r.contents).flat()
      })
  }
})

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

// ======================================= type conversion helper ===================================
function blockToStation(block: ArenaBlock): Station{
  return {
    id: block.id,
    title: block.title,
    generated_title: block.generated_title,
    class: block.class,
    description: block.description,
    source: block.source || { url: '' },
    image: block.image,
    channels: block.channels || [],
    searched_ids: [block.id]
  }
}