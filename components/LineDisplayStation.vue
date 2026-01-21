<script lang="ts" setup>
defineProps<{
  station: any,
  url: string,
  color: string,
}>()

const stationTitle = ref<HTMLElement | null>(null)
  
const height = computed<string>(() => {
  if (!stationTitle.value) return '5em'
  const elementHeight = stationTitle.value.clientHeight
  // sin 30 deg should be 0.5
  return `calc(${elementHeight * 2}px + 1em)`
})
</script>

<template>
  <div class="station">
    <h5 ref="stationTitle">{{ station.title }}</h5>
    <div :class="{'indicator': true, 'active': station.source?.url === url}"></div>
  </div>
</template>

<style scoped>
.station {
  width: 1em;
  overflow: visible;
  position: relative;
  margin-left: v-bind(height);
}

.station:first-of-type {
  margin-left: 0;
}

.station h5 {
  display: block;
  margin: 0;
  transform-origin: 0 100%;
  transform: rotate(-30deg) translate(.5em, .2em);
  /* white-space: nowrap; */
  width: 20em;
  font-weight: normal;
  line-height: 0.9;
}

.station .indicator {
  background: radial-gradient(gray, v-bind(color));
  width: 1em;
  height: 1em;
  border-radius: 50%;
}

.station .indicator.active {
  background: radial-gradient(yellow, v-bind(color));
}
</style>