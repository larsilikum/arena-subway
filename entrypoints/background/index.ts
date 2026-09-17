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

  storage.setItem('local:enabled', true)

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

  async function startLine(
    line: ArenaChannel,
    url: string,
    direction: string,
    fromArena: boolean,
    tab: Browser.tabs.Tab | undefined
  ) {
    if (!tab || !line.contents) return
    // set currentLine in store for content script to diplay while commuting
    await storage.setItem(`local:currentLine:${tab.id}`, line)
    await storage.setItem(`local:direction:${tab.id}`, direction)
    await storage.setItem(`local:commuting:${tab.id}`, true)

    // i know this is ugly, but i havent figured out a way to have the lineIndex stay the same for all requests except like this for now
    // this will be automatically updated to 0 in the commutingCascade
    lineIndex = -1

    // only use Links (no images, pdfs etc.)
    const contentsArray = Array.from(line.contents.values()).flat()
    stations = contentsArray.filter(
      (content): content is ArenaBlock => content.type === 'Link'
    )
    if (stations.length === 0) return

    // our departure station based on the current url
    let stationIndex: number = 0

    // if we dont start from an arena channel, we need to find where we are on the line and cut the stations in the other direction
    if (!fromArena) {
      // start from the next station after the current, will be 1 when navigating to the first station on the line
      lineIndex = 0
      // get station index of the current url
      stationIndex = 0
      stationIndex = stations.findIndex(
        (station) => station.source && isSameRoute(station.source?.url, url)
      )
      if (stationIndex < 0) {
        console.error('Couldnt find station with this url in line', url)
      }
      // depending on which direction we're going we cut the rest of the array and reverse it for going the other direction
      if (direction === 'forwards') {
        stations = stations.slice(stationIndex)
      } else {
        stations = stations.slice(0, stationIndex + 1).reverse()
      }
    } else {
      // if we start from arena we only can go forwards or backwards through all stations
      if (direction === 'backwards') {
        stations = stations.reverse()
      }
    }

    commutingCascade(stations.length, tab, async (i: number) => {
      await storage.setItem(
        `local:currentIndex:${tab.id}`,
        contentsArray.findIndex(
          (s) =>
            s.type !== 'Channel' &&
            isSameRoute(s.source?.url || '', stations[i].source?.url || '_')
        )
      )
      await browser.tabs.update(tab.id, { url: stations[i].source?.url })
    })
  }

  async function commutingCascade(
    length: number,
    tab: Browser.tabs.Tab,
    f: Function
  ) {
    const isCommuting = await storage.getItem(`local:commuting:${tab.id}`)
    if (lineIndex < length - 1 && isCommuting) {
      // if animation should be played we set to false here else before going to next url
      tabSkipStation.set(tab.id, false)
      await secondLoopModeUpdate('leaving', tab)
      if (funMode) await secondLoopModeUpdate('commuting', tab)
      if (funMode) await secondLoopModeUpdate('arriving', tab)
      lineIndex++

      // reset tabSkipStation for next page
      tabSkipStationNoAnimation.set(tab.id, false)
      await f(lineIndex)
      if (lineIndex !== length - 1) await secondLoopModeUpdate('resting', tab)
      commutingCascade(length, tab, f)
    } else {
      lineIndex = 0
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
