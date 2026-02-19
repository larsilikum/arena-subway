<script lang="ts" setup>
import { convertToTime } from '@/utils'

const restVal = ref<number>(30)
const commVal = ref<number>(10)
const funMode = ref<boolean>(false)
const enabled = ref<boolean>(false)
const isAuthorized = ref<boolean>(false)
function setStorage(key: string, value: number | boolean) {
  console.log('set value', key, value)
  storage.setItem(`local:${key}`, value)
}
onMounted(async() => {
  restVal.value = await storage.getItem<number | null>('local:restingTime') || 30
  commVal.value = await storage.getItem<number | null>('local:commutingTime') || 10
  funMode.value = await storage.getItem<boolean | null>('local:funMode') || false
  const localEnabled = await storage.getItem<boolean | null>('local:enabled')
  enabled.value = localEnabled !== null ? localEnabled : false
  const token = await storage.getItem<string>('local:token')
  if (token) isAuthorized.value = true
})

function authorizeArena() {
  if(!isAuthorized.value) {
    browser.runtime.sendMessage({ type: 'authorize' })
  }
}

const unwatch = storage.watch('local:token', newVal => {
  if (newVal !== null) isAuthorized.value = true
})

onBeforeUnmount(() => {
  unwatch()
})
</script>

<template>
  <div class="popup">
    <div class="header">
      <input type="checkbox" name="onoff" id="onoff" @change="setStorage('enabled', enabled)" v-model="enabled">
      <h1>
        Are.na Subway
      </h1>
    </div>
    <br>
    <label for="restAtStation">time waiting per site</label>
    <div class="input-wrapper">
      <input type="range" name="restAtStation" id="" min="30" max="200" @change="setStorage('restingTime', restVal)" v-model.number="restVal">
      <p>{{ convertToTime(restVal) }}</p>
    </div>
    
    <div class="input-wrapper">
      <label for="instantCommute">fun mode</label>
      <input type="checkbox" name="instantCommute" id="" @change="setStorage('funMode', funMode)" v-model="funMode">
    </div>
    
    <template v-if="funMode" >
      <label for="commutingTime">time for commuting between stations</label>
      <div class="input-wrapper">
        <input type="range" name="commuting time" min="10" max="40" @change="setStorage('commutingTime', commVal)" v-model.number="commVal">
        <p>{{ convertToTime(commVal) }}</p>
      </div>
    </template>
    <label class="additional-info">if you want to see more lines and channels with more than 1500 blocks you can authorize this application with your are.na account.</label>
    <button @click="authorizeArena()"><span v-if="!isAuthorized">authorize</span><span class="gray" v-else>authorized</span></button>
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
</style>
