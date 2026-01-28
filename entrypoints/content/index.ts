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

  const patched = new WeakSet<CSSStyleSheet>()

  function patchStylesheets() {
    for (const sheet of document.styleSheets) {
      if (patched.has(sheet)) continue

      let rules
      try {
        rules = sheet.cssRules
      } catch {
        continue
      }

      for (const rule of rules) {
        if (!(rule instanceof CSSStyleRule)) continue

        const props = Array.from(rule.style)

        for (const prop of props) {
          const value = rule.style.getPropertyValue(prop)
          if (!value.includes('vh')) continue

          rule.style.setProperty(
            prop,
            value
              .replaceAll('100vh', 'var(--vh-safe)')
              .replaceAll('100svh', 'var(--vh-safe)')
              .replaceAll('100dvh', 'var(--vh-safe)'),
            rule.style.getPropertyPriority(prop),
          )
        }
      }

      patched.add(sheet)
    }
  }

  patchStylesheets()

  new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (n.nodeName === 'STYLE' || n.nodeName === 'LINK') {
          patchStylesheets()
          return
        }
      }
    }
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
  })


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

  const injectedCssUrl = browser.runtime.getURL('/css/injected.css')
  const injectedCssLink = document.createElement('link')
  injectedCssLink.href = injectedCssUrl
  injectedCssLink.rel = 'stylesheet'
  document.head.prepend(injectedCssLink)

  // https://stackoverflow.com/questions/35054777/get-all-elements-with-positionfixed-in-an-html-page#35055063
  const all = [...document.body.querySelectorAll("*")]
  const fixedElements: Element[] = []


  all.forEach(
    x => {
      const style = getComputedStyle(x, null)
      if (style.getPropertyValue("position") === "fixed") {
        fixedElements.push(x)
      }
    }
  );

  fixedElements.forEach(el => {
    const element = el as HTMLElement
    if (!element) return
    element.style.top = parseFloat(getComputedStyle(el, null).getPropertyValue("top")) + 32 + 'px'
  })


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
    onMount(container, _shadow, shadowHost) {
      if(!document.querySelector("#subway-extension-body-replacement")) {       
        const wrapper = document.createElement('div');
        wrapper.id = "subway-extension-body-replacement"
        wrapper.style.cssText = `
              position: fixed;
              top: 32px;
              left: 0;
              right: 0;
              bottom: 0;
              overflow: auto;
            `;
  
        // Move all body content into wrapper
        while (document.body.firstChild) {
          wrapper.appendChild(document.body.firstChild);
        }
        document.body.appendChild(wrapper);

        new MutationObserver((mutations) => {
          for (const m of mutations) {
            for (const n of m.addedNodes) {
              if(!(n instanceof Element)) continue
              if(n.id === "subway-extension-body-replacement") continue
              wrapper.appendChild(n)
            }
          }
        }).observe(document.body, {
          childList: true,
        })
      }
      
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


