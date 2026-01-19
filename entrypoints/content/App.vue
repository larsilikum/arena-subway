<script lang="ts" setup>
import background from '../background'

  const lines = ref<any[]>([])

  function startRide(slug: string) {
    browser.runtime.sendMessage({ type: "start", value: { slug }})
  }

  function getDomainFromUrl(url: string): string {
    const regex = /^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i
    const match = url.match(regex)
    return match ? match[1] : ''
  }

  // Thanks to clyzermk1 https://stackoverflow.com/questions/11120840/hash-string-into-rgb-color
  function djb2(str: string){
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
    }
    return hash;
  }

  function hashStringToColor(str: string) {
    var hash = djb2(str);
    var r = (hash & 0xFF0000) >> 16;
    var g = (hash & 0x00FF00) >> 8;
    var b = hash & 0x0000FF;
    return "rgb(" + r + "," + g + "," + b + ")"
  }


  onMounted(async () => {
    // const url = window.location.href
    // const domain = getDomainFromUrl(url)
    const title = document.title
    const url = window.location.href
    try {
      browser.runtime.sendMessage({
        type: "fetchLines",
        value: { title, url }
      })
    } catch (error) {
      console.error("failed to fetch lines:", error)
    }
    browser.runtime.onMessage.addListener((message) => {
      if (message.type === "channelsReceived") {
        console.log("receiving channels", message)
        console.log("new channels:", message.channels.length)
        lines.value = [...(lines.value || []), ...message.channels]
      }
    })
  })
</script>

<template>
  <div class="container">
    <template v-if="lines">
      <div class="line-container">
        <div v-for="line in lines" class="lines" :style="`background-color: ${hashStringToColor(line.title)};`">
          <h5 class="line-abbr">{{ line.title.substring(0,1) }}</h5>
          <div class="additional-info">
            <h5>{{ line.title }}</h5>
            <p>{{ line.metadata?.description }}</p>
            <button @click="startRide(line.slug)">start</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.container {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 999;
  pointer-events: all;
}

.line-container {
  width: 100%;
  max-width: 100dvw;
  margin: .2rem;
  display: flex;
  gap: .2rem;
  align-items: start;
  flex-wrap: wrap;
}

.lines {
  position: relative;
  line-height: 1;
  margin: 0;
  border-radius: .5rem;
  padding: .2rem .4rem;
}

h5 {
  line-height: 1;
  margin: 0;
}

.lines:hover .line-abbr {
  display: none;
}

.additional-info {
  display: none;
}

.lines:hover .additional-info {
  display: block;
}
</style>