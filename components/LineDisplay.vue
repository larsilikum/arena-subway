<script lang="ts" setup>
  import LineDisplayStation from './LineDisplayStation.vue'
  import CloseIcon from './CloseIcon.vue'
  const props = defineProps(['line', 'stationIndex', 'commuting', 'nextStationIndex'])
  const emit = defineEmits<{
    (e: 'start', value: string): void,
    (e: 'close'): void,
  }>()
  const url = ref<string>('')
  const color = computed<string>(() => {
    if (!props.line) return '#000'
    return hashColor.hashStringToColor(props.line.slug).primary
  })

  const textColor = computed<string>(() => {
    if (!props.line) return '#fff'
    return hashColor.hashStringToColor(props.line.slug).secondary
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
    <button id="close" @click="emit('close')"><CloseIcon/></button>
    <div class="left-column-top">
      <span class="line-abbr">{{ line.title.substring(0, 1) }}</span>
      <div>
        <h2>{{ line.title }}</h2>
      </div>
    </div>
    <div class="author-link">
      <p id="author" v-if="line.user">by: {{ line.user.username }}</p>
      <a id="channel-link" :href="`https://www.are.na/${line.user.slug}/${line.slug}`">are.na channel</a>
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
   
  </div>
</template>

<style scoped>
.line {
  width: calc(100% - .8rem);
  position: relative;
  /* height: 400px; */
  display: grid;
  grid-template-columns: auto 1fr 50%;
  column-gap: 2rem;
  background: Field;
  padding: .4rem .4rem 32px .4rem;
  overflow-y: hidden;
  /* border-bottom: 2.5px solid var(--text-color); */
}

button#close {
  position: absolute;
  right: .4rem;
  top: .4rem;
  width: 1.7em;
  height: 1.7em;
  padding: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: small;
}

.left-column-top {
  display: flex;
  flex-direction: row;
}

h2 {
  position: relative;
  margin: .35em 0 1rem 0;
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
  margin: 1em 0;
  position: relative;
  max-width: 40em;
  padding-right: 1.5em;
  pointer-events: none;
  font-size: small;
}

.author-link {
  margin: 1em 0;
}

.line-abbr {
  background-color: v-bind(color);
  color: v-bind(textColor);
  width: 1.5em;
  height: 1.3em;
  padding-top: .2em;
  margin-right: 1rem;
  border-radius: 50%;
  font-size: x-large;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: center;
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
  grid-column: span 3;
  font-size: medium;
  height: 10em;
  padding-bottom: .5em;
  /* margin-bottom: .5em; */
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
</style>