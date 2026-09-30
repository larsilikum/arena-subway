import type { ArenaBlock, ArenaChannel, Message } from '@/types'
import { isSameRoute } from '@/utils'
import { getArenaToken, isLoggedIn } from './arena-client'
import { getChannelContents, getLine, getLines } from './storage'

export default defineBackground(() => {
  // init loggedIn value
  const _ = isLoggedIn()

  let lineIndex = 0
  // stores boolean if url is to be skipped without animation (domain not found by dns or 404 error)
  const tabSkipStationNoAnimation = new Map()
  // stores boolean if goToNextStation was clicked in content script. Here with commuting animation
  const tabSkipStation = new Map()
  let stations: ArenaBlock[] = []

  browser.webRequest.onErrorOccurred.addListener(
    (details) => {
      console.log('Request error for:', details.url, 'Error:', details.error)
      if (
        details.error === 'net::ERR_NAME_NOT_RESOLVED' ||
        details.error === 'NS_ERROR_UNKNOWN_HOST'
      ) {
        console.log('Domain not found')
        tabSkipStationNoAnimation.set(details.tabId, true)
      }
    },
    { urls: ['<all_urls>'] }
  )

  browser.webRequest.onCompleted.addListener(
    (details) => {
      if (details.statusCode === 404) {
        console.log('404 error')
        tabSkipStationNoAnimation.set(details.tabId, true)
      }
    }, // function
    {
      urls: ['<all_urls>'],
      types: ['main_frame'],
    }, //  object
    ['responseHeaders'] //  optional array of strings
  )

  // TODO: get modeTimes and funMode from storage if they exist
  const modeTimes = {
    leaving: 2000,
    commuting: 10000,
    arriving: 2000,
    resting: 30000,
  }
  // popup config
  let funMode: boolean = false

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

  // only set enabled when there is none
  storage.getItem<boolean>('local:enabled').then((enabled: boolean | null) => {
    if (enabled === null) {
      storage.setItem('local:enabled', false)
    }
  })

  // storage.setItem('local:mode', "idle")

  // commuting value
  // storage.setItem('local:commuting', false)

  browser.runtime.onMessage.addListener(handleMessages)

  // ==================================== MESSAGE HANDLER ===============================================

  function handleMessages(
    message: Message,
    sender: Browser.runtime.MessageSender,
    sendResponse: Function
  ) {
    switch (message.type) {
      case 'authorize':
        getArenaToken()
        break
      case 'getTabId':
        sendResponse(sender.tab?.id)
        return true
      case 'start':
        startLine(
          message.value.line,
          message.value.url,
          message.value.direction,
          message.value.fromArena,
          sender.tab
        )
        break
      case 'updateLine':
        constructLine(
          message.value.line,
          // we don't use the url when updating
          '',
          message.value.fromArena,
          sender.tab
        )
        break
      case 'goToNextStation':
        tabSkipStation.set(sender.tab?.id, true)
        break
      case 'skipStationAtId':
        tabSkipStation.set(message.value.id, true)
        break
      case 'getLine':
        getLine(message.value.slug, sender.tab)
        break
      case 'fetchLines':
        getLines(message, sender.tab, stations[lineIndex])
        break
      case 'getLineContents':
        getChannelContents(
          message.value.slug,
          message.value.page,
          sender.tab?.id || -1
        )
        break
      default:
        console.error('unknown message type', message.type)
    }
  }

  // this function is responsible to create the line for the commuting logic. It creates the line when starting a ride but also updates the line once we fetch more content.
  async function constructLine(
    line: ArenaChannel,
    url: string,
    fromArena: boolean,
    tab: Browser.tabs.Tab | undefined
  ) {
    if (!tab || !line.contents) return
    // set currentLine in store for content script to diplay while commuting
    await storage.setItem(`local:currentLine:${tab.id}`, line)

    // we want to get the direction from storage so we can also use this function when already commuting and just updating the line with new stations
    const direction = await storage.getItem(`local:direction:${tab.id}`)

    // only use Links (no images, pdfs etc.)
    const contentsArray = line.contents
    let newStations = contentsArray.filter(
      (content): content is ArenaBlock => content.type === 'Link'
    )
    if (newStations.length === 0) return

    // our departure station based on the current url
    let stationIndex: number = 0

    // if we are already commuting (stations is filled) we want to search for the old start url instead of the url from the current station.
    const startUrl = stations.length ? stations[0].source?.url : url

    // if we dont start from an arena channel, we need to find where we are on the line and cut the stations in the other direction
    if (!fromArena) {
      // get station index of the current url
      stationIndex = 0
      stationIndex = newStations.findIndex(
        (station) =>
          station.source && isSameRoute(station.source?.url, startUrl || '')
      )
      if (stationIndex < 0) {
        console.error('Couldnt find station with this url in line', startUrl)
      }
      // depending on which direction we're going we cut the rest of the array and reverse it for going the other direction
      if (direction === 'forwards') {
        newStations = newStations.slice(stationIndex)
      } else {
        newStations = newStations.slice(0, stationIndex + 1).reverse()
      }
    } else {
      // if we start from arena we only can go forwards or backwards through all stations
      if (direction === 'backwards') {
        newStations = newStations.reverse()
      }
    }
    // update the stations array
    stations = newStations
  }

  async function startLine(
    line: ArenaChannel,
    url: string,
    direction: string,
    fromArena: boolean,
    tab: Browser.tabs.Tab | undefined
  ) {
    if (!tab || !line.contents) return

    await storage.setItem(`local:direction:${tab.id}`, direction)
    await storage.setItem(`local:commuting:${tab.id}`, true)

    const currentIndex = line.contents.findIndex(
      (station) =>
        station.type !== 'Channel' &&
        station.source &&
        isSameRoute(station.source.url, url)
    )
    await storage.setItem(`local:currentIndex:${tab.id}`, currentIndex)

    // in commutingCascade we first increment the lineIndex, so starting from a station will arrive at index 1 of stations, while fromArena will arrive at index 0 from stations, as we depart from the arena page, which is not a station in the line.
    lineIndex = 0
    if (fromArena) lineIndex = -1

    await constructLine(line, url, fromArena, tab)

    commutingCascade(tab, async (i: number) => {
      const currLine = await storage.getItem<ArenaChannel>(
        `local:currentLine:${tab.id}`
      )
      const contents = currLine?.contents || []
      await storage.setItem(
        `local:currentIndex:${tab.id}`,
        contents.findIndex(
          (s) =>
            s.type !== 'Channel' &&
            isSameRoute(s.source?.url || '', stations[i].source?.url || '_')
        )
      )
      await browser.tabs.update(tab.id, { url: stations[i].source?.url })
    })
  }

  async function commutingCascade(tab: Browser.tabs.Tab, f: Function) {
    const isCommuting = await storage.getItem(`local:commuting:${tab.id}`)
    if (lineIndex < stations.length - 1 && isCommuting) {
      // if animation should be played we set to false here else before going to next url
      tabSkipStation.set(tab.id, false)
      await secondLoopModeUpdate('leaving', tab)
      if (funMode) await secondLoopModeUpdate('commuting', tab)
      if (funMode) await secondLoopModeUpdate('arriving', tab)
      lineIndex++

      // reset tabSkipStation for next page
      tabSkipStationNoAnimation.set(tab.id, false)
      await f(lineIndex)
      // we also rest at the last station, so we get at least the commuting line in content script.
      // could maybe be handled in a better way
      // if (lineIndex !== stations.length - 1)
      await secondLoopModeUpdate('resting', tab)
      commutingCascade(tab, f)
    } else {
      lineIndex = 0
      stations = []
      await storage.setItem(`local:currentLine:${tab.id}`, null)
      await storage.setItem(`local:currentIndex:${tab.id}`, null)
      await storage.setItem(`local:mode:${tab.id}`, 'idle')
      await storage.setItem(`local:commuting:${tab.id}`, false)
      return
    }
  }

  async function secondLoopModeUpdate(
    mode: 'leaving' | 'commuting' | 'arriving' | 'resting',
    tab: Browser.tabs.Tab,
    elapsedTime: number = 0
  ) {
    const isCommuting = await storage.getItem(`local:commuting:${tab.id}`)
    const skipping =
      tabSkipStation.get(tab.id) || tabSkipStationNoAnimation.get(tab.id)
    if (!isCommuting || skipping) return
    if (elapsedTime === 0) await storage.setItem(`local:mode:${tab.id}`, mode)
    return new Promise((resolve) => {
      setTimeout(async () => {
        const time: number = modeTimes[mode]
        if (!time) resolve('mode doesnt exist')
        if (mode === 'resting')
          await storage.setItem(
            `local:timeToDeparture:${tab.id}`,
            time - elapsedTime
          )
        if (elapsedTime < time) {
          await secondLoopModeUpdate(mode, tab, elapsedTime + 1000)
        }
        resolve('next')
      }, 1000)
    })
  }
})
