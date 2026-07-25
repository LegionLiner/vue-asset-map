<script setup lang="ts">
import { computed, ref } from 'vue'
import { AssetMap } from 'vue-asset-map'
import { entities, links, views, statusColors, kindIcons } from './fixture'

const engine = ref<'radial' | 'manual'>('radial')

// Engine options are engine-specific and pass through untouched.
const layout = computed(() =>
  engine.value === 'radial'
    ? { engine: 'radial', options: { radius: 240, ringGap: 190 } }
    : { engine: 'manual', options: { columns: 6 } },
)
</script>

<template>
  <AssetMap
    class="demo-map"
    view="physical"
    :entities="entities"
    :links="links"
    :views="views"
    :layout="layout"
    :theme-config="{ statusColors, kindIcons }"
  >
    <template #toolbar-right>
      <button
        type="button"
        class="demo-toolbar-button"
        @click="engine = engine === 'radial' ? 'manual' : 'radial'"
      >
        Engine: {{ engine }}
      </button>
    </template>
  </AssetMap>
</template>
