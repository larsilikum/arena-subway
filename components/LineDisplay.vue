<script lang="ts" setup>
  const props = defineProps(['line'])
  const emit = defineEmits<{
    (e: 'start', value: string): void
  }>()
  const url = ref<string>('')

  const filteredContents = computed(() => {
    if (!props.line) return []
    return props.line.contents.filter((c: any) => c.class === 'Link')
  })

  onMounted(() => {
    url.value = window.location.href
  })
</script>

<template>
  <div class="line">
    <div class="metadata">
      <h3>{{ line.title }}</h3>
      <p v-if="line.metadata" class="description">{{ line.metadata.description }}</p>
      <div class="button-container">
        <button @click="emit('start', 'forwards')">-> {{ filteredContents[filteredContents.length - 1].title }}</button>
        <button @click="emit('start', 'backwards')">-> {{ filteredContents[0].title }}</button>
      </div>
    </div>
    <div class="stations">
      <template v-for="station in filteredContents">
        <div class="station">
          <h5>{{ station.title }}</h5>
          <div :class="{'indicator': true, 'active': station.source?.url === url}"></div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100dvw;
  height: 400px;
  display: grid;
  grid-template-columns: 400px 1fr;
  background: white;
  padding: .2rem;
}

.button-container {
  display: flex;
}

.stations {
  display: flex;
  align-self: bottom;
  align-items: end;
  overflow-x: auto;
}

.station {
  width: 3em;
}

.station h5 {
  margin: 0 0 0 1em;
  transform-origin: 0 100%;
  transform: rotate(-50deg);
  white-space: nowrap;
}

.station .indicator {
  background: darkgray;
  width: 1em;
  height: 1em;
  border-radius: 50%;
}

.station .indicator.active {
  background: radial-gradient(yellow, orange);
}
</style>