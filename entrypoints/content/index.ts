import { ContentScriptContext } from "#imports"
import { Message } from "@/types"
import App from "./App.vue"
import { createApp } from "vue"
import './style.css'

export default defineContentScript({
  matches: ["*://*/*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    const ui = await defineOverlay(ctx)

    ui.mount()

    ctx.addEventListener(window, "wxt:locationchange", _event => {
      ui.mount()
    })

    browser.runtime.onMessage.addListener(handleMessages)
  }
})

function defineOverlay(ctx: ContentScriptContext) {
  return createShadowRootUi(ctx, {
    name: "subway-overlay",
    position: "modal",
    zIndex: 999,
    onMount(container, _shadow, shadowHost) {
      const app = createApp(App)
      app.mount(container)
      shadowHost.style.pointerEvents = "none"
      return app
    },
    onRemove(app) {
      app?.unmount()
    }
  })
}

function handleMessages(message: Message) {
  switch (message.type) {
    case "navigate":
      window.location.href = message.value.url
      break
    default:
      console.error("Unknown message type")
  }
}

