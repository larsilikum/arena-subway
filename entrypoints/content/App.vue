<script lang="ts" setup>
  import LineDisplay from '@/components/LineDisplay.vue'
  import NextIcon from '@/components/NextIcon.vue'
  import CloseIcon from '@/components/CloseIcon.vue'
  import LineAbbreviation from '@/components/LineAbbreviation.vue'
  import HorizontalScroll from '@/components/HorizontalScroll.vue'
  import ColoredPill from '@/components/ColoredPill.vue'
  import { ArenaBlock, ArenaChannel, Station } from '@/types'
  import { isSameRoute } from '@/utils/compareRoute'
  import { PublicPath } from 'wxt/browser'

  // data
  const lines = ref<ArenaChannel[]>([])
  const commutingLine = ref<ArenaChannel | null>(null)
  const displayLine = ref<ArenaChannel | null>(null)
  const url = ref<string>('')
  const tabId = ref<number>(-1)
  const direction = ref<string | null>(null)
      
  // storage values
  const restingTime = ref<number>(10)
  const commuting = ref(false)
  const mode = ref<string>('')
  const funMode = ref<boolean>(false)

  // ui refs
  const headerOpen = ref(true)
  const routeArenaChannel = ref(false)
    
  // indicator light values (LineDisplayStation)
  const stationIndex = computed<number>(() => {
    if(routeArenaChannel.value) return -1
    return displayLine.value?.contents?.findIndex((s: any) => isSameRoute(s.source?.url, url.value)) || -1
  })

  const nextStationIndex = ref<number>(-1)
  const nextStation = ref<any>(null)

  // =========================== commuting functions ====================================
  async function startRide(direction: string) {
    // convert to raw for firefox; should be obsolete, was my mistake as i forgot to use the native $emit function
    // send the displayed line to background script
    // const rawLine = displayLine.value ? structuredClone(JSON.parse(JSON.stringify(displayLine.value))) : null
    // const rawFromArena = structuredClone(JSON.parse(JSON.stringify(routeArenaChannel.value)))
    // const rawUrl = window.location.href
    await browser.runtime.sendMessage({ type: "start", value: { 
      line: displayLine.value, 
      url: window.location.href, 
      direction, 
      fromArena: routeArenaChannel.value }})
    
    // commuting line should now contain the displayLine sent to background and stored there.
    if(commutingLine.value) await rideAnimations(commutingLine.value, direction)
  }

  async function stopRide() {
    await storage.setItem(`local:commuting:${tabId.value}`, false)
  }
  
  async function rideAnimations(line: ArenaChannel, direction: string) {
    if(!commuting.value) return

    // change displayLine to display the current commutingLine
    displayLine.value = commutingLine.value

    // set nextStation to trigger blinking light in LineDisplayStation
    nextStationIndex.value = direction === 'forwards' ? stationIndex.value + 1 : stationIndex.value - 1
    if(line.contents) nextStation.value = line.contents[nextStationIndex.value]
  }

  const ridingAnimation = computed<boolean>(() => {
    return mode.value === "arriving" || mode.value === "commuting" || mode.value === "leaving"
  })

  function goToNextStation() {
    if (commutingLine.value && direction.value) rideAnimations(commutingLine.value, direction.value)
    browser.runtime.sendMessage({ type: "goToNextStation"})
  }

  // ============================================ ui functions ======================================
  async function openLine(slug: string) {
    if (displayLine.value?.slug === slug) return

    const currentLine = lines.value.find(l => l.slug === slug)
    if (!currentLine) {
      console.error("Couldnt find line with slug:", slug)
      return
    }

    displayLine.value = currentLine

    if (currentLine.contents?.length != currentLine.length) {
      displayLine.value.contents = (await browser.runtime.sendMessage({ type: "getLineContents", value: {
        slug,
        length: currentLine.length,
      } }))
    }
    displayLine.value.contents = displayLine.value.contents?.filter((s: any) => s.class === 'Link')
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
    commutingLine.value = await storage.getItem(`local:currentLine:${tabId.value}`)
    restingTime.value = await storage.getItem<number | null>(`local:restingTime:${tabId.value}`) || 10
    mode.value = await storage.getItem<string>(`local:mode:${tabId.value}`) || "idle"
    funMode.value = await storage.getItem(`local:funMode`) || false

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
        // console.log("received channels", message.channels) // for debugging
        // deduplicate channels
        const all = [...message.channels, ...lines.value]
        const linesMap = new Map(all.map(c => [c.id || c.slug, c]))
        // too long lines will take more than our max requests
        lines.value = Array.from(linesMap.values()).filter(l => l.length < 1500)
      } else if (message.type === "arenaChannelReceived") {
        lines.value = [message.value.channel]
      }
    })

    // queue animation if commuting
    if(commuting.value && direction) {
      setTimeout(() => {
        if(commutingLine.value && direction.value) rideAnimations(commutingLine.value, direction.value)
      }, restingTime.value * 1000)
    }

    const currentLineUnwatch = storage.watch(`local:currentLine:${tabId.value}`, (newVal: any | null) => {
      commutingLine.value = newVal
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

    <!-- The Component rendering the current Line or a Line preview -->
    <template v-if="displayLine || ridingAnimation">
      <LineDisplay :line="displayLine" @close="() => displayLine = null" :station-index="stationIndex" :commuting="commuting" :next-station-index="nextStationIndex"/>
    </template>

    <!-- The Bar at the bottom of the screen -->
    <header v-if="!ridingAnimation" :class="{'closed': !headerOpen}">
      <!-- The Current Line when on a subway -->
      <LineAbbreviation v-if="commuting && commutingLine" :line="commutingLine" :inactive="false" @open="slug => openLine(slug)" />
      <!-- Action Buttons for when commuting -->
      <button id="leave-button" v-if="commuting && !ridingAnimation" @click="stopRide" title="stop ride"><div id="leave-icon"></div></button>
      <button id="next-station-button" v-if="commuting && !ridingAnimation" @click="goToNextStation()" title="go to next site">
        <NextIcon/>
      </button>
      <!-- The channels for this webpage -->
      <ColoredPill id="lines-amount" v-if="!headerOpen" @click="changeHeaderMode(true)" :bg-color="'Highlight'" :text-color="'HighlightText'" :abbr="`${lines.length}`" :rest-text="'&ThickSpace;channels'" />
      <template v-else>
        <p id="channel-label">channels:</p>
        <template v-if="lines">
          <HorizontalScroll class="lines-container">
            <LineAbbreviation v-for="l in lines" :inactive="!!displayLine && l.slug != displayLine.slug" :line="l" @open="slug => openLine(slug)"/>
          </HorizontalScroll>
        </template>
      </template>
      <!-- Buttons enabling to start a ride towards the start or end of the channel -->
      <div class="button-container" v-if="!commuting && displayLine && stationIndex >= 0 && displayLine.contents">
        <button v-if="stationIndex > 0" @click="startRide('backwards')"><NextIcon class="next-icon backwards"/> <span>{{ displayLine.contents[0].title }}</span></button>
        <button v-if="stationIndex < displayLine.length - 1 && displayLine.length > 0" @click="startRide('forwards')"><span>{{ displayLine.contents[displayLine.contents.length - 1].title }}</span> <NextIcon class="next-icon"/></button>
      </div>
      <!-- The Countdown till we're going to the next station -->
      <p v-if="commuting && !ridingAnimation" id="departure-time"><span v-if="headerOpen">departing in </span><span>{{ convertToTime(restingTime) }}</span></p>
      <!-- Close Header Button -->
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
  grid-template-columns: repeat(4, min-content) minmax(0, 1fr) max-content min-content;
  /* gap: .4rem; */
  background-color: Field;
  color: FieldText;
  height: 32px;
  font-size: medium;
  align-items: center;
  transition: width .3s ease-in-out;
}

header > *:not(:first-child) {
  margin-left: .4em;
}

header.closed {
  /* left: 50%;
  transform: translateX(-50%); */
  grid-template-columns: repeat(5, auto);
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
/* 
#lines-amount {
  grid-column: 3 / 4;
} */

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

#departure-time {
  justify-self: end;
}

#close-all {
  grid-column: 7 / 8;
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
  grid-column: 5 / 6;
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