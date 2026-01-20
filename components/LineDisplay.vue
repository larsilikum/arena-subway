<script lang="ts" setup>
  const props = defineProps(['line'])
  const emit = defineEmits<{
    (e: 'start', value: string): void
  }>()
  const url = ref<string>('')
  const color = ref<string>('')

  const filteredContents = computed(() => {
    if (!props.line) return []
    return props.line.contents.filter((c: any) => c.class === 'Link')
  })

  onMounted(() => {
    url.value = window.location.href
    color.value = hashColor.hashStringToColor(props.line.title)
    console.log(color.value)
  })
</script>

<template>
  <div class="line">
    <h2><span class="line-abbr"> {{ line.title.substring(0, 1) }}</span>{{ line.title }}</h2>
    <div class="metadata">
      <p v-if="line.metadata" class="description">{{ line.metadata.description }}</p>
      <div class="button-container">
        <button @click="emit('start', 'forwards')">-> {{ filteredContents[filteredContents.length - 1].title }}</button>
        <button @click="emit('start', 'backwards')">-> {{ filteredContents[0].title }}</button>
      </div>
    </div>
    <div class="stations">
      <div class="stations-container">
        <div id="stations-line"></div>
        <template v-for="station in filteredContents">
          <div class="station">
            <h5>{{ station.title }}</h5>
            <div :class="{'indicator': true, 'active': station.source?.url === url}"></div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line {
  width: 100dvw;
  height: 400px;
  display: grid;
  grid-template-columns: 400px 1fr;
  background: white;
  padding: .2rem;
}

h2 {
  margin-top: 2rem;
}

.line-abbr {
  background-color: v-bind(color);
  color: white;
  width: 1.5em;
  height: 1.5em;
  border-radius: 50%;
  display: inline-flex;
  justify-content: center;
  align-items: center;
}

.button-container {
  display: flex;
}

#stations-line {
  height: .2rem;
  width: calc(100% - 4.5em);
  border-radius: .1rem;
  background-color: v-bind(color);
  position: absolute;
  bottom: .4rem;
  /* z-index: 99998; */
}

.stations {
  overflow-x: auto;
  display: flex;
  align-items: end;
  grid-column: span 2;
}

.stations-container {
  width: max-content;
  display: flex;
  align-self: bottom;
  align-items: end;
  position: relative;
}

.station {
  width: 5em;
  overflow: visible;
  position: relative;
}

.station h5 {
  margin: 0;
  transform-origin: 0 50%;
  transform: rotate(-30deg) translate(1em, 1em);
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