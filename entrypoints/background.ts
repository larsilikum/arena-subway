import { Message } from "@/types"

export default defineBackground(() => {
  let lineIndex = 0
  let isCommuting = false
  let stations: any[] = []

  browser.runtime.onMessage.addListener(handleMessages)

  function handleMessages(message: Message, _sender: any, sendResponse: Function) {
    switch (message.type) {
      case "start":
        startLine(message.value.line, message.value.url, message.value.direction)
        break
      case "fetchLines":
        fetchLines(message)
        break
      case "getLine":
        fetchLine(message.value.slug, message.value.length, sendResponse)
        return true
      default:
        console.error("unknown message type")
    }
  }

  async function startLine(line: any, url: string, direction: string) {
    // i know this is ugly, but i havent figured out a way to have the lineIndex stay the same for all requests except like this for now
    lineIndex = -1 
    isCommuting = true
    // only use Links (no images, pdfs etc.)
    stations = line.contents.filter((content: any) => content.class === 'Link')
    // our departure station based on the current url
    const stationIndex = stations.findIndex(station => station.source?.url === url)
    if(stationIndex < 0) {
      console.error("Couldnt find station with this url in line")
    }
    // depending on which direction we're going we cut the rest of the array and reverse it for going the other direction
    if (direction === 'forwards') {
      stations = stations.slice(stationIndex)
    } else {
      stations = stations.slice(0, stationIndex).reverse()
    }
    // start the commute
    timeOutLoopArray(stations.length, 15000, async () => {
      const query = await browser.tabs.query({active: true})
      const activeTab = query[0]
      if (activeTab.id) browser.tabs.update(activeTab.id, { url: stations[lineIndex].source.url })
    })
  }

  async function timeOutLoopArray(length: number, delay: number, f: Function) {
    lineIndex++
    console.log(lineIndex)
    if (lineIndex < length) {
      await f(lineIndex)
      setTimeout(() => timeOutLoopArray(length, delay, f), delay)
    } else {
      setTimeout(() => isCommuting = false, delay)
    }
  }
  
  async function fetchLines(message: Message) {
    const query = await browser.tabs.query({active: true})
    const activeTab = query[0]
    const firstPromises: any[]= []
    if (isCommuting && activeTab.id) {
      firstPromises.push(
        fetchCurrentStationLines(activeTab.id)
      )
    }
    if (activeTab.id) {
      firstPromises.push(
        fetchStationLinesByTitle(message, activeTab.id)
      )
    }
    Promise.allSettled(firstPromises)
  }

  const fetchCurrentStationLines = (activeTabId: number) => {
    getBlockChannels(stations[lineIndex].id)
      .then(d => {
        console.log(d)
        browser.tabs.sendMessage(activeTabId, { type: "channelsReceived", channels: d.channels })
      })
  }

  const fetchStationLinesByTitle = (message: Message, activeTabId: number) => {
    getSearchBlocks(message.value.title)
      .then(d => {
        const filtered = d.blocks.filter((block: any) => block.source?.url === message.value.url)
        console.log(d, message.value.url)
        console.log("filtered blocks count: ", filtered.length)
        
        if (filtered.length) {
          const promises: Promise<any>[] = []
          for(const block of filtered) {
            promises.push(
              getBlockChannels(block.id)
                .then(d => {
                  browser.tabs.sendMessage(activeTabId, { type: "channelsReceived", channels: d.channels })
                })
            )
          }
          Promise.allSettled(promises)
        }
      })
      .catch(e => {
        console.error(e)
      })
  }

  function fetchLine(slug: string, channelLength: number, sendResponse: Function) {
    getChannelContents(slug, channelLength).then(d => sendResponse(d))
  }

  // getters
  async function getSearchBlocks(searchTerm: string) {
    const slugifiedTerm = encodeURIComponent(searchTerm)
    const blocks: any = await storage.getItem(`local:block-search-${slugifiedTerm}`)
    if (blocks) return blocks.data
    const fetched = await fetchSearchBlocks(searchTerm)
    await storage.setItem(`local:block-search-${slugifiedTerm}`, { data: fetched })
    return fetched
  }

  async function getBlockChannels(id: number) {
    const block = await storage.getItem(`local:block-channels-${id}`)
    if (block) return block
    const fetched = await fetchBlockChannels(id)
    await storage.setItem(`local:block-channels-${id}`, fetched)
    return fetched
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



  // api calls
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