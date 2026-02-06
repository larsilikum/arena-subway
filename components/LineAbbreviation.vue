<script lang="ts" setup>
import { ArenaChannel } from '@/types'
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
  <ColoredPill :inactive="inactive" :abbr="line.title.substring(0,1)" :rest-text="line.title.substring(1)" :bg-color="hashColor.hashStringToColor(line.slug).primary" :text-color="hashColor.hashStringToColor(line.slug).secondary" @click="$emit('open', line.slug)"/>
  <!-- <div :class="{'lines': true, 'inactive': inactive }" :style="`background-color: ${hashColor.hashStringToColor(line.slug).primary};`" @click="$emit('open', line.slug)">
    <h5 class="line-abbr" :style="`color: ${hashColor.hashStringToColor(line.slug).secondary};`">{{ line.title.substring(0,1) }}<span>{{ line.title.substring(1) }}</span></h5>
  </div> -->
</template>
