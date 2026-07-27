<script setup lang="ts">
import { ref } from 'vue'
import { AssetMap, DetailsSection } from 'vue-asset-map'
import { useSiteTheme } from '../theme/useSiteTheme'
import { useSiteLocale } from '../theme/useSiteLocale'
import type { AssetMeta } from './fixture'
import { entities, links, views, statusColors, kindIcons } from './fixture'

// Opened by default so the custom panel is visible without a click — a real
// app would not do this, but a demo should not make "click a node first" a
// precondition for seeing what it demonstrates.
const openDetails = ref(['ws-artjom'])
const selection = ref(['ws-artjom'])
const theme = useSiteTheme()
const locale = useSiteLocale()

// Field labels are the consumer's business: the package never guesses what
// lives in `meta`.
const LABELS: Record<keyof AssetMeta & string, string> = {
  owner: 'Owner',
  os: 'OS',
  externalIp: 'External IP',
  overlayIp: 'Overlay IP',
  fqdn: 'FQDN',
  cpu: 'vCPU',
  ramGb: 'RAM, GB',
  location: 'Location',
  subnet: 'Subnet',
  assetType: 'Asset type',
  severity: 'Severity',
  tags: 'Tags',
}

function rows(meta: AssetMeta | undefined) {
  if (!meta) return []
  return Object.entries(meta)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ({
      key,
      label: LABELS[key as keyof typeof LABELS] ?? key,
      value: Array.isArray(value) ? value.join(', ') : String(value),
    }))
}
</script>

<template>
  <AssetMap
    v-model:open-details="openDetails"
    v-model:selection="selection"
    class="demo-map"
    view="physical"
    :entities="entities"
    :links="links"
    :views="views"
    :theme="theme"
    :locale="locale"
    :theme-config="{ statusColors, kindIcons }"
    :layout="{ engine: 'radial', options: { rootId: 'internet' } }"
    auto-fit-view
  >
    <template #details="{ entity }">
      <DetailsSection title="Inventory">
        <div v-for="row in rows(entity.meta)" :key="row.key" class="details-row">
          <span class="details-row__key">{{ row.label }}</span>
          <span class="details-row__value">{{ row.value }}</span>
        </div>
      </DetailsSection>
    </template>
  </AssetMap>
</template>

<style scoped>
.details-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 3px 0;
  font-size: 13px;
}

.details-row__key {
  color: var(--vp-c-text-2);
}
</style>
