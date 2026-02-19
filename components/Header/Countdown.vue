<script lang="ts" setup>
const props = defineProps<{
  headerOpen: boolean
}>()

const restingTime = ref(10000)

onMounted(async () => {
  const tabId = await browser.runtime.sendMessage({ type: 'getTabId' })
  console.log('countdown tab id', tabId)
  restingTime.value = await storage.getItem<number>('local:restingTime') || 10000
  const unwatch = storage.watch<number>(`local:timeToDeparture:${tabId}`, newVal => {
    if (newVal === null) return
    restingTime.value = newVal / 1000
  })
  onBeforeUnmount(() => {
    unwatch()
  })
})

</script>

<template>
    <p id="departure-time"><span v-if="headerOpen">departing in </span><span>{{ convertToTime(restingTime) }}</span></p>
</template>

<style scoped>
#departure-time {
  justify-self: end;
}
</style>