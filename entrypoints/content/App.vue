<script lang="ts" setup>
  import LineDisplay from '@/components/LineDisplay.vue'
  import hashColor from '@/utils/hashColor'
  import { PublicPath } from 'wxt/browser'

  // data
  const lines = ref<any[]>([])
  const line = ref<any>(null)
  const url = ref<string>('')
      
  // storage values
  const restingTime = ref<number>(10)
  const commuting = ref<boolean>(false)
  
  // animation refs  
  const leaving = ref<boolean>(false)
  const arriving = ref<boolean>(false)
  
  // indicator light refs (LineDisplayStation)
  const stationIndex = ref<number>(-1)
  const nextStationIndex = ref<number>(-1)
  const nextStation = ref<any>(null)

  async function startRide(line: any, url: string, direction: string) {
    await browser.runtime.sendMessage({ type: "start", value: { line, url, direction }})
    await rideAnimations(line, direction)
  }

  async function stopRide() {
    await storage.setItem('local:commuting', false)
  }
  
  async function rideAnimations(line: any, direction: string) {
    if(!commuting.value) return
    leaving.value = true
    nextStationIndex.value = direction === 'forwards' ? stationIndex.value + 1 : stationIndex.value - 1
    nextStation.value = line.contents[nextStationIndex.value]
    
    const funMode = await storage.getItem('local:funMode')
    setTimeout(() => {
      storage.setItem('local:leaving', true)
    }, funMode ? 2000 : 0)
    if (funMode) {
      const commutingTime = await storage.getItem<number | null>('local:commutingTime') || 10
      setTimeout(() => {
        leaving.value = false
        arriving.value = true
      }, (commutingTime * 1000) - 3000)
    }
  }

  async function openLine(slug: string) {
    
    if (line.value?.slug === slug) return

    const currentLine = lines.value.find(l => l.slug === slug)
    if (!currentLine) {
      console.error("Couldnt find line with slug:", slug)
      return
    } 
    line.value = currentLine
    if (currentLine.contents.length != currentLine.length) {
      line.value.contents = (await browser.runtime.sendMessage({ type: "getLine", value: {
        slug,
        length: currentLine.length,
      } }))
    }
    line.value.contents = line.value.contents.filter((s: any) => s.class === 'Link')
    stationIndex.value = line.value.contents.findIndex((s: any) => s.source.url === url.value)
  }

  function descendTime() {
    setTimeout(() => {
      if(restingTime.value === 0) return
      restingTime.value = restingTime.value - 1
      descendTime()
    }, 1000)
  }

  onMounted(async () => {
    // get commuting values from store
    commuting.value = await storage.getItem('local:commuting') || false
    line.value = await storage.getItem('local:currentLine')
    restingTime.value = await storage.getItem<number | null>('local:restingTime') || 10

    const direction = await storage.getItem<string | null>('local:direction') || null

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

    // when receiving stations from call add them to lines array
    browser.runtime.onMessage.addListener((message) => {
      if (message.type === "channelsReceived") {
        lines.value = [...(lines.value || []), ...message.channels]
        lines.value = [...new Set(lines.value)]
      }
    })

    descendTime()
    // queue animation if commuting
    if(commuting.value && direction) {
      setTimeout(() => {
        rideAnimations(line.value, direction)
      }, restingTime.value * 1000)
    }
  })

  // ======================================== helper ===============================================
  function getImgUrl(src: PublicPath) {
    return browser.runtime.getURL(src)
  }

  // ==================================== storage Watchers =========================================
  const currentLineUnwatch = storage.watch('local:currentLine', (newVal: any | null) => {
    line.value = newVal
  })

  const commutingUnwatch = storage.watch('local:commuting', (newVal: boolean | null) => {
    commuting.value = newVal || false
  })

  // unwatch storage before unmount
  onBeforeUnmount(() => {
    currentLineUnwatch()
    commutingUnwatch()
  })
</script>

<template>
  <div class="container" id="web-extension-subway">
    <!-- <div id="background" :class="{'leaving': leaving, 'arriving': arriving}" :style="`background-image: url('${getImgUrl('/svg/tunnel_plain.png')}')`">
      <template v-if="nextStation && nextStation.image">
        <img :src="nextStation.image.original.url" alt="">
      </template>
    </div>
    <div :class="{'doors': true, 'closed': leaving, 'opened': arriving}">
      <img id="left-door" :src="getImgUrl('/svg/subway-left-door-tr.png')" alt="">
      <img id="right-door" :src="getImgUrl('/svg/subway-right-door-tr.png')" alt="">
      <img id="interior" :src="getImgUrl('/svg/subway-interior-tr+fg.png')" alt="">
    </div> -->
    <template v-if="line && ((!commuting && !leaving) || (commuting && leaving))">
      <LineDisplay :line="line" @start="dir => startRide(line, url, dir)" @close="() => line = null" :station-index="stationIndex" :commuting="commuting" :next-station-index="nextStationIndex"/>
    </template>
    <header>
      <button v-if="commuting && (!leaving && !arriving)" @click="stopRide">leave</button>
      <p id="channel-label">channels:</p>
      <template v-if="lines && !leaving && !arriving">
        <div class="lines-container">
          <div v-for="l in lines" :class="{'lines': true, 'inactive': line && l.slug != line.slug }" :style="`background-color: ${hashColor.hashStringToColor(l.title).primary};`" @click="openLine(l.slug)">
            <h5 class="line-abbr" :style="`color: ${hashColor.hashStringToColor(l.title).secondary};`">{{ l.title.substring(0,1) }}<span>{{ l.title.substring(1) }}</span></h5>
          </div>
        </div>
      </template>
      <p v-if="commuting && (!leaving && !arriving)" id="departure-time">departing in <span>{{ Math.floor(restingTime/60) }}:{{ restingTime%60 }}</span></p>
    </header>
  </div>
</template>

<style scoped>
.container {
  position: fixed;
  top: 0;
  right: 0;
  width: 100%;
  /* height: 100dvh; */
  z-index: 999;
  pointer-events: all;
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
  top: 0;
  left: 0;
  width: calc(100dvw - .4rem);
  padding: 0 .2rem;
  display: grid;
  grid-template-columns: min-content min-content auto max-content;
  gap: .4rem;
  background-color: Field;
  color: FieldText;
  height: 32px;
  font-size: small;
  align-items: center;
}

header p {
  margin: 0;
  align-self: center;
}

#channel-label {
  justify-self: end;
}

#departure-time {
  justify-self: end;
}

.lines-container {
  /* position: absolute;
  top: 0; */
  width: 100%;
  max-width: calc(100% - .4rem);
  margin-inline: .2rem;
  display: flex;
  gap: .2rem;
  align-items: start;
  overflow-x: auto;
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

.lines.inactive:not(:hover) {
  filter: grayscale();
}

h5 {
  line-height: 1;
  font-size: small;
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