<script lang="ts" setup>
defineProps<{
  station: any,
  url: string,
  color: string,
  index: string | number,
  stationIndex: number,
  nextStationIndex: number,
  commuting: boolean
}>()

// const stationTitle = ref<HTMLElement | null>(null)
// const height = ref<string>('4em')
// onMounted(() => {
//   nextTick(() => {
//     setTimeout(() => {
//       // wait for a bit because else the first titles arent rendered correctly yet
//       const elementHeight = stationTitle.value?.clientHeight || 18
//       // sin 30 deg should be 0.5
//       console.log(elementHeight)
//       height.value = `calc(${elementHeight * 2}px + 1em)`
//     }, 300)
//   })
// })
  
// const height = computed<string>(() => {
//   if (!stationTitle.value) return '5em'
//   const elementHeight = stationTitle.value.clientHeight
//   // sin 30 deg should be 0.5
//   return `calc(${elementHeight * 2}px + 1em)`
// })
</script>

<template>
  <div class="station">
    <h5 ref="stationTitle">{{ station.title }}</h5>
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
  max-width: 10em;
  width: min-content;
  font-weight: normal;
  line-height: 0.9;
}

.station .indicator {
  background: v-bind(color);
  width: 1em;
  height: 1em;
  border-radius: 50%;
}

.station .indicator.active {
  background: radial-gradient(yellow, v-bind(color) 90%);
}

.station .indicator.arriving-at {
  animation: blinking .5s ease-in-out alternate infinite;
}

@keyframes blinking {
  from {
    background: radial-gradient(v-bind(color));
  }
  to {
    background: radial-gradient(yellow, v-bind(color) 90%);
  }
}
</style>