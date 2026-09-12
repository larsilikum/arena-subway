<script lang="ts" setup>
const props = defineProps<{
  shouldEmit?: boolean
}>()

const emits = defineEmits<{
  (e: 'scrolledToEnd'): void
}>()
const scrollContainer = ref<HTMLElement | null>(null)

let scrollLeft = 0
const handleHorizontalScroll = (e: WheelEvent) => {
  if (!e.shiftKey && scrollContainer.value && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    e.preventDefault()
    scrollLeft = Math.min(Math.max(scrollLeft + e.deltaY, 0), scrollContainer.value.scrollWidth - scrollContainer.value.clientWidth)
    scrollContainer.value.scrollLeft = scrollLeft
  }
  if (props.shouldEmit && scrollContainer.value && scrollContainer.value.scrollLeft >= (scrollContainer.value.scrollWidth - scrollContainer.value.clientWidth) - 30) {
    emits('scrolledToEnd')
  }
}

onMounted(() => {
  setTimeout(() => {
    scrollLeft = scrollContainer.value?.scrollLeft || 0
  }, 300)
})
</script>

<template>
  <div ref="scrollContainer" @wheel="handleHorizontalScroll">
    <slot></slot>
  </div>
</template>

<style scoped>
div {
  overflow-x: auto;
  scroll-behavior: smooth;
}

 /* Hide scrollbar for Chrome, Safari and Opera */
div::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
div {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
} 
</style>