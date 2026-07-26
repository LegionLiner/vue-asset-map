<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTranslate } from '../../composables/useTranslate'
import { groupValuesOf, selectedGroupCount } from '../../core/filter'
import { IconCheckbox, IconCheckboxChecked, IconChevron, IconFilter } from '../icons/index'
import type { FacetCounts, FilterGroupDef, FilterState } from '../../types/filter'

/**
 * Filters: a button over the canvas plus a drop-down panel of value lists.
 *
 * The lists are data, not code. "Subnet", "Asset type" and "Severity" all come
 * from the consumer through `groups`; without them the panel falls back to the
 * built-in type and status facets collected from the entities themselves.
 *
 * Filter state is always replaced with a new object, never edited in place: it
 * may be controlled from outside through `v-model:filters`, and a mutation would
 * not raise an update event.
 */
const model = defineModel<FilterState>({
  default: (): FilterState => ({ query: '', types: [], statuses: [] }),
})

/**
 * Which lists are expanded.
 *
 * Exposed through `v-model:openGroups` rather than written to `localStorage`:
 * the package never touches browser storage — persisting across sessions is the
 * application's decision.
 */
const openGroups = defineModel<string[] | undefined>('openGroups', { default: undefined })

const props = defineProps<{
  facets: FacetCounts
  /** List definitions. Without them the type and status facets are shown. */
  groups?: readonly FilterGroupDef[]
}>()

const t = useTranslate()

const open = ref(false)
const query = ref('')

/** Built-in lists used when the consumer declared none. */
const fallbackGroups = computed<FilterGroupDef[]>(() => [
  { id: 'types', label: t.value('filter.types') },
  { id: 'statuses', label: t.value('filter.statuses'), valuesOf: (entity) => [entity.status ?? ''] },
])

const groups = computed(() => props.groups ?? fallbackGroups.value)

/**
 * Values of a list: either declared by the consumer or collected from the data.
 *
 * Counts come from facets over the view projection, so they do not drop to zero
 * once a value is picked — otherwise there would be no way back.
 */
function optionsOf(group: FilterGroupDef): { value: string; label: string; count: number }[] {
  const counts = props.facets.groups.get(group.id) ?? fallbackCounts(group.id)

  const declared = group.options?.map((option) => ({
    value: option.value,
    label: option.label ?? option.value,
    count: counts.get(option.value) ?? 0,
  }))

  const options =
    declared ?? [...counts].map(([value, count]) => ({ value, label: value, count })).sort(byLabel)

  const needle = query.value.trim().toLowerCase()
  if (needle.length === 0) return options
  return options.filter((option) => option.label.toLowerCase().includes(needle))
}

/** The built-in lists read their counts from the type and status facets. */
function fallbackCounts(groupId: string): ReadonlyMap<string, number> {
  if (groupId === 'types') return props.facets.types
  if (groupId === 'statuses') return props.facets.statuses
  return new Map()
}

function byLabel(a: { label: string }, b: { label: string }): number {
  return a.label.localeCompare(b.label)
}

const activeCount = computed(
  () => model.value.types.length + model.value.statuses.length + selectedGroupCount(model.value),
)

function isOpen(group: FilterGroupDef): boolean {
  if (openGroups.value) return openGroups.value.includes(group.id)
  return group.defaultOpen ?? true
}

function toggleGroup(group: FilterGroupDef): void {
  const current = openGroups.value ?? groups.value.filter((g) => g.defaultOpen ?? true).map((g) => g.id)
  openGroups.value = current.includes(group.id)
    ? current.filter((id) => id !== group.id)
    : [...current, group.id]
}

/** Selected values of a list; the built-in lists live in their own state fields. */
function selectedOf(groupId: string): readonly string[] {
  if (groupId === 'types' && !props.groups) return model.value.types
  if (groupId === 'statuses' && !props.groups) return model.value.statuses
  return model.value.groups?.[groupId] ?? []
}

function isChecked(groupId: string, value: string): boolean {
  return selectedOf(groupId).includes(value)
}

function toggleValue(groupId: string, value: string): void {
  const current = selectedOf(groupId)
  const next = current.includes(value)
    ? current.filter((candidate) => candidate !== value)
    : [...current, value]

  if (groupId === 'types' && !props.groups) {
    model.value = { ...model.value, types: next }
    return
  }
  if (groupId === 'statuses' && !props.groups) {
    model.value = { ...model.value, statuses: next }
    return
  }

  model.value = { ...model.value, groups: { ...model.value.groups, [groupId]: next } }
}

function reset(): void {
  if (activeCount.value === 0) return
  // The query is left alone: clearing facets and clearing search are separate acts.
  model.value = { ...model.value, types: [], statuses: [], groups: {} }
}

/** Re-exported for consumers building lists of their own. */
defineExpose({ groupValuesOf })
</script>

<template>
  <div class="vam-filter">
    <button
      type="button"
      class="vam-filter__button"
      :class="{ 'vam-filter__button--active': open }"
      :aria-label="t('filter.label')"
      :aria-expanded="open"
      @click="open = !open"
    >
      <IconFilter />
      <span v-if="activeCount > 0" class="vam-filter__badge">{{ activeCount }}</span>
    </button>

    <section v-if="open" class="vam-filter__panel" :aria-label="t('filter.label')">
      <header class="vam-filter__head">
        <IconFilter class="vam-filter__head-icon" />
        <h3 class="vam-filter__title">{{ t('filter.label') }}</h3>
        <button type="button" class="vam-filter__reset" :disabled="activeCount === 0" @click="reset">
          {{ t('filter.reset') }}
        </button>
      </header>

      <div class="vam-filter__search">
        <input
          v-model="query"
          type="search"
          class="vam-filter__search-input"
          :aria-label="t('filter.search')"
          :placeholder="t('filter.search')"
        />
      </div>

      <div class="vam-filter__groups">
        <section v-for="group in groups" :key="group.id" class="vam-filter__group">
          <button
            type="button"
            class="vam-filter__group-head"
            :aria-expanded="isOpen(group)"
            @click="toggleGroup(group)"
          >
            <span class="vam-filter__group-title">{{ group.label }}</span>
            <IconChevron
              class="vam-filter__chevron"
              :class="{ 'vam-filter__chevron--closed': !isOpen(group) }"
            />
          </button>

          <div v-if="isOpen(group)" class="vam-filter__options">
            <p v-if="optionsOf(group).length === 0" class="vam-filter__empty">
              {{ t('filter.empty') }}
            </p>

            <label v-for="option in optionsOf(group)" :key="option.value" class="vam-filter__option">
              <input
                type="checkbox"
                class="vam-filter__checkbox"
                :checked="isChecked(group.id, option.value)"
                @change="toggleValue(group.id, option.value)"
              />
              <IconCheckboxChecked
                v-if="isChecked(group.id, option.value)"
                class="vam-filter__checkbox-icon vam-filter__checkbox-icon--checked"
              />
              <IconCheckbox v-else class="vam-filter__checkbox-icon" />

              <span class="vam-filter__option-label">{{ option.label }}</span>
              <span class="vam-filter__count">{{ option.count }}</span>
            </label>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

<style>
.vam-filter {
  position: relative;
  flex: 0 0 auto;
}

.vam-filter__button {
  display: flex;
  position: relative;
  align-items: center;
  justify-content: center;
  gap: var(--vam-space-2);
  padding: var(--vam-space-2);
  border: 0;
  border-radius: var(--vam-radius-md);
  background: var(--vam-surface);
  color: var(--vam-fg-muted);
  cursor: pointer;
}

.vam-filter__button:hover,
.vam-filter__button--active {
  color: var(--vam-fg-subtle);
}

.vam-filter__button:focus-visible {
  outline: 2px solid var(--vam-focus-ring);
  outline-offset: 1px;
}

.vam-filter__badge {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 14px;
  border-radius: var(--vam-radius-sm);
  background: var(--vam-accent);
  color: var(--vam-accent-fg);
  font-size: var(--vam-font-size-sm);
  font-weight: var(--vam-font-weight-bold);
  line-height: 14px;
  text-align: center;
}

.vam-filter__panel {
  position: absolute;
  z-index: 30;
  top: calc(100% + var(--vam-space-1));
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--vam-space-2);
  box-sizing: border-box;
  width: var(--vam-filter-width);
  /* Bounded by the canvas as well: the panel opens inside the map and must not
     spill past it, or a scrollbar would appear. */
  max-height: min(var(--vam-filter-height), 80vh);
  padding: var(--vam-space-4);
  overflow: hidden;
  border-radius: var(--vam-radius-md);
  background: var(--vam-surface);
  box-shadow: var(--vam-shadow-lg);
}

.vam-filter__head {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--vam-space-2);
  width: 100%;
}

.vam-filter__head-icon {
  flex-shrink: 0;
  color: var(--vam-fg-muted);
}

.vam-filter__title {
  flex: 1 1 auto;
  margin: 0;
  color: var(--vam-fg-subtle);
  font-size: var(--vam-font-size-lg);
  font-weight: var(--vam-font-weight-bold);
  line-height: var(--vam-line-height-lg);
}

.vam-filter__reset {
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--vam-fg-subtle);
  font-family: var(--vam-font);
  font-size: var(--vam-font-size-sm);
  cursor: pointer;
}

.vam-filter__reset:disabled {
  color: var(--vam-fg-muted);
  cursor: not-allowed;
}

.vam-filter__reset:focus-visible {
  outline: 2px solid var(--vam-focus-ring);
  outline-offset: 1px;
}

.vam-filter__search {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--vam-border);
  border-radius: var(--vam-radius-md);
}

.vam-filter__search-input {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--vam-fg);
  font-family: var(--vam-font);
  font-size: var(--vam-font-size);
}

.vam-filter__search-input::placeholder {
  color: var(--vam-fg-subtle);
}

.vam-filter__search-input:focus {
  outline: none;
}

.vam-filter__groups {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--vam-space-2);
  width: 100%;
  min-height: 0;
  overflow-y: auto;
}

.vam-filter__group {
  display: flex;
  flex-direction: column;
  gap: var(--vam-space-1);
}

.vam-filter__group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--vam-space-2);
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.vam-filter__group-title {
  color: var(--vam-fg-subtle);
  font-family: var(--vam-font);
  font-size: var(--vam-font-size-lg);
  font-weight: var(--vam-font-weight-bold);
  line-height: var(--vam-line-height-lg);
}

.vam-filter__group-head:focus-visible {
  outline: 2px solid var(--vam-focus-ring);
  outline-offset: 2px;
}

.vam-filter__chevron {
  flex-shrink: 0;
  color: var(--vam-fg-subtle);
  transition: transform var(--vam-transition);
}

.vam-filter__chevron--closed {
  transform: rotate(-90deg);
}

.vam-filter__options {
  display: flex;
  flex-direction: column;
  gap: var(--vam-space-1);
}

.vam-filter__option {
  display: flex;
  align-items: center;
  gap: var(--vam-space-2);
  color: var(--vam-fg);
  font-size: var(--vam-font-size-lg);
  line-height: var(--vam-line-height-lg);
  cursor: pointer;
}

/* The real checkbox stays for keyboard and screen readers; the icon is what
   gets drawn. */
.vam-filter__checkbox {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.vam-filter__checkbox-icon {
  flex-shrink: 0;
  color: var(--vam-fg-muted);
}

.vam-filter__checkbox-icon--checked {
  color: var(--vam-accent);
}

.vam-filter__checkbox:focus-visible + .vam-filter__checkbox-icon {
  outline: 2px solid var(--vam-focus-ring);
  outline-offset: 1px;
}

.vam-filter__option-label {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vam-filter__count {
  color: var(--vam-fg-muted);
  font-family: var(--vam-font-mono);
  font-size: var(--vam-font-size-sm);
}

.vam-filter__empty {
  margin: 0;
  color: var(--vam-fg-muted);
  font-size: var(--vam-font-size-sm);
}
</style>
