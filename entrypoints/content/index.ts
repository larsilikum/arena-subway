import { ContentScriptContext } from "#imports"
import App from "./App.vue"
import { createApp } from "vue"
import './style.css'

export default defineContentScript({
  matches: ["*://*/*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    let enabled = await storage.getItem('local:enabled')
    
    const ui = await defineOverlay(ctx)
    cssShenanigans()
    
    // only run content script when extension is enabled
    if(enabled) {
      ui.mount()
    }

    ctx.addEventListener(window, "wxt:locationchange", _event => {
      if(enabled) ui.mount()
    })

    storage.watch('local:enabled', newVal => {
      if (newVal !== null) {
        enabled = newVal
        if (newVal) {
          ui.mount()
        } else {
          ui.remove()
        }
      }
    })

  }
})

async function cssShenanigans() {
  storage.setItem('local:leaving', false)

  // Load custom font
  const LiberationRegular = browser.runtime.getURL("/fonts/LiberationSans-Regular.ttf")
  const LiberationItalic = browser.runtime.getURL("/fonts/LiberationSans-Italic.ttf")
  const LiberationBold = browser.runtime.getURL("/fonts/LiberationSans-Bold.ttf")
  const LiberationBoldItalic = browser.runtime.getURL("/fonts/LiberationSans-BoldItalic.ttf")
  
  // create a style element
  const fontStyle = document.createElement("style")

  // add font face
  fontStyle.textContent = `
                @font-face {
                  font-family: "Liberation Sans";
                  src: url("${LiberationRegular}");
                  font-weight: 400;
                  font-style: normal;
                }

                @font-face {
                  font-family: "Liberation Sans";
                  src: url("${LiberationItalic}");
                  font-weight: 400;
                  font-style: italic;
                }

                @font-face {
                  font-family: "Liberation Sans";
                  src: url("${LiberationBold}");
                  font-weight: 700;
                  font-style: normal;
                }

                @font-face {
                  font-family: "Liberation Sans";
                  src: url("${LiberationBoldItalic}");
                  font-weight: 700;
                  font-style: italic;
                }
            `
  // append style element to head
  document.head.appendChild(fontStyle)

  const injectedCssUrl = browser.runtime.getURL('/css/injected.css')
  const injectedCssLink = document.createElement('link')
  injectedCssLink.href = injectedCssUrl
  injectedCssLink.rel = 'stylesheet'
  document.head.prepend(injectedCssLink)


}

function defineOverlay(ctx: ContentScriptContext) {
  let unwatch: Function
  return createShadowRootUi(ctx, {
    name: "subway-overlay",
    position: "modal",
    zIndex: 999,
    anchor: "html",
    onMount(container, _shadow, shadowHost) {
      const app = createApp(App)
      app.mount(container)
      shadowHost.style.pointerEvents = "none"
      // add commuting css if commuting is true
      const commutingCssUrl = browser.runtime.getURL('/css/commuting.css')
      const commutingCssLink = document.createElement('link')
      commutingCssLink.href = commutingCssUrl
      commutingCssLink.rel = 'stylesheet'

      browser.runtime.sendMessage({ type: 'getTabId' }).then(tabId => {
        if (!tabId) return
        unwatch = storage.watch(`local:mode:${tabId}`, async (newVal: (string | null)) => {
          if (newVal !== null && newVal === "leaving") {
            document.head.appendChild(commutingCssLink)
          }
        })
      })

      return app
    },
    onRemove(app) {
      unwatch()
      app?.unmount()
    }
  })
}


