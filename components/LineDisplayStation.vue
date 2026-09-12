<script lang="ts" setup>
import { ArenaBlock } from '@/types';

const props = defineProps<{
  station: ArenaBlock,
  url: string,
  color: string,
  textColor: string,
  index: string | number,
  stationIndex: number,
  nextStationIndex: number,
  commuting: boolean
}>()

const stationEl = ref<HTMLElement | null>(null)

onMounted(() => {
  if (props.stationIndex === props.index) {
    stationEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
  }
})
</script>

<template>
  <div
    :class="{ 'station': true, 'active': stationIndex === index && nextStationIndex < 0, 'arriving-at': nextStationIndex === index && commuting }"
    ref="stationEl">
    <h5 ref="stationTitle">{{ station.title }}</h5>
    <div class="indicator"></div>
  </div>
</template>

<style scoped>
.station {
  width: 1em;
  overflow: visible;
  position: relative;
  margin-left: 4em;
}

.station.active h5 {
  background-color: v-bind(color);
  color: v-bind(textColor);
  /* border-radius: .5em; */
}

.station:first-of-type {
  margin-left: 0;
}

.station h5 {
  color: var(--text-color);
  /* font-family: BrigadeCondensed, sans-serif;
  letter-spacing: .02em; */
  display: block;
  font-size: medium;
  margin: 0;
  padding: .2em;
  transform-origin: 0 100%;
  transform: rotate(-30deg) translate(.5em, .2em);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 15em;
  width: min-content;
  font-weight: normal;
  line-height: 0.9;
}

.station .indicator {
  position: relative;
  background: v-bind(color);
  width: 1em;
  height: 1em;
  border-radius: 50%;
}

.station.active .indicator::after {
  content: '';
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  mix-blend-mode: difference;
  background: radial-gradient(white 20%, transparent 70%);
}

.station.arriving-at .indicator::after {
  content: '';
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  mix-blend-mode: difference;
  animation: blinking .5s ease-in-out alternate infinite;
}

@keyframes blinking {
  from {
    background: radial-gradient(transparent);
  }

  to {
    background: radial-gradient(white 20%, transparent 70%);
  }
}
</style>