export default defineContentScript({
  matches: ['*://*/*'],
  async main(ctx) {
    // const ui = await createShadowRootUi(ctx, {
    //   name: 'subway',
    //   position: 'modal',
    //   zIndex: 99999,
    //   anchor: 'body',
    //   onMount: (container) => {
    //     const app = document.createElement('div')
    //     app.textContent = 'test heloo lorem ipsum'
    //     container.append(app)
    //   }
    // })
    // ui.mount()
    const dom = getDomainFromUrl(`${window.location}`)
    
    if (await storage.getItem('local:domain')) {
      await onLocationChange(getDomainFromUrl(dom))
    } else {
      storage.setItem('local:domain', dom)
    }

    ctx.addEventListener(window, 'wxt:locationchange', async ({ newUrl }) => {
      await onLocationChange(getDomainFromUrl(`${newUrl}`))
    });

  },
});

async function onLocationChange(domain: string): Promise<void> {
  if (await storage.getItem('local:domain') === domain) {
    console.log(`we were already on ${domain}`)
  } else {
    console.log("domain changed to:", domain)
    storage.setItem('local:domain', domain)
  }
  const anchors = document.querySelectorAll('a')
  anchors.forEach(a => {
    a.addEventListener('click', async() => {
      console.log(`navigating from ${await storage.getItem('local:domain')} to ${getDomainFromUrl(a.href)}`)
      setTimeout(() => '', 2000)
    })
  })
}

function getDomainFromUrl(url: string): string {
  const regex = /^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i
  const match = url.match(regex)
  return match ? match[1] : '' // Return the domain if found
}