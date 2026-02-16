<script lang="ts" setup>
defineProps<{
  inactive?: boolean,
  bgColor: string,
  textColor: string,
  abbr: string,
  restText: string
}>()
</script>

<template>
  <div :class="{'lines': true, 'inactive': inactive }" :style="`background-color: ${bgColor}; border: .05em solid ${textColor};`">
    <h5 class="line-abbr" :style="`color: ${textColor};`">{{ abbr }}<span>{{ restText }}</span></h5>
  </div>
</template>

<style scoped>
.lines {
  position: relative;
  line-height: 1.2;
  font-size: small;
  width: 1.5em;
  height: 1.5em;
  text-align: center;
  margin: 0;
  border-radius: .75em;
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  padding-top: 0;
  /* padding: .4em .3em .2em .3em; */
  cursor: pointer;
  transition: width .4s ease;
  overflow: hidden;
}

.lines.inactive:not(:hover) {
  filter: grayscale();
}

h5 {
  line-height: 1;
  font-size: medium;
  margin: 0;
  font-weight: normal;
  white-space: nowrap;
}

.line-abbr {
  color: white;
  /* mix-blend-mode: difference; */
}

.line-abbr span {
  display: none;
}

.lines:hover .line-abbr {
  animation: marquee 2s alternate ease-in-out infinite;
  transform-origin: 0 0;
}

.lines:hover span {
  display: inline-block;
}

.lines:hover {
  width: 5rem;
  /* max-width: max-content; */
  justify-content: start;
  padding-inline: .3em;
}

@keyframes marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(calc(-100% + 5rem));
  }
}
</style>