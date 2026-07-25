<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTranslate } from '../../composables/useTranslate'
import { groupValuesOf, selectedGroupCount } from '../../core/filter'
import { IconCheckbox, IconCheckboxChecked, IconChevron, IconFilter } from '../icons/index'
import type { FacetCounts, FilterGroupDef, FilterState } from '../../types/filter'

/**
 * Фильтры: кнопка на полотне и раскрывающаяся панель со списками значений.
 *
 * Списки — данные, а не код. «Подсеть», «Тип актива», «Критичность» задаёт
 * потребитель через `groups`; без них панель показывает встроенные фасеты по
 * типу и состоянию, собранные из самих сущностей.
 *
 * Состояние состояния фильтра всегда заменяется новым объектом, а не правится на
 * месте: снаружи оно может быть контролируемым через `v-model:filters`, и мутация
 * не породила бы события обновления.
 */
const model = defineModel<FilterState>({
  default: (): FilterState => ({ query: '', kinds: [], statuses: [] }),
})

/**
 * Какие списки раскрыты.
 *
 * Наружу через `v-model:openGroups`, а не в `localStorage`: пакет не пишет в
 * хранилище браузера — сохранять состояние между сессиями решает приложение.
 */
const openGroups = defineModel<string[] | undefined>('openGroups', { default: undefined })

const props = defineProps<{
  facets: FacetCounts
  /** Описания списков. Без них показываются фасеты по kind и status. */
  groups?: readonly FilterGroupDef[]
}>()

const t = useTranslate()

const open = ref(false)
const query = ref('')

/** Встроенные списки, когда потребитель своих не задал. */
const fallbackGroups = computed<FilterGroupDef[]>(() => [
  { id: 'kinds', label: t.value('filter.kinds') },
  { id: 'statuses', label: t.value('filter.statuses'), valuesOf: (entity) => [entity.status ?? ''] },
])

const groups = computed(() => props.groups ?? fallbackGroups.value)

/**
 * Значения списка: объявленные потребителем или собранные из данных.
 *
 * Счётчики приходят из фасетов по проекции вида, поэтому не обнуляются при
 * выборе значения — иначе снять фильтр было бы некуда.
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

/** Встроенные списки берут счётчики из готовых фасетов по kind и status. */
function fallbackCounts(groupId: string): ReadonlyMap<string, number> {
  if (groupId === 'kinds') return props.facets.kinds
  if (groupId === 'statuses') return props.facets.statuses
  return new Map()
}

function byLabel(a: { label: string }, b: { label: string }): number {
  return a.label.localeCompare(b.label)
}

const activeCount = computed(
  () => model.value.kinds.length + model.value.statuses.length + selectedGroupCount(model.value),
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

/** Выбранные значения списка. Встроенные списки живут в своих полях состояния. */
function selectedOf(groupId: string): readonly string[] {
  if (groupId === 'kinds' && !props.groups) return model.value.kinds
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

  if (groupId === 'kinds' && !props.groups) {
    model.value = { ...model.value, kinds: next }
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
  // Запрос не трогаем: сброс фасетов и сброс поиска — разные действия.
  model.value = { ...model.value, kinds: [], statuses: [], groups: {} }
}

/** Значения группы у сущности — реэкспорт для потребителя, строящего свои списки. */
defineExpose({ groupValuesOf })
</script>

<template>
  <div class="vnm-filter">
    <button
      type="button"
      class="vnm-filter__button"
      :class="{ 'vnm-filter__button--active': open }"
      :aria-label="t('filter.label')"
      :aria-expanded="open"
      @click="open = !open"
    >
      <IconFilter />
      <span v-if="activeCount > 0" class="vnm-filter__badge">{{ activeCount }}</span>
    </button>

    <section v-if="open" class="vnm-filter__panel" :aria-label="t('filter.label')">
      <header class="vnm-filter__head">
        <IconFilter class="vnm-filter__head-icon" />
        <h3 class="vnm-filter__title">{{ t('filter.label') }}</h3>
        <button type="button" class="vnm-filter__reset" :disabled="activeCount === 0" @click="reset">
          {{ t('filter.reset') }}
        </button>
      </header>

      <div class="vnm-filter__search">
        <input
          v-model="query"
          type="search"
          class="vnm-filter__search-input"
          :aria-label="t('filter.search')"
          :placeholder="t('filter.search')"
        />
      </div>

      <div class="vnm-filter__groups">
        <section v-for="group in groups" :key="group.id" class="vnm-filter__group">
          <button
            type="button"
            class="vnm-filter__group-head"
            :aria-expanded="isOpen(group)"
            @click="toggleGroup(group)"
          >
            <span class="vnm-filter__group-title">{{ group.label }}</span>
            <IconChevron
              class="vnm-filter__chevron"
              :class="{ 'vnm-filter__chevron--closed': !isOpen(group) }"
            />
          </button>

          <div v-if="isOpen(group)" class="vnm-filter__options">
            <p v-if="optionsOf(group).length === 0" class="vnm-filter__empty">
              {{ t('filter.empty') }}
            </p>

            <label v-for="option in optionsOf(group)" :key="option.value" class="vnm-filter__option">
              <input
                type="checkbox"
                class="vnm-filter__checkbox"
                :checked="isChecked(group.id, option.value)"
                @change="toggleValue(group.id, option.value)"
              />
              <IconCheckboxChecked
                v-if="isChecked(group.id, option.value)"
                class="vnm-filter__checkbox-icon vnm-filter__checkbox-icon--checked"
              />
              <IconCheckbox v-else class="vnm-filter__checkbox-icon" />

              <span class="vnm-filter__option-label">{{ option.label }}</span>
              <span class="vnm-filter__count">{{ option.count }}</span>
            </label>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

<style>
.vnm-filter {
  position: relative;
  flex: 0 0 auto;
}

.vnm-filter__button {
  display: flex;
  position: relative;
  align-items: center;
  justify-content: center;
  gap: var(--vnm-space-2);
  padding: var(--vnm-space-2);
  border: 0;
  border-radius: var(--vnm-radius-md);
  background: var(--vnm-surface);
  color: var(--vnm-fg-muted);
  cursor: pointer;
}

.vnm-filter__button:hover,
.vnm-filter__button--active {
  color: var(--vnm-fg-subtle);
}

.vnm-filter__button:focus-visible {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: 1px;
}

.vnm-filter__badge {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 14px;
  border-radius: var(--vnm-radius-sm);
  background: var(--vnm-accent);
  color: var(--vnm-accent-fg);
  font-size: var(--vnm-font-size-sm);
  font-weight: var(--vnm-font-weight-bold);
  line-height: 14px;
  text-align: center;
}

.vnm-filter__panel {
  position: absolute;
  z-index: 30;
  top: calc(100% + var(--vnm-space-1));
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--vnm-space-2);
  box-sizing: border-box;
  width: var(--vnm-filter-width);
  /* Высота ограничена и полотном: панель раскрывается внутри карты, и вылезать
     за её пределы ей нельзя — иначе появлялся бы скролл. */
  max-height: min(var(--vnm-filter-height), 80vh);
  padding: var(--vnm-space-4);
  overflow: hidden;
  border-radius: var(--vnm-radius-md);
  background: var(--vnm-surface);
  box-shadow: var(--vnm-shadow-lg);
}

.vnm-filter__head {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--vnm-space-2);
  width: 100%;
}

.vnm-filter__head-icon {
  flex-shrink: 0;
  color: var(--vnm-fg-muted);
}

.vnm-filter__title {
  flex: 1 1 auto;
  margin: 0;
  color: var(--vnm-fg-subtle);
  font-size: var(--vnm-font-size-lg);
  font-weight: var(--vnm-font-weight-bold);
  line-height: var(--vnm-line-height-lg);
}

.vnm-filter__reset {
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--vnm-fg-subtle);
  font-family: var(--vnm-font);
  font-size: var(--vnm-font-size-sm);
  cursor: pointer;
}

.vnm-filter__reset:disabled {
  color: var(--vnm-fg-muted);
  cursor: not-allowed;
}

.vnm-filter__reset:focus-visible {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: 1px;
}

.vnm-filter__search {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--vnm-border);
  border-radius: var(--vnm-radius-md);
}

.vnm-filter__search-input {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--vnm-fg);
  font-family: var(--vnm-font);
  font-size: var(--vnm-font-size);
}

.vnm-filter__search-input::placeholder {
  color: var(--vnm-fg-subtle);
}

.vnm-filter__search-input:focus {
  outline: none;
}

.vnm-filter__groups {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--vnm-space-2);
  width: 100%;
  min-height: 0;
  overflow-y: auto;
}

.vnm-filter__group {
  display: flex;
  flex-direction: column;
  gap: var(--vnm-space-1);
}

.vnm-filter__group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--vnm-space-2);
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.vnm-filter__group-title {
  color: var(--vnm-fg-subtle);
  font-family: var(--vnm-font);
  font-size: var(--vnm-font-size-lg);
  font-weight: var(--vnm-font-weight-bold);
  line-height: var(--vnm-line-height-lg);
}

.vnm-filter__group-head:focus-visible {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: 2px;
}

.vnm-filter__chevron {
  flex-shrink: 0;
  color: var(--vnm-fg-subtle);
  transition: transform var(--vnm-transition);
}

.vnm-filter__chevron--closed {
  transform: rotate(-90deg);
}

.vnm-filter__options {
  display: flex;
  flex-direction: column;
  gap: var(--vnm-space-1);
}

.vnm-filter__option {
  display: flex;
  align-items: center;
  gap: var(--vnm-space-2);
  color: var(--vnm-fg);
  font-size: var(--vnm-font-size-lg);
  line-height: var(--vnm-line-height-lg);
  cursor: pointer;
}

/* Настоящий чекбокс остаётся для клавиатуры и скринридеров, а рисуется иконка. */
.vnm-filter__checkbox {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.vnm-filter__checkbox-icon {
  flex-shrink: 0;
  color: var(--vnm-fg-muted);
}

.vnm-filter__checkbox-icon--checked {
  color: var(--vnm-accent);
}

.vnm-filter__checkbox:focus-visible + .vnm-filter__checkbox-icon {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: 1px;
}

.vnm-filter__option-label {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vnm-filter__count {
  color: var(--vnm-fg-muted);
  font-family: var(--vnm-font-mono);
  font-size: var(--vnm-font-size-sm);
}

.vnm-filter__empty {
  margin: 0;
  color: var(--vnm-fg-muted);
  font-size: var(--vnm-font-size-sm);
}
</style>
