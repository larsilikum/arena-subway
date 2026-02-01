<script lang="ts" setup>
import { convertToTime } from '@/utils/compareRoute'

  const restVal = ref<number>(30)
  const commVal = ref<number>(10)
  const funMode = ref<boolean>(false)
  const enabled = ref<boolean>(true)
  function setStorage(key: string, value: number | boolean) {
    console.log('set value', key, value)
    storage.setItem(`local:${key}`, value)
  }
  onMounted(async() => {
    restVal.value = await storage.getItem<number | null>('local:restingTime') || 30
    commVal.value = await storage.getItem<number | null>('local:commutingTime') || 10
    funMode.value = await storage.getItem<boolean | null>('local:funMode') || false
    const localEnabled = await storage.getItem<boolean | null>('local:enabled')
    enabled.value = localEnabled !== null ? localEnabled : true
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
    
    <div v-if="false" class="input-wrapper">
      <label for="instantCommute">fun mode</label>
      <input type="checkbox" name="instantCommute" id="" @change="setStorage('funMode', funMode)" v-model="funMode">
    </div>

    <div v-if="funMode" class="input-wrapper">
      <label for="commutingTime">time for commuting between stations</label>
      <input type="range" name="commuting time" min="10" max="40" @change="setStorage('commutingTime', commVal)" v-model.number="commVal">
    </div>
  </div>
</template>

<style scoped>
  .header {
    display: flex;
    align-items: center;
    margin-bottom: 1em;
  }
  label {
    margin: 0;
  }
  #onoff {
    appearance: none;
    color: GrayText;
    float: left;
    margin-right: 1em;
  }
  #onoff:checked {
    color: FieldText;
  }
  #onoff::after {
    content: '⏼';
    font-size: xx-large;
    width: 100%;
    transform: translateX(-100%);
    cursor: pointer;
  }
  #onoff:checked::after {
    text-shadow: FieldText 0 0 5px;
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
    font-weight: normal;
  }
</style>
