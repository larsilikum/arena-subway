import { Message } from "@/types"

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(handleMessages)

  function handleMessages(message: Message, _sender: any, sendResponse: Function) {
    switch (message.type) {
      case "start":
        startLine(message.value.id)
        return true
      case "fetchLines":
        fetch(`http://localhost:8102/api/lines?domain=${message.value.domain}`).then(r => r.json()).then(d => sendResponse(d))
        return true
      default:
        console.error("unknown message type")
    }
  }

  async function startLine(id: number) {
    const res = await fetch(`http://localhost:8102/api/line?id=${id}`)
    const line = await res.json()
    const stations = line.stations

    timeOutLoopArray(stations.length, 5000, async (i: number) => {
      const query = await browser.tabs.query({active: true})
      const activeTab = query[0]
      if (activeTab.id) browser.tabs.sendMessage(activeTab.id, { type: "navigate", value: { url: stations[i].url }})
    }, 0)
  }

  function timeOutLoopArray(length: number, delay: number, f: Function, i = 0) {
    console.log(i)
    if (i < length) {
      f(i)
      setTimeout(() => timeOutLoopArray(length, delay, f, i+1), delay)
    }
  }
})
