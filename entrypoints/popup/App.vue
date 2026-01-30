<script lang="ts" setup>
  const restVal = ref<number>(30)
  const commVal = ref<number>(10)
  const funMode = ref<boolean>(false)
  function setStorage(key: string, value: number | boolean) {
    console.log('set value', key, value)
    storage.setItem(`local:${key}`, value)
  }
  onMounted(async() => {
    restVal.value = await storage.getItem<number | null>('local:restingTime') || 30
    commVal.value = await storage.getItem<number | null>('local:commutingTime') || 10
    funMode.value = await storage.getItem<boolean | null>('local:funMode') || false
  })
</script>

<template>
  <div>
    <div class="input-wrapper">
      <label for="restAtStation">time per site</label>
      <input type="range" name="restAtStation" id="" min="30" max="200" @change="setStorage('restingTime', restVal)" v-model.number="restVal">
      <p>{{ restVal }}</p>
    </div>
    
    <div class="input-wrapper">
      <label for="instantCommute">fun mode</label>
      <input type="checkbox" name="instantCommute" id="" @change="setStorage('funMode', funMode)" v-model="funMode">
    </div>

    <div v-if="funMode" class="input-wrapper">
      <label for="commutingTime">time for commuting between stations</label>
      <input type="range" name="commuting time" min="10" max="40" @change="setStorage('commutingTime', commVal)" v-model.number="commVal">
    </div>
  </div>
</template>

<style scoped>
  .input-wrapper {
    display: flex;
  }
</style>
