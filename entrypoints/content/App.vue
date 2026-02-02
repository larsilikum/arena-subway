<script lang="ts" setup>
  import LineDisplay from '@/components/LineDisplay.vue'
  import NextIcon from '@/components/NextIcon.vue'
  import CloseIcon from '@/components/CloseIcon.vue'
  import { ArenaBlock, ArenaChannel, Station } from '@/types'
  import { isSameRoute } from '@/utils/compareRoute'
  import hashColor from '@/utils/hashColor'
  import { PublicPath } from 'wxt/browser'

  // data
  const lines = ref<ArenaChannel[]>([])
  const line = ref<ArenaChannel | null>(null)
  const url = ref<string>('')
  const tabId = ref<number>(-1)
  const direction = ref<string | null>(null)
      
  // storage values
  const restingTime = ref<number>(10)
  const commuting = ref(false)
  const mode = ref<string>('')
  const funMode = ref<boolean>(false)

  // ui refs
  const lineOpen = ref(false)
  const headerOpen = ref(true)
  const routeArenaChannel = ref(false)
    
  // indicator light values (LineDisplayStation)
  const stationIndex = computed<number>(() => {
    if(routeArenaChannel.value) return -1
    return line.value?.contents?.findIndex((s: any) => isSameRoute(s.source?.url, url.value)) || -1
  })
  const nextStationIndex = ref<number>(-1)
  const nextStation = ref<any>(null)

  const filteredContents = computed(() => {
    if (!line.value || !line.value.contents) return []
    return line.value.contents.filter((c: ArenaChannel | ArenaBlock) => c.class === 'Link')
  })

  // =========================== commuting functions ====================================
  async function startRide(direction: string) {
    const rawLine = line.value ? structuredClone(JSON.parse(JSON.stringify(line.value))) : null
    const rawFromArena = structuredClone(JSON.parse(JSON.stringify(routeArenaChannel.value)))
    const rawUrl = window.location.href
    await browser.runtime.sendMessage({ type: "start", value: { 
      line: rawLine, 
      url: rawUrl, 
      direction, 
      fromArena: rawFromArena }})
    // commuting.value = true

    if(line.value) await rideAnimations(rawLine, direction)
  }

  async function stopRide() {
    await storage.setItem(`local:commuting:${tabId.value}`, false)
  }
  
  async function rideAnimations(line: ArenaChannel, direction: string) {
    if(!commuting.value) return
    
    // set nextStation to trigger blinking light in LineDisplayStation
    nextStationIndex.value = direction === 'forwards' ? stationIndex.value + 1 : stationIndex.value - 1
    if(line.contents) nextStation.value = line.contents[nextStationIndex.value]
  }

  const ridingAnimation = computed<boolean>(() => {
    return mode.value === "arriving" || mode.value === "commuting" || mode.value === "leaving"
  })

  function goToNextStation() {
    if (line.value && direction.value) rideAnimations(line.value, direction.value)
    browser.runtime.sendMessage({ type: "goToNextStation"})
  }

  // ============================================ ui functions ======================================
  async function openLine(slug: string) {
    lineOpen.value = true

    if (line.value?.slug === slug) return

    const currentLine = lines.value.find(l => l.slug === slug)
    if (!currentLine) {
      console.error("Couldnt find line with slug:", slug)
      return
    }

    line.value = currentLine

    if (currentLine.contents?.length != currentLine.length) {
      line.value.contents = (await browser.runtime.sendMessage({ type: "getLineContents", value: {
        slug,
        length: currentLine.length,
      } }))
    }
    line.value.contents = line.value.contents?.filter((s: any) => s.class === 'Link')
    console.log(line.value)
  }

  // header display mode functionality
  async function changeHeaderMode(open: boolean) {
    headerOpen.value = open
    await storage.setItem('local:headerOpen', open)
  }

  // ======================================= Mounted ===========================================

  const storageUnwatch = ref<Function>(() => {})
  
  onMounted(async () => {
    // get tabId
    tabId.value = await browser.runtime.sendMessage({ type: 'getTabId' })
    console.log(tabId.value)

    // get commuting values from store
    commuting.value = await storage.getItem(`local:commuting:${tabId.value}`) || false
    line.value = await storage.getItem(`local:currentLine:${tabId.value}`)
    restingTime.value = await storage.getItem<number | null>(`local:restingTime:${tabId.value}`) || 10
    mode.value = await storage.getItem<string>(`local:mode:${tabId.value}`) || "idle"
    funMode.value = await storage.getItem(`local:funMode`) || false

    console.log(mode.value, commuting.value, restingTime.value)

    direction.value = await storage.getItem<string | null>(`local:direction:${tabId.value}`) || null

    // get ui values from store
    const hOVal = await storage.getItem<boolean | null>('local:headerOpen')
    headerOpen.value = hOVal !== null ? hOVal : true 

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
        console.log("received channels", message.channels)
        // deduplicate channels
        const all = [...message.channels, ...lines.value]
        const linesMap = new Map(all.map(c => [c.id || c.slug, c]))
        lines.value = Array.from(linesMap.values())
      } else if (message.type === "arenaChannelReceived") {
        lines.value = [message.value.channel]
      }
    })

    // queue animation if commuting
    if(commuting.value && direction) {
      setTimeout(() => {
        if(line.value && direction.value) rideAnimations(line.value, direction.value)
      }, restingTime.value * 1000)
    }

    const currentLineUnwatch = storage.watch(`local:currentLine:${tabId.value}`, (newVal: any | null) => {
      line.value = newVal
    })

    const commutingUnwatch = storage.watch(`local:commuting:${tabId.value}`, (newVal: boolean | null) => {
      commuting.value = newVal || false
    })

    const modeUnwatch = storage.watch(`local:mode:${tabId.value}`, (newVal: string | null) => {
      if (newVal !== null) mode.value = newVal
    })

    const remainingTimeUnwatch = storage.watch(`local:timeToDeparture:${tabId.value}`, (newVal: number | null) => {
      if (newVal !== null) restingTime.value = newVal / 1000
    })

    const funModeUnwatch = storage.watch('local:funMode', (newVal: boolean | null) => {
      if (newVal !== null) funMode.value = newVal
    })

    storageUnwatch.value = () => {
      currentLineUnwatch()
      commutingUnwatch()
      modeUnwatch()
      remainingTimeUnwatch()
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

  // ==================================== storage Watchers =========================================


  // unwatch storage before unmount
  onBeforeUnmount(() => {
    storageUnwatch.value()
  })
</script>

<template>
  <div :class="{'container': true, 'full-height': ridingAnimation && funMode}" id="web-extension-subway">
    <!-- <div id="background" :class="{'leaving': leaving, 'arriving': arriving}" :style="`background-image: url('${getImgUrl('/svg/tunnel_plain.png')}')`">
      <template v-if="nextStation && nextStation.image">
        <img :src="nextStation.image.original.url" alt="">
      </template>
    </div> -->
    <!-- <div v-if="funMode" :class="{'doors': true, 'closed': mode === 'leaving', 'opened': mode === 'arriving'}">
      <img id="left-door" :src="getImgUrl('/svg/subway-left-door-tr.png')" alt="">
      <img id="right-door" :src="getImgUrl('/svg/subway-right-door-tr.png')" alt="">
      <img id="interior" :src="getImgUrl('/svg/subway-interior-tr.png')" alt="">
    </div> -->
    <template v-if="lineOpen || ridingAnimation">
      <LineDisplay :line="line" @start="dir => startRide(dir)" @close="() => lineOpen = false" :station-index="stationIndex" :commuting="commuting" :next-station-index="nextStationIndex"/>
    </template>
    <header v-if="!ridingAnimation" :class="{'closed': !headerOpen}">
      <button id="leave-button" v-if="commuting && !ridingAnimation" @click="stopRide" title="stop ride"><div id="leave-icon"></div></button>
      <button id="next-station-button" v-if="commuting && !ridingAnimation" @click="goToNextStation()" title="go to next site">
        <NextIcon/>
      </button>
      <p v-if="headerOpen" id="channel-label">channels:</p>
      <div v-if="!headerOpen" class="lines" id="lines-amount">
        <h5 class="line-abbr" @click="changeHeaderMode(true)">{{ lines.length }}<span>&ThickSpace;channels</span></h5>
      </div>
      <template v-if="lines && headerOpen">
        <div class="lines-container">
          <div v-for="l in lines" :class="{'lines': true, 'inactive': line && l.slug != line.slug && lineOpen }" :style="`background-color: ${hashColor.hashStringToColor(l.slug).primary};`" @click="openLine(l.slug)">
            <h5 class="line-abbr" :style="`color: ${hashColor.hashStringToColor(l.slug).secondary};`">{{ l.title.substring(0,1) }}<span>{{ l.title.substring(1) }}</span></h5>
          </div>
        </div>
      </template>
      <div class="button-container" v-if="!commuting && line && lineOpen">
        <button v-if="stationIndex > 0" @click="startRide('backwards')"><NextIcon class="next-icon backwards"/> <span v-if="'generated_title' in filteredContents[0]">{{ filteredContents[0].generated_title }}</span></button>
        <button v-if="stationIndex < line.length - 1" @click="startRide('forwards')"><span v-if="'generated_title' in filteredContents[filteredContents.length - 1]">{{ filteredContents[filteredContents.length - 1].generated_title }}</span> <NextIcon class="next-icon"/></button>
      </div>
      <p v-if="commuting && !ridingAnimation" id="departure-time"><span v-if="headerOpen">departing in </span><span>{{ convertToTime(restingTime) }}</span></p>
      <button v-if="headerOpen" id="close-all" @click="changeHeaderMode(false)"><CloseIcon/></button>
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
  /* height: 100dvh; */
  z-index: 999;
  pointer-events: all;
}

.container.full-height {
  height: 100%;
}

#next-station-button, #leave-button, #close-all {
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
  background-color: ButtonText;
}

#background {
  position: absolute;
  bottom: 0;
  left: 100dvw;
  height: calc(100dvh - 400px);
  width: 100dvw;
  background-position: 0 0;
  background-repeat: repeat-x;
  background-size: cover;
}

#background.leaving {
  left: 0;
  transition: left 2s ease-in;
  transition-delay: 2s;
  animation: commuting 1s linear infinite;
  animation-delay: 4s;
}

#background img {
  position: absolute;
  left: 100%;
  top: 0;
  width: 100dvw;
}

@keyframes commuting {
  from {
    background-position: 0 0;
  }
  to {
    background-position: calc((100dvh - 400px) * -2.28 * 3) 0;
  }
}

#background.arriving {
  overflow-x: visible;
  left: -100%;
  transition: left 2s ease-in;
  transition-timing-function: ease-out;
}

header {
  position: absolute;
  bottom: 0;
  left: 0;
  width: calc(100% - .8rem);
  max-width: calc(100dvw - .8rem);
  padding: 0 .4rem;
  display: grid;
  grid-template-columns: min-content min-content min-content minmax(0, 1fr) max-content min-content;
  /* gap: .4rem; */
  background-color: Field;
  color: FieldText;
  height: 32px;
  font-size: medium;
  align-items: center;
  transition: width .5s ease-in-out;
}

header > *:not(:first-child) {
  margin-left: .4em;
}

header.closed {
  /* left: 50%;
  transform: translateX(-50%); */
  grid-template-columns: repeat(4, auto);
  width: 2em;
  min-width: min-content;
  border-top-right-radius: 16px;
}

.button-container {
  position: relative;
  display: flex;
  justify-content: center;
  gap: .4em;
}

button span {
  max-width: 15em;
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

#lines-amount {
  background-color: Highlight;
  cursor: pointer;
  grid-column: 3 / 4;
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
  grid-column: 3 / 4;
}

#departure-time {
  justify-self: end;
}

#close-all {
  grid-column: 6 / 7;
}

.lines-container {
  /* position: absolute;
  top: 0; */
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin-inline: .2rem;
  display: flex;
  gap: .2rem;
  align-items: start;
  overflow-x: auto;
  grid-column: 4 / 5;
}
 /* Hide scrollbar for Chrome, Safari and Opera */
.lines-container::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
.lines-container {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
} 


.lines {
  position: relative;
  line-height: 1.2;
  font-size: small;
  width: 1.5em;
  height: 1.3em;
  text-align: center;
  margin: 0;
  border-radius: .75em;
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  padding-top: .2em;
  /* padding: .4em .3em .2em .3em; */
  cursor: pointer;
  transition: width .4s ease;
  overflow: hidden;
}

.lines.inactive:not(:hover) {
  filter: grayscale();
}

h5 {
  line-height: 1;
  font-size: medium;
  margin: 0;
  font-weight: normal;
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
  animation: marquee 2s alternate ease-in-out infinite;
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
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  transform-origin: center 50vmax;
  transform: scale(2);
  transition: transform .2s ease-out;

  /* display: flex; */
}

.closed {
  transform: scale(1);
}

/* .doors img {
  width: 50%;
  height: 100%;
  object-fit: cover;
  transition: transform 1s ease-in-out;
  } */
  
.doors img {
  height: 100dvh;
  width: 100dvw;
  position: absolute;
  left: 0;
  top: 0;
  transition: transform .8s ease-in-out;
  object-fit: cover;
  object-position: center 10%;
  pointer-events: none;
}




#left-door {
  transform: translateX(-25%);
  /* object-position: right; */
}

#right-door {
  transform: translateX(26%);
  /* object-position: top left; */
}

.closed #left-door, .closed #right-door {
  transform: translateX(0);
  transition-delay: .2s;
}

.opened img {
  transition-delay: 2s;
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