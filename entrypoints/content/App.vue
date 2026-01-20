<script lang="ts" setup>
import background from '../background'
import LineDisplay from '@/components/LineDisplay.vue'
import hashColor from '@/utils/hashColor'

const lines = ref<any[]>([])
const line = ref<any>(null)
const url = ref<string>('')

function startRide(line: any, url: string, direction: string) {
  browser.runtime.sendMessage({ type: "start", value: { line, url, direction }})
}

// function getDomainFromUrl(url: string): string {
//   const regex = /^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i
//   const match = url.match(regex)
//   return match ? match[1] : ''
// }



async function openLine(slug: string) {
  const currentLine = lines.value.find(l => l.slug === slug)
  if (!currentLine) {
    console.error("Couldnt find line with slug:", slug)
    return
  } 
  line.value = currentLine
  if (currentLine.contents.length != currentLine.length) {
    line.value.contents = await browser.runtime.sendMessage({ type: "getLine", value: {
      slug,
      length: currentLine.length,
    } })
  }
}

onMounted(async () => {
  // const url = window.location.href
  // const domain = getDomainFromUrl(url)
  const title = document.title
  url.value = window.location.href
  try {
    browser.runtime.sendMessage({
      type: "fetchLines",
      value: { title, url: url.value }
    })
  } catch (error) {
    console.error("failed to fetch lines:", error)
  }
  browser.runtime.onMessage.addListener((message) => {
    if (message.type === "channelsReceived") {
      console.log("receiving channels", message)
      console.log("new channels:", message.channels.length)
      lines.value = [...(lines.value || []), ...message.channels]
      lines.value = [...new Set(lines.value)]
    }
  })
})
</script>

<template>
  <div class="container">
    <template v-if="lines">
      <div class="line-container">
        <div v-for="line in lines" class="lines" :style="`background-color: ${hashColor.hashStringToColor(line.title)};`" @click="openLine(line.slug)">
          <h5 class="line-abbr">{{ line.title.substring(0,1) }}</h5>
          <!-- <div class="additional-info">
            <h5>{{ line.title }}</h5>
            <p>{{ line.metadata?.description }}</p>
            <button @click="startRide(line.slug)">start</button>
          </div> -->
        </div>
      </div>
    </template>
    <template v-if="line">
      <LineDisplay :line="line" @start="dir => startRide(line, url, dir)"/>
    </template>
  </div>
</template>

<style scoped>
.container {
  position: fixed;
  top: 0;
  right: 0;
  width: 100dvw;
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
  line-height: 1.2;
  width: 1.5em;
  height: 1.5em;
  text-align: center;
  margin: 0;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  /* padding: .4em .3em .2em .3em; */
  cursor: pointer;
}

h5 {
  line-height: 1;
  margin: 0;
}

.line-abbr {
  color: white;
  /* mix-blend-mode: difference; */
}

/* .lines:hover .line-abbr {
  display: none;
}

.additional-info {
  display: none;
}

.lines:hover .additional-info {
  display: block;
} */
</style>