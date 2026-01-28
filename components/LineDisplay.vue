<script lang="ts" setup>
  import LineDisplayStation from './LineDisplayStation.vue'
  const props = defineProps(['line', 'stationIndex', 'commuting', 'nextStationIndex'])
  const emit = defineEmits<{
    (e: 'start', value: string): void,
    (e: 'close'): void,
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
    <button id="close" @click="emit('close')">x</button>
    <div class="left-column-top">
      <span class="line-abbr">{{ line.title.substring(0, 1) }}</span>
      <div>
        <h2>{{ line.title }}</h2>
        <p id="author" v-if="line.user">by: {{ line.user.username }}</p>
        <a id="channel-link" :href="`https://www.are.na/${line.user.slug}/${line.slug}`">are.na channel</a>
      </div>
    </div>
    <div class="metadata">
      <p v-if="line.metadata && line.metadata.description != ''" class="description">{{ line.metadata.description }}</p>
    </div>
    <div class="stations">
      <div class="stations-container">
        <hr id="stations-line"/>
        <template v-for="(station, i) in filteredContents">
          <LineDisplayStation :station="station" :url="url" :color="color" :commuting="commuting" :station-index="stationIndex" :index="i" :next-station-index="nextStationIndex"/>
        </template> 
      </div>
    </div>
    <div class="button-container" v-if="!commuting">
      <button v-if="stationIndex > 0" @click="emit('start', 'backwards')">← <span>{{ filteredContents[0].title }}</span></button>
      <button v-if="stationIndex < line.length - 1" @click="emit('start', 'forwards')"><span>{{ filteredContents[filteredContents.length - 1].title }}</span> →</button>
    </div>
  </div>
</template>

<style scoped>
.line {
  width: calc(100dvw - .8rem);
  position: relative;
  /* height: 400px; */
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 1rem;
  background: Field;
  padding: 1rem .4rem calc(1rem + 32px) .4rem;
  overflow-y: hidden;
  /* border-bottom: 2.5px solid var(--text-color); */
}

button#close {
  position: absolute;
  right: 1rem;
  top: 1rem;
}

.left-column-top {
  display: flex;
  flex-direction: row;
}

h2 {
  position: relative;
  margin: .25em 0 1rem 0;
  color: var(--text-color);
  font-weight: normal;
  font-size: x-large;
  line-height: 1;
}

#author, #channel-link {
  margin: 0;
  font-size: small;
}

.description {
  margin: 0.5em 0;
  position: relative;
  max-width: 40em;
  padding-right: 1.5em;
  pointer-events: none;
  font-size: small;
}

.line-abbr {
  background-color: v-bind(color);
  color: v-bind(textColor);
  width: 1.5em;
  height: 1.5em;
  margin-right: 1rem;
  border-radius: 50%;
  font-size: x-large;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.button-container {
  position: relative;
  display: flex;
  grid-column: span 2;
  justify-content: center;
  gap: 1rem;
}

#stations-line {
  height: .4em;
  width: calc(100% - .5em);
  border-radius: .1rem;
  background-color: v-bind(color);
  position: absolute;
  bottom: .3em;
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
  height: 10em;
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
  font-size: medium;
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