<script lang="ts" setup>
  const restVal = ref<number>(20)
  const commVal = ref<number>(10)
  const instant = ref<boolean>(false)
  function setStorage(key: string, value: number | boolean) {
    console.log('set value', key, value)
    storage.setItem(`local:${key}`, value)
  }
  onMounted(async() => {
    restVal.value = await storage.getItem<number | null>('local:restingTime') || 20
    commVal.value = await storage.getItem<number | null>('local:commutingTime') || 10
    instant.value = await storage.getItem<boolean | null>('local:instantCommute') || false
    console.log(restVal.value, commVal.value, instant.value)
  })
</script>

<template>
  <div>
    <div class="input-wrapper">
      <label for="restAtStation">time waiting at station</label>
      <input type="range" name="restAtStation" id="" min="10" max="200" @input="setStorage('restingTime', restVal)" v-model.number="restVal">
    </div>
    
    <div class="input-wrapper">
      <label for="commutingTime">time for commuting between stations</label>
      <input type="range" name="commuting time" min="10" max="120" @input="setStorage('commutingTime', commVal)" v-model.number="commVal">
    </div>
    
    <div class="input-wrapper">
      <label for="instantCommute">instant commuting</label>
      <input type="checkbox" name="instantCommute" id="" @input="setStorage('instantCommute', instant)" v-model="instant">
    </div>
  </div>
</template>

<style scoped>
  .input-wrapper {
    display: flex;
  }
</style>
