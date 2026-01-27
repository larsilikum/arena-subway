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

  }
})

function defineOverlay(ctx: ContentScriptContext) {
  return createShadowRootUi(ctx, {
    name: "subway-overlay",
    position: "modal",
    zIndex: 999,
    onMount(container, _shadow, shadowHost) {
      storage.setItem('local:commuting', false)
      // Load custom font. Don't forget add font to web accessible resources in wxt.config.ts
      const brigadeRegular = browser.runtime.getURL("/fonts/Fundamental_Brigade.ttf")
      const brigadeLight = browser.runtime.getURL("/fonts/Fundamental_Brigade_Schlank.ttf")
      const brigadeBold = browser.runtime.getURL("/fonts/Fundamental_Brigade_Schwer.ttf")
      const brigadeCondensed = browser.runtime.getURL("/fonts/Fundamental_Brigade_Condensed.ttf")

      // create a style element
      const fontStyle = document.createElement("style")

      // add font face
      fontStyle.textContent = `
                  @font-face {
                    font-family: Brigade;
                    src: url("${brigadeRegular}");
                    font-weight: normal;
                  }

                  @font-face {
                    font-family: Brigade;
                    src: url("${brigadeLight}");
                    font-weight: 200;
                  }

                  @font-face {
                    font-family: Brigade;
                    src: url("${brigadeBold}");
                    font-weight: bold;
                  }

                  @font-face {
                    font-family: BrigadeCondensed;
                    src: url("${brigadeCondensed}");
                    font-weight: normal;
                    font-stretch: codensed;
                  }
              `
      // append style element to head
      document.head.appendChild(fontStyle)

      const injectedCssUrl = browser.runtime.getURL('/css/commuting.css')
      const injectedCssLink = document.createElement('link')
      injectedCssLink.href = injectedCssUrl
      injectedCssLink.rel = 'stylesheet'

      const unwatch = storage.watch<boolean | null>('local:commuting', async (newVal: (boolean | null), _oldVal) => {
        if (newVal && !(await storage.getItem('local:instantCommute'))) {
          document.head.appendChild(injectedCssLink)
        } else {
          document.head.removeChild(injectedCssLink)
        }
      })

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


