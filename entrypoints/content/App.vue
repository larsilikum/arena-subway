<script lang="ts" setup>
import LineDisplay from '@/components/LineDisplay.vue'
import hashColor from '@/utils/hashColor'
import { PublicPath } from 'wxt/browser'

const lines = ref<any[]>([])
const line = ref<any>(null)
const url = ref<string>('')
const leaving = ref<boolean>(false)

function startRide(line: any, url: string, direction: string) {
  leaving.value = true
  setTimeout(() => {
    browser.runtime.sendMessage({ type: "start", value: { line, url, direction }})
  }, 5000)
}

function getImgUrl(src: PublicPath) {
  return browser.runtime.getURL(src)
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
    <template v-if="lines && !leaving">
      <div class="line-container">
        <div v-for="l in lines" :class="{'lines': true, 'inactive': line && l.slug != line.slug }" :style="`background-color: ${hashColor.hashStringToColor(l.title).primary};`" @click="openLine(l.slug)">
          <h5 class="line-abbr" :style="`color: ${hashColor.hashStringToColor(l.title).secondary};`">{{ l.title.substring(0,1) }}<span>{{ l.title.substring(1) }}</span></h5>
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
    <div :class="{'doors': true, 'closed': leaving}">
      <img id="left-door" :src="getImgUrl('/svg/left_door.svg')" alt="">
      <img id="right-door" :src="getImgUrl('/svg/right_door.svg')" alt="">
    </div>
  </div>
</template>

<style scoped>
.container {
  position: fixed;
  display: grid;
  grid-template-rows: auto auto 1fr;
  top: 0;
  right: 0;
  width: 100dvw;
  height: 100dvh;
  z-index: 999;
  pointer-events: all;
}

.line-container {
  width: 100%;
  max-width: calc(100% - .4rem);
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
  border-radius: .75em;
  display: flex;
  justify-content: center;
  align-items: center;
  /* padding: .4em .3em .2em .3em; */
  cursor: pointer;
  transition: width .4s ease;
  overflow: hidden;
}

.lines.inactive {
  filter: grayscale();
}

h5 {
  line-height: 1;
  margin: 0;
  white-space: nowrap;
}

.line-abbr {
  color: white;
  /* mix-blend-mode: difference; */
}

.line-abbr span {
  display: none;
}

.lines:hover .line-abbr {
  animation: marquee 1s alternate ease-in-out infinite;
  transform-origin: 0 0;
}

.lines:hover span {
  display: inline-block;
}

.lines:hover {
  width: 5rem;
  justify-content: start;
  padding-inline: .3em;
}

@keyframes marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(calc(-100% + 5rem));
  }
}

.doors {
  overflow: hidden;
  display: flex;
}

.doors img {
  width: 50%;
  height: 100%;
  object-fit: cover;
  transition: transform 1s ease-in-out;
}

#left-door {
  transform: translateX(-100%);
  object-position: top right;
}

#right-door {
  transform: translateX(100%);
  object-position: top left;
}

.closed #left-door, .closed #right-door {
  transform: translateX(0);
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