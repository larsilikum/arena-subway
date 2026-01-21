<script lang="ts" setup>
  import LineDisplayStation from './LineDisplayStation.vue'
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
    <h2><span class="line-abbr">{{ line.title.substring(0, 1) }}</span>&nbsp;&ThickSpace;{{ line.title }}</h2>
    <div class="metadata">
      <p v-if="line.metadata && line.metadata.description != ''" class="description">{{ line.metadata.description }}</p>
      <div class="button-container">
        <button @click="emit('start', 'forwards')">-> {{ filteredContents[filteredContents.length - 1].title }}</button>
        <button @click="emit('start', 'backwards')">-> {{ filteredContents[0].title }}</button>
      </div>
    </div>
    <div class="stations">
      <div class="stations-container">
        <hr id="stations-line"/>
        <template v-for="station in filteredContents">
          <LineDisplayStation :station="station" :url="url" :color="color"/>
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
  margin: .2em 0;
  line-height: 1;
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
  width: calc(100% - .5em);
  border-radius: .1rem;
  background-color: v-bind(color);
  position: absolute;
  bottom: .4rem;
  border: none;
  margin: 0;
  /* z-index: 99998; */
}

.stations {
  overflow-x: auto;
  display: flex;
  align-items: end;
  grid-column: span 2;
  height: 15em;
}

.stations-container {
  width: max-content;
  display: flex;
  align-self: bottom;
  align-items: end;
  position: relative;
}
</style>