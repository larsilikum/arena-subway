<script lang="ts" setup>
import LineDisplay from '@/components/LineDisplay.vue'
import NextIcon from '@/components/NextIcon.vue'
import CloseIcon from '@/components/CloseIcon.vue'
import LineAbbreviation from '@/components/LineAbbreviation.vue'
import HorizontalScroll from '@/components/HorizontalScroll.vue'
import ColoredPill from '@/components/ColoredPill.vue'
import Countdown from '@/components/Header/Countdown.vue'
import { ArenaBlock, ArenaChannel, Station } from '@/types'
import { isSameRoute } from '@/utils'
import { PublicPath } from 'wxt/browser'
import { computedAsync } from '@vueuse/core'


// data
const lines = ref<ArenaChannel[]>([])
const commutingLine = ref<ArenaChannel | null>(null)
const displayLine = ref<ArenaChannel | null>(null)
const displayLineContents = ref<Map<number, ArenaChannel | ArenaBlock>>(new Map())
const url = ref<string>('')
const tabId = ref<number>(-1)
const direction = ref<string | null>(null)

// storage values
const commuting = ref(false)
const mode = ref<string>('')
const funMode = ref<boolean>(false)

// ui refs
const headerOpen = ref<boolean | null>(null)
const routeArenaChannel = ref(false)
const lineOpen = ref(false)
const ridingAnimation = ref(false)

// indicator light values (LineDisplayStation)
const stationIndex = computedAsync<number>(async () => {
  if (routeArenaChannel.value) return -1
  if (ridingAnimation.value) {
    const index = await storage.getItem<number>(`local:currentIndex:${tabId.value}`)
    if (index !== null) return index
  }
  return displayLine.value?.contents?.findIndex((s: any) => isSameRoute(s.source?.url, url.value)) || -1
}, -1)

const nextStationIndex = computed<number>(() => {
  if (stationIndex.value < 0 || !direction.value || !commutingLine.value || !ridingAnimation.value) return -1
  if (direction.value === 'forwards') {
    return Math.min(stationIndex.value + 1, commutingLine.value.length - 1)
  }
  return Math.max(0, stationIndex.value - 1)
})

// @ts-expect-error
const nextStation = computed<ArenaBlock | null>(() => {
  if (nextStationIndex.value < 0) return null
  return commutingLine.value?.contents ? commutingLine.value.contents[nextStationIndex.value] : null
})

// =========================== commuting functions ====================================
async function startRide(dir: string) {
  // convert to raw for firefox
  const rawLine = displayLine.value ? structuredClone(JSON.parse(JSON.stringify(displayLine.value))) : null
  const rawFromArena = structuredClone(JSON.parse(JSON.stringify(routeArenaChannel.value)))
  const rawUrl = window.location.href

  // send the displayed line to background script
  await browser.runtime.sendMessage({
    type: "start", value: {
      line: rawLine,
      url: rawUrl,
      direction: dir,
      fromArena: rawFromArena
    }
  })

  direction.value = dir
}

async function stopRide() {
  ridingAnimation.value = false
  await storage.setItem(`local:commuting:${tabId.value}`, false)
}

function goToNextStation() {
  browser.runtime.sendMessage({ type: "goToNextStation" })
}

// ============================================ ui functions ======================================
async function openLine(slug: string) {
  lineOpen.value = true
  if (displayLine.value?.slug === slug) return

  const currentLine = lines.value.find(l => l.slug === slug)
  if (!currentLine) {
    console.error("Couldnt find line with slug:", slug)
    return
  }
  displayLineContents.value = new Map()
  displayLine.value = currentLine

  if (currentLine.contents?.length != currentLine.length) {
   browser.runtime.sendMessage({
      type: "getLineContents", value: {
        slug,
        length: currentLine.length,
      }
    })
  }
}

// header display mode functionality
async function changeHeaderMode(open: boolean) {
  headerOpen.value = open
  await storage.setItem('local:headerOpen', open)
}

// ======================================= Mounted ===========================================

const storageUnwatch = ref<Function>(() => { })

onMounted(async () => {
  // get ui values from store
  const hOVal = await storage.getItem<boolean | null>('local:headerOpen')
  headerOpen.value = hOVal !== null ? hOVal : true
  displayLineContents.value = new Map()

  // get tabId
  tabId.value = await browser.runtime.sendMessage({ type: 'getTabId' })
  console.log(tabId.value)

  // get commuting values from store
  commutingLine.value = await storage.getItem(`local:currentLine:${tabId.value}`)
  mode.value = await storage.getItem<string>(`local:mode:${tabId.value}`) || "idle"
  commuting.value = !(mode.value === 'idle')
  funMode.value = await storage.getItem(`local:funMode`) || false

  direction.value = await storage.getItem<string | null>(`local:direction:${tabId.value}`) || null

  const isLoggedIn = !!(await storage.getItem<boolean>('local:token'))

  routeArenaChannel.value = isAreNaChannel()
  console.log(routeArenaChannel.value)

  // if we are on a are.na channel fetch this channel
  if (routeArenaChannel.value) {
    browser.runtime.sendMessage({
      type: "getLine",
      // are.na channel routes are always /username/channel-slug
      value: { slug: window.location.pathname.split('/')[2] }
    })
  } else {
    // search for block with this title in are.na
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
  }


  // when receiving stations from call add them to lines array
  browser.runtime.onMessage.addListener((message) => {
    if (message.type === "channelsReceived") {
      // console.log("received channels", message.channels) // for debugging
      // deduplicate channels
      const all = [...message.channels, ...lines.value]
      const linesMap = new Map(all.map(c => [c.id || c.slug, c]))
      // too long lines will take more than our max requests if not logged in
      lines.value = Array.from(linesMap.values()).filter(l => isLoggedIn ? l.length < 6000 : l.length < 1500)
      // displayLine.value = lines.value[0] // for debugging
    } else if (message.type === "arenaChannelReceived") {
      lines.value = [message.value.channel]
    } else if (message.type === "channel-contents") {
      if(!displayLine.value) return
      message.value.contents.forEach((content: ArenaBlock, i: number) => {
        const lineIndex:number = (message.value.page - 1) * message.value.per + i  
        displayLineContents.value.set(lineIndex, content)
      })
      displayLine.value.contents = Array.from(displayLineContents.value.values())
      displayLine.value.contents = displayLine.value.contents?.filter((s: any) => s.class === 'Link')
    }
  })

  // ==================================== storage Watchers =========================================

  const currentLineUnwatch = storage.watch(`local:currentLine:${tabId.value}`, (newVal: any | null) => {
    commutingLine.value = newVal
  })

  const modeUnwatch = storage.watch(`local:mode:${tabId.value}`, (newVal: string | null) => {
    // console.log("mode changed to", newVal) // leave for debugging
    if (newVal !== null) {
      if (newVal === 'idle') {
        commuting.value = false
      } else {
        commuting.value = true
      }
      mode.value = newVal
      if (newVal === 'commuting') {
        displayLine.value = commutingLine.value
        lineOpen.value = true
      } else if (newVal === 'leaving' || newVal === 'arriving') {
        lineOpen.value = false
        // trigger riding animations
        ridingAnimation.value = true
      }
    }
  })
  const funModeUnwatch = storage.watch('local:funMode', (newVal: boolean | null) => {
    if (newVal !== null) funMode.value = newVal
  })

  storageUnwatch.value = () => {
    currentLineUnwatch()
    modeUnwatch()
    funModeUnwatch()
  }
})

// ======================================== helper ===============================================
function getImgUrl(src: PublicPath) {
  return browser.runtime.getURL(src)
}

function isAreNaChannel(): boolean {
  const isAreNaDomain = window.location.hostname === 'www.are.na';
  const hasChannelElements = !!document.querySelector('[aria-label="Search this channel"]');

  console.log(isAreNaDomain, hasChannelElements, window.location)

  return isAreNaDomain && hasChannelElements;
}

// unwatch storage before unmount
onBeforeUnmount(() => {
  storageUnwatch.value()
})
</script>

<template>
  <div :class="{ 'container': true, 'full-height': ridingAnimation && funMode }" id="web-extension-subway">
    <!-- ================================= visuals for fun mode ============================================ -->
    <!-- next website thumbnail -->
    <template v-if="funMode && nextStation && nextStation.image">
      <img id="next-station-img" :class="{ 'moved-right': mode === 'commuting' || mode === 'leaving' }"
        :src="nextStation.image.original.url" alt="">
    </template>

    <!-- subway tunnel background -->
    <div v-if="funMode" id="background"
      :class="{ 'leaving': mode === 'leaving' || mode === 'commuting', 'arriving': mode === 'arriving' }"
      :style="`background-image: url('${getImgUrl('/svg/tunnel_reduced_center_small.png')}')`">
      <img id="tunnel-left" :src="getImgUrl('/svg/tunnel_reduced_left_small.png')" alt="">
      <img id="tunnel-right" :src="getImgUrl('/svg/tunnel_reduced_right_small.png')" alt="">
    </div>

    <!-- subway interior -->
    <div v-if="funMode"
      :class="{ 'doors': true, 'closed': mode === 'leaving' || mode === 'commuting', 'opened': mode === 'arriving' }">
      <img id="left-door" :src="getImgUrl('/svg/ubahn_links.png')" alt="">
      <img id="right-door" :src="getImgUrl('/svg/ubahnrechts.png')" alt="">
      <img id="interior" :src="getImgUrl('/svg/subway-interior-bw.png')" alt="">
    </div>

    <!-- The Component rendering the current Line or a Line preview -->
    <template v-if="lineOpen">
      <LineDisplay :line="displayLine" @close="() => lineOpen = false" :station-index="stationIndex"
        :commuting="ridingAnimation" :next-station-index="nextStationIndex" />
    </template>
    <!-- The Bar at the bottom of the screen -->
    <header v-if="!ridingAnimation && headerOpen !== null" :class="{ 'closed': !headerOpen }">
      <!-- The Current Line when on a subway -->
      <LineAbbreviation v-if="commuting && commutingLine" :line="commutingLine" :inactive="false"
        @open="slug => openLine(slug)" />
      <!-- Action Buttons for when commuting -->
      <button id="leave-button" v-if="commuting && !ridingAnimation" @click="stopRide" title="stop ride">
        <div id="leave-icon"></div>
      </button>
      <button id="next-station-button" v-if="commuting && !ridingAnimation" @click="goToNextStation()"
        title="go to next site">
        <NextIcon />
      </button>
      <!-- The channels for this webpage -->
      <ColoredPill id="lines-amount" v-if="!headerOpen" @click="changeHeaderMode(true)" :bg-color="'Highlight'"
        :text-color="'HighlightText'" :abbr="`${lines.length}`" :rest-text="'&ThickSpace;channels'" />
      <template v-else>
        <p id="channel-label">channels:</p>
        <template v-if="lines">
          <HorizontalScroll class="lines-container">
            <LineAbbreviation v-for="l in lines" :inactive="lineOpen && l.slug != displayLine?.slug" :line="l"
              @open="slug => openLine(slug)" />
          </HorizontalScroll>
        </template>
      </template>
      <!-- Buttons enabling to start a ride towards the start or end of the channel -->
      <div class="button-container" v-if="!commuting && displayLine && displayLine.contents">
        <button v-if="stationIndex !== 0" @click="startRide('backwards')">
          <NextIcon class="next-icon backwards" /> <span>{{ displayLine.contents[0].title }}</span>
        </button>
        <button v-if="stationIndex < displayLine.contents.length - 1 && displayLine.contents.length > 0"
          @click="startRide('forwards')">
          <span>{{ displayLine.contents[displayLine.contents.length - 1].title }}</span>
          <NextIcon class="next-icon" />
        </button>
      </div>
      <!-- The Countdown till we're going to the next station -->
      <Countdown v-if="commuting && !ridingAnimation" :header-open="headerOpen" />
      <!-- Close Header Button -->
      <button v-if="headerOpen" id="close-all" @click="changeHeaderMode(false)">
        <CloseIcon />
      </button>
    </header>
  </div>
</template>

<style scoped>
.container {
  position: fixed;
  bottom: 0;
  right: 0;
  width: 100%;
  height: auto;
  z-index: 999;
  pointer-events: all;
}

.container.full-height {
  height: 100%;
}

#next-station-button,
#leave-button,
#close-all {
  width: 1.7em;
  padding: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

#leave-icon {
  flex-grow: 0;
  height: 50%;
  aspect-ratio: 1 / 1;
  background-color: white;
}

#background {
  position: absolute;
  bottom: 0;
  top: 100%;
  left: calc(100dvw + 125dvh);
  height: 100dvh;
  width: 100dvw;
  background-position: 0 0;
  background-repeat: repeat-x;
  background-size: cover;
  transition: left 2s cubic-bezier(0.5, 0, 1, 0.5) 2s, background-color .5s ease-in 3.5s;
}

#background.leaving {
  top: 0;
  left: 0;
  background-color: #333333;
  animation: commuting 1s linear infinite;
  animation-delay: 4s;
}

#background.arriving {
  top: 0;
  overflow-x: visible;
  left: -150dvw;
  transition: left 2s ease-out, background-color .5s ease-out 1s;
  background-position: 100% 0;
  background-color: transparent;
}

#tunnel-left {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  transform: translateX(-100%);
}

#tunnel-right {
  position: absolute;
  left: 100%;
  top: 0;
  height: 100%;
}

#next-station-img {
  position: absolute;
  left: 0;
  top: 0;
  width: 100dvw;
  object-fit: cover;
  object-position: center 0;
  transition: left 1s ease-out;
}

#next-station-img.moved-right {
  left: 100dvw;
}

@keyframes commuting {
  from {
    background-position: 0 0;
  }

  to {
    background-position: calc(100dvh * -2.16 * 2) 0;
  }
}

header {
  position: absolute;
  bottom: 0;
  left: 0;
  width: calc(100% - .8rem);
  max-width: calc(100dvw - .8rem);
  padding: 0 .4rem;
  display: grid;
  grid-template-columns: repeat(4, min-content) minmax(0, 1fr) max-content min-content;
  /* gap: .4rem; */
  background-color: #333;
  color: white;
  height: 32px;
  font-size: medium;
  align-items: center;
  transition: width .3s ease-in-out;
}

header>*:not(:first-child) {
  margin-left: .4em;
}

header.closed {
  grid-template-columns: repeat(5, auto);
  width: 2em;
  min-width: min-content;
  border-top-right-radius: 16px;
}

.button-container {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: start;
  gap: .4em;
}

button span {
  max-width: 15em;
  line-height: .9;
  height: 1.5em;
  overflow: hidden;
  white-space: nowrap;
  display: inline-block;
  text-overflow: ellipsis;
}

button .next-icon {
  max-width: 1.5em;
  margin-left: 0;
}

button .next-icon.backwards {
  transform-origin: center;
  transform: rotate(-180deg)
}

#lines-amount:hover {
  width: 15ch;
}

#lines-amount:hover .line-abbr {
  animation: none;
}

header p {
  margin: 0;
  align-self: center;
}

#channel-label {
  justify-self: end;
  grid-column: 4 / 5;
}



#close-all {
  grid-column: 7 / 8;
}

.lines-container {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin-inline: .2rem;
  display: flex;
  gap: .2rem;
  align-items: start;
  grid-column: 5 / 6;
}

.doors {
  overflow: hidden;
  position: absolute;
  bottom: 0;
  left: 0;
  height: 100dvh;
  width: 100%;
  transform-origin: center 50vmax;
  transform: scale(2);
  transition: transform 1s ease-out;
  pointer-events: none;
}

.doors.closed {
  transform: scale(1);
  transition-delay: 0;
}

.doors.opened {
  transition-delay: 3s;
}

.doors img {
  height: 100dvh;
  width: 100dvw;
  position: absolute;
  left: 0;
  top: 0;
  transition: transform 1s ease-in-out 1s;
  object-fit: cover;
  object-position: center 10%;
  pointer-events: none;
}

.doors.closed img {
  transition-delay: 1s;
}

#left-door {
  transform: translateX(-25%);
}

#right-door {
  transform: translateX(26%);
}

.closed #left-door,
.closed #right-door {
  transform: translateX(0);
}

.doors.opened img {
  transition-delay: 2s;
}
</style>