<script lang="ts" setup>
import { convertToTime } from '@/utils'
import NextIcon from '@/components/NextIcon.vue'

const restVal = ref<number>(30)
const commVal = ref<number>(10)
const funMode = ref<boolean>(false)
const mode = ref<'idle' | 'leaving' | 'commuting' | 'arriving' | 'resting'>('idle')
const enabled = ref<boolean>(false)
const isAuthorized = ref<boolean>(false)
const isPremium = ref<boolean>(false)

const tabId = ref<number | null>(null)

function setStorage(key: string, value: number | boolean) {
  console.log('set value', key, value)
  storage.setItem(`local:${key}`, value)
}

async function getCurrentTabId(): Promise<number | undefined> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true })
  if (tabs[0].id) tabId.value = tabs[0].id
  return tabs[0].id
}

async function skipStation() {
  const id = await getCurrentTabId()
  if (!id) return
  browser.runtime.sendMessage({ type: 'skipStationAtId', value: { id } })
}

async function stopCommute() {
  const id = await getCurrentTabId()
  if (!id) return
  await storage.setItem(`local:commuting:${id}`, false)
}

let unwatchMode = () => { }

onMounted(async () => {
  restVal.value = await storage.getItem<number | null>('local:restingTime') || 30
  commVal.value = await storage.getItem<number | null>('local:commutingTime') || 10
  funMode.value = await storage.getItem<boolean | null>('local:funMode') || false

  const id = await getCurrentTabId()
  if (id) {
    mode.value = await storage.getItem<'idle' | 'leaving' | 'commuting' | 'arriving' | 'resting'>(`local:mode:${tabId.value}`) || "idle"
  }

  unwatchMode = storage.watch(`local:mode:${id}`, (m: 'idle' | 'leaving' | 'commuting' | 'arriving' | 'resting' | null) => {
    console.log('mode changed: ', m)
    if (!m) return
    mode.value = m
  })

  const localEnabled = await storage.getItem<boolean | null>('local:enabled')
  enabled.value = localEnabled !== null ? localEnabled : false
  const token = await storage.getItem<string>('local:token')
  if (token) isAuthorized.value = true
  const tier = await storage.getItem<string>('local:tier')
  isPremium.value = !!tier && (tier === 'premium' || tier === 'supporter')
})

function authorizeArena() {
  if (!isAuthorized.value) {
    browser.runtime.sendMessage({ type: 'authorize' })
  }
}

const unwatch = storage.watch('local:token', newVal => {
  if (newVal !== null) isAuthorized.value = true
})

const unwatchPremium = storage.watch('local:tier', tier => {
  isPremium.value = !!tier && (tier === 'premium' || tier === 'supporter')
})

onBeforeUnmount(() => {
  unwatch()
  unwatchPremium()
  unwatchMode()
})
</script>

<template>
  <div class="popup">
    <div class="header">
      <input type="checkbox" name="onoff" id="onoff" @change="setStorage('enabled', enabled)" v-model="enabled">
      <h1>
        are.na rail
      </h1>
    </div>
    <br>
    <label for="restAtStation">time waiting per site</label>
    <div class="input-wrapper">
      <input type="range" name="restAtStation" id="restAtStation" min="30" max="200"
        @change="setStorage('restingTime', restVal)" v-model.number="restVal">
      <p>{{ convertToTime(restVal) }}</p>
    </div>

    <div class="input-wrapper">
      <label for="instantCommute">fun mode</label>
      <input type="checkbox" name="instantCommute" id="instantCommute" @change="setStorage('funMode', funMode)"
        v-model="funMode">
    </div>

    <template v-if="funMode">
      <label for="commutingTime">time for commuting between stations</label>
      <div class="input-wrapper">
        <input type="range" name="commuting time" id="commutingTime" min="10" max="40"
          @change="setStorage('commutingTime', commVal)" v-model.number="commVal">
        <p>{{ convertToTime(commVal) }}</p>
      </div>
    </template>
    <label v-if="!isPremium" class="additional-info">to get lines that contain this website you need to be logged in
      with an
      are.na
      premium
      account. With a free account you can only start from the page of an are.na channel.</label>
    <button id="login" @click="authorizeArena()">
      <span v-if="!isAuthorized">authorize</span>
      <span class="gray" v-else>
        authorized with
        <span v-if="isPremium">premium/supporter</span>
        <span v-else>free</span>
        tier
      </span>
    </button>
    <div v-show="mode === 'resting'" class="commuting-buttons">
      <button id="leave-button" @click="stopCommute" title="stop ride" aria-label="stop ride">
        <div id="leave-icon"></div>
      </button>
      <button id="next-station-button" @click="skipStation" title="go to next site" aria-label="go to next site">
        <NextIcon />
      </button>
    </div>
  </div>
</template>

<style scoped>
.gray {
  color: GrayText;
}

.header {
  display: flex;
  align-items: start;
  margin-bottom: 1em;
}

label {
  margin: 0;
}

label.additional-info {
  margin-top: 1em;
  font-size: small;
  font-style: italic;
  max-width: 25em;
}

button {
  font-family: inherit;
}

#onoff {
  appearance: none;
  color: GrayText;
  float: left;
  margin-right: 1em;
}

#onoff:checked {
  color: white;
}

#onoff::after {
  content: '⏼';
  font-size: xx-large;
  width: 100%;
  transform: translateX(-100%);
  cursor: pointer;
}

#onoff:checked::after {
  text-shadow: white 0 0 5px;
}

#onoff:hover::after {
  text-shadow: Highlight 0 0 5px;
}

input[type="range"] {
  height: 1em;
  font-size: medium;
}

.input-wrapper {
  display: flex;
  align-items: center;
  gap: 1em;
  margin-bottom: 1em;
}

.input-wrapper p {
  margin: 0;
}

.popup {
  display: flex;
  flex-direction: column;
  align-items: start;
}

h1 {
  margin: 0;
  line-height: 1.1;
  font-weight: normal;
}

#login {
  margin-top: 0.5em;
}

.commuting-buttons {
  display: flex;
  gap: .5rem;
  margin-top: 1rem;
}

#next-station-button,
#leave-button {
  width: 1.7em;
  padding: 0;
  display: flex;
  justify-content: center;
  align-items: center;

  background-color: #333;
  color: white;
  border: 1px solid white;
  height: 1.7em;
  border-radius: 0.5em;
  cursor: pointer;
}

#next-station-button:hover,
#leave-button:hover {
  background-color: Highlight;
  color: HighlightText;
}

#leave-icon {
  flex-grow: 0;
  height: 50%;
  aspect-ratio: 1 / 1;
  background-color: CanvasText;
}
</style>
