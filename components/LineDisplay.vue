<script lang="ts" setup>
  import LineDisplayStation from './LineDisplayStation.vue'
  const props = defineProps(['line'])
  const emit = defineEmits<{
    (e: 'start', value: string): void
  }>()
  const url = ref<string>('')
  const color = computed<string>(() => {
    if (!props.line) return '#000'
    return hashColor.hashStringToColor(props.line.title).primary
  })

  const textColor = computed<string>(() => {
    if (!props.line) return '#fff'
    return hashColor.hashStringToColor(props.line.title).secondary
  })

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
    <h2><span class="line-abbr">{{ line.title.substring(0, 1) }}</span>&nbsp;&ThickSpace;{{ line.title }}</h2>
    <div class="metadata">
      <p v-if="line.metadata && line.metadata.description != ''" class="description">{{ line.metadata.description }}</p>
    </div>
    <div class="stations">
      <div class="stations-container">
        <hr id="stations-line"/>
        <template v-for="station in filteredContents">
          <LineDisplayStation :station="station" :url="url" :color="color"/>
        </template>
      </div>
    </div>
    <div class="button-container">
      <button @click="emit('start', 'backwards')">← <span>{{ filteredContents[0].title }}</span></button>
      <button @click="emit('start', 'forwards')"><span>{{ filteredContents[filteredContents.length - 1].title }}</span> →</button>
    </div>
  </div>
</template>

<style scoped>
.line {
  width: calc(100% - 2rem);
  /* height: 400px; */
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 1rem;
  background: linear-gradient(to top, gray, white 30%);
  padding: 1rem;
  border-bottom: 2.5px solid var(--text-color);
}

h2 {
  margin: .2em 0;
  color: var(--text-color);
  font-weight: normal;
  line-height: 1;
}

.description {
  max-width: 40em;
}

.line-abbr {
  background-color: v-bind(color);
  color: v-bind(textColor);
  width: 1.5em;
  height: 1.5em;
  border-radius: 50%;
  display: inline-flex;
  justify-content: center;
  align-items: center;
}

.button-container {
  display: flex;
  grid-column: span 2;
  justify-content: center;
  gap: 1rem;
}

#stations-line {
  height: .4rem;
  width: calc(100% - .5em);
  border-radius: .1rem;
  background-color: v-bind(color);
  position: absolute;
  bottom: .3rem;
  border: none;
  margin: 0;
  /* z-index: 99998; */
}

.stations {
  overflow-x: auto;
  scrollbar-color: white var(--text-color);
  scrollbar-width: thin;
  display: flex;
  align-items: end;
  grid-column: span 2;
  height: 15em;
  padding-bottom: .5em;
  margin-bottom: .5em;
}

 /* Hide scrollbar for Chrome, Safari and Opera */
.stations::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
.stations {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
} 

.stations-container {
  width: max-content;
  display: flex;
  align-self: bottom;
  align-items: end;
  position: relative;
}

button {
  display: flex;
  font-size: 1.2rem;
  background-color: transparent;
  color: var(--text-color);
  border: 2.5px solid var(--text-color);
  height: 1.5em;
  border-radius: .75em;
  padding: .1em .5em 0 .5em;
  cursor: pointer;
}

button span {
  max-width: 20rem;
  height: 1.5em;
  overflow: hidden;
  white-space: nowrap;
  display: inline-block;
  text-overflow: ellipsis;
}

button:hover {
  background-color: v-bind(color);
  border-color: v-bind(color);
  color: v-bind(textColor);
}
</style>