import { ContentScriptContext } from "#imports"
import App from "./App.vue"
import { createApp } from "vue"
import './style.css'

export default defineContentScript({
  matches: ["*://*/*"],
  cssInjectionMode: "ui",
  async main(ctx) {

    const ui = await defineOverlay(ctx)
    cssShenanigans()

    ui.mount()

    ctx.addEventListener(window, "wxt:locationchange", _event => {
      ui.mount()
    })

  }
})

function cssShenanigans() {
  storage.setItem('local:leaving', false)

  // Load custom font
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

  const injectedCssUrl = browser.runtime.getURL('/css/injected.css')
  const injectedCssLink = document.createElement('link')
  injectedCssLink.href = injectedCssUrl
  injectedCssLink.rel = 'stylesheet'
  document.head.prepend(injectedCssLink)

  // add commuting css if commuting is true
  const commutingCssUrl = browser.runtime.getURL('/css/commuting.css')
  const commutingCssLink = document.createElement('link')
  commutingCssLink.href = commutingCssUrl
  commutingCssLink.rel = 'stylesheet'

  storage.watch<boolean | null>('local:leaving', async (newVal: (boolean | null), _oldVal) => {
    if (newVal) {
      document.head.appendChild(commutingCssLink)
    } else {
      document.head.removeChild(commutingCssLink)
    }
  })
}

function defineOverlay(ctx: ContentScriptContext) {
  return createShadowRootUi(ctx, {
    name: "subway-overlay",
    position: "modal",
    zIndex: 999,
    anchor: "body",
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


