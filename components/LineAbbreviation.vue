<script lang="ts" setup>
import type { ArenaChannel } from '@/types'
import ColoredPill from './ColoredPill.vue'

defineProps<{
  line: ArenaChannel,
  inactive: boolean,
}>()

defineEmits<{
  (e: 'open', payload: string): void
}>()
</script>

<template>
  <ColoredPill :inactive="inactive" :abbr="line.title.substring(0, 1)" :rest-text="line.title.substring(1)"
    :bg-color="hashStringToColor(line.slug).primary" :text-color="hashStringToColor(line.slug).secondary"
    @click="$emit('open', line.slug)" @keyup.enter="$emit('open', line.slug)" @keyup.space="$emit('open', line.slug)" />
</template>
