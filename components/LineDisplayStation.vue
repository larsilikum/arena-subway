<script lang="ts" setup>
const props = defineProps<{
  station: any,
  url: string,
  color: string,
  index: string | number,
  stationIndex: number,
  nextStationIndex: number,
  commuting: boolean
}>()

const stationEl = ref<HTMLElement | null>(null)

onMounted(() => {
  if (props.stationIndex === props.index) {
    stationEl.value?.scrollIntoView({behavior: 'smooth', block: 'center', inline: 'center'})
  }
})
</script>

<template>
  <div class="station" ref="stationEl">
    <h5 ref="stationTitle">{{ station.generated_title }}</h5>
    <div :class="{'indicator': true, 'active': stationIndex === index && nextStationIndex < 0, 'arriving-at': nextStationIndex === index && commuting}"></div>
  </div>
</template>

<style scoped>
.station {
  width: 1em;
  overflow: visible;
  position: relative;
  margin-left: 4em;
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
  transform-origin: 0 100%;
  transform: rotate(-30deg) translate(.5em, .2em);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 10rem;
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

.station .indicator.active::after {
  content: '';
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  mix-blend-mode: difference;
  background: radial-gradient(white 20%, transparent 70%);
}

.station .indicator.arriving-at::after {
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