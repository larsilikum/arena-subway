import { Message } from "@/types"

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(handleMessages)

  function handleMessages(message: Message, _sender: any, sendResponse: Function) {
    switch (message.type) {
      case "start":
        startLine(message.value.id)
        return true
      case "fetchLines":
        fetch(`http://api.are.na/v2/search/blocks?q=${message.value.title}`)
          .then(r => r.json())
          .then(d => {
            console.log(d)
            if (d.blocks.length) {
              fetch(`http://api.are.na/v2/blocks/${d.blocks[0].id}/channels`)
                .then(r => r.json())
                .then(d => sendResponse(d))
            } else {
              return null
            }
          })
        return true
      default:
        console.error("unknown message type")
    }
  }

  async function startLine(slug: string) {
    const res = await fetch(`http://api.are.na/v2/channels/${slug}/contents`)
    const channel = await res.json()
    const stations = channel.contents.filter((content: any) => content.class === 'Link')

    timeOutLoopArray(stations.length, 10000, async (i: number) => {
      const query = await browser.tabs.query({active: true})
      const activeTab = query[0]
      if (activeTab.id) browser.tabs.sendMessage(activeTab.id, { type: "navigate", value: { url: stations[i].source.url }})
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
