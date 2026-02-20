<script lang="ts" setup>
  import LineDisplayStation from './LineDisplayStation.vue'
  import HorizontalScroll from './HorizontalScroll.vue'
  import CloseIcon from './CloseIcon.vue'
  const props = defineProps(['line', 'stationIndex', 'commuting', 'nextStationIndex'])
  const emits = defineEmits<{
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
    if (!props.line || !props.line.contents?.length) return []
    return props.line.contents.filter((c: any) => c.class === 'Link')
  })

  onMounted(() => {
    url.value = window.location.href
  })

  const closed = ref<boolean>(false)

  function handleClick() {
    closed.value = true
    setTimeout(() => {
      emits('close')
    }, 300)
  }
</script>

<template>
  <div :class="{ 'line': true, 'closed': closed, 'commuting': commuting }">
    <button v-if="!commuting" id="close" @click="handleClick()"><CloseIcon/></button>
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
    <HorizontalScroll class="stations">
      <div class="stations-container">
        <hr id="stations-line"/>
        <template v-for="(station, i) in filteredContents">
          <LineDisplayStation :station="station" :url="url" :color="color" :text-color="textColor" :commuting="commuting" :station-index="stationIndex" :index="i" :next-station-index="nextStationIndex"/>
        </template> 
      </div>
    </HorizontalScroll>   
    <svg id="filter-svg">
      <defs>
          <filter style="color-interpolation-filters:sRGB" id="filter-big-sizes" x="-0.00050549034" y="-0.00066535256"
            width="1.001011" height="1.0013307">
            <feTurbulence type="fractalNoise" numOctaves="3" baseFrequency=".3" seed="0" result="result0"
              id="feTurbulence30550" />
            <feColorMatrix result="result4" values="0" type="saturate" id="feColorMatrix30552" />
            <feComposite in="SourceGraphic" in2="result4" operator="arithmetic" k1="0.24" k2="0.1369863" k3="0.33"
              result="result2" id="feComposite30554" k4="0" />
            <feBlend result="result5" mode="screen" in="result2" in2="SourceGraphic" id="feBlend30556" />
            <feComposite in="result5" in2="SourceGraphic" operator="in" result="fbSourceGraphic" id="feComposite30558" />
            <feColorMatrix result="fbSourceGraphicAlpha" in="fbSourceGraphic"
              values="0 0 0 -1 0 0 0 0 -1 0 0 0 0 -1 0 0 0 0 1 0" id="feColorMatrix30615" />
            <feGaussianBlur id="feGaussianBlur30617" stdDeviation="0.3 0.6" result="blur" in="fbSourceGraphic" />
          </filter>
      </defs>
    </svg>
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
  background: #333;
  padding: .4rem .4rem 32px .4rem;
  overflow-y: hidden;
  animation: appear .3s ease-out;
  transform: translateY(0);
  transition: transform .3s ease-in;
  /* border-bottom: 2.5px solid var(--text-color); */
}
.line.commuting {
  background: linear-gradient(to bottom, #fff 20%, #fffd 85%, transparent);
  /* background: #ffffffaa; */
  width: 60%;
  margin-inline: auto;
  color: #333 !important;
  animation: appear-commuting .3s ease-out;
  filter: url(#filter-big-sizes);
  transform: perspective(15vw) rotateX(-10deg) translate(1.3vw, 15%);
  transform-style: preserve-3d;
  transform-origin: center bottom;
  /* mix-blend-mode: hard-light; */
}

#filter-svg {
  /* display: none; */
  height: 0;
  width: 0;
}

.line.commuting:deep(h5), .line.commuting h2 {
  color: #333;
}
.line.closed {
  animation: none;
  transform: translateY(100%);
}
.line.closed.commuting {
  animation: none;
  transform: translateY(-100%);
}

@keyframes appear-commuting {
  from {
    transform: translateY(-100%)
  }
  to {
    transform: translateY(0);
  }
}

@keyframes appear {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
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
  border: .05em solid v-bind(textColor);
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
  display: flex;
  align-items: end;
  grid-column: span 3;
  font-size: medium;
  height: 10em;
  padding-bottom: .5em;
  /* margin-bottom: .5em; */
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