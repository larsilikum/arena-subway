<script lang="ts" setup>
import background from '../background'

  const lines = ref(null)

  function startRide(id: number) {
    browser.runtime.sendMessage({ type: "start", value: { id }})
  }

  function getDomainFromUrl(url: string): string {
    const regex = /^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i
    const match = url.match(regex)
    return match ? match[1] : ''
  }

  // Thanks to clyzermk1 https://stackoverflow.com/questions/11120840/hash-string-into-rgb-color
  function djb2(str: string){
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
    }
    return hash;
  }

  function hashStringToColor(str: string) {
    var hash = djb2(str);
    var r = (hash & 0xFF0000) >> 16;
    var g = (hash & 0x00FF00) >> 8;
    var b = hash & 0x0000FF;
    return "rgb(" + r + "," + g + "," + b + ")"
  }


  onMounted(async () => {
    const url = window.location.href
    const domain = getDomainFromUrl(url)
    try {
      browser.runtime.sendMessage({
        type: "fetchLines",
        value: { domain }
      }).then(d => {
        lines.value = d
      })
    } catch (error) {
      console.error("failed to fetch lines:", error)
    }
  })
</script>

<template>
  <div class="container">
    <template v-if="lines">
      <div v-for="line in lines" class="lines" :style="`background-color: ${hashStringToColor(line.name)};`">
        <h5>Line: {{ line.name }}</h5>
        <p>{{ line.description }}</p>
        <button @click="startRide(line.id)">start</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.container {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 999;
  pointer-events: all;
}
</style>