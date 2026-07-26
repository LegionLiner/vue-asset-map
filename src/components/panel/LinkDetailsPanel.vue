<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DetailsSection from './DetailsSection.vue'
import EditableFields from './EditableFields.vue'
import MapWindow from '../MapWindow.vue'
import { useMapContext } from '../../composables/useMapContext'
import { applyFields, fieldFromInput } from '../../core/field'
import type { AssetLink } from '../../types/link'
import type { FieldDef } from '../../types/field'
import type { XY } from '../../types/entity'

/**
 * Details of one connection, in a floating window.
 *
 * The counterpart of `DetailsPanel` for edges: what the line joins and what it
 * is. Where an entity window leans on the consumer's `#details` slot for
 * anything meaningful, a link has enough of a fixed shape — two ends, a kind, a
 * set of layers — that the package can show it without being told how.
 */
const props = withDefaults(
  defineProps<{
    link: AssetLink<unknown>
    /** Offset in px, so several windows do not stack exactly on one another. */
    offset?: XY
    /** Fields offered when editing. No fields means no edit button. */
    fields?: readonly FieldDef[]
    /** Open straight into edit mode — how a freshly drawn link arrives. */
    startEditing?: boolean
  }>(),
  { startEditing: false },
)

const emit = defineEmits<{
  close: []
  save: [link: AssetLink<unknown>]
}>()

const map = useMapContext()

const editing = ref(props.startEditing)
/** Draft values, by field key. Empty until something is actually typed. */
const draft = ref<Record<string, unknown>>({})

const canEdit = computed(() => (props.fields?.length ?? 0) > 0)

const sourceLabel = computed(() => map.entityById(props.link.source)?.label ?? props.link.source)
const targetLabel = computed(() => map.entityById(props.link.target)?.label ?? props.link.target)

const linkType = computed(() => map.linkTypeOf(props.link.type))
const typeLabel = computed(() => linkType.value?.label ?? props.link.type ?? map.t('link.untyped'))

/**
 * `meta` as flat rows, for the read view.
 *
 * Nothing is filtered out on the grounds of also being editable: the form only
 * exists while editing, so hiding a field here would mean the value is
 * unreadable the rest of the time.
 */
const metaRows = computed(() => {
  const meta = props.link.meta
  if (meta === null || typeof meta !== 'object') return []

  return Object.entries(meta as Record<string, unknown>)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => ({ key, value: Array.isArray(value) ? value.join(', ') : String(value) }))
})

const detailsSlot = computed(() => map.slot('link-details'))
/** `#link-edit` replaces the form with the consumer's own controls. */
const editSlot = computed(() => map.slot('link-edit'))

function startEdit(): void {
  draft.value = {}
  editing.value = true
}

function cancelEdit(): void {
  draft.value = {}
  editing.value = false
}

/** Draft writer handed to `#link-edit`, so a custom form needs no plumbing. */
function setValue(key: string, value: unknown): void {
  draft.value = { ...draft.value, [key]: value }
}

/** Everything `#link-edit` needs to build a form out of its own controls. */
const editSlotProps = computed(() => ({
  value: props.link,
  fields: props.fields ?? [],
  values: draft.value,
  setValue,
  save,
  cancel: cancelEdit,
}))

/**
 * Second press of the same button saves.
 *
 * The draft holds raw input strings; they are converted per field on the way
 * out, so a number field yields a number rather than the text of one.
 */
function save(): void {
  const values: Record<string, unknown> = {}
  for (const field of props.fields ?? []) {
    if (!Object.prototype.hasOwnProperty.call(draft.value, field.key)) continue
    const raw = draft.value[field.key]
    values[field.key] = typeof raw === 'string' ? fieldFromInput(raw, field) : raw
  }

  const next = applyFields(props.link, values)
  editing.value = false
  draft.value = {}

  // Unchanged means unchanged: an application listening for `link-update` should
  // not be handed a write because someone opened the form and closed it again.
  if (next !== props.link) emit('save', next)
}

// A link that changes underneath an open window (renamed, retyped from
// elsewhere) drops any draft: the values on screen would otherwise describe a
// record that no longer exists.
watch(
  () => props.link,
  () => {
    draft.value = {}
  },
)

defineExpose({ editing })
</script>

<template>
  <MapWindow
    class="vam-link-details"
    :offset="offset"
    :title="map.t('link.title')"
    :close-label="map.t('details.close')"
    :collapse-label="map.t('details.collapseWindow')"
    :expand-label="map.t('details.expandWindow')"
    @close="emit('close')"
  >
    <div class="vam-window__heading">
      <span class="vam-window__title vam-link-details__route">
        <span class="vam-link-details__end">{{ sourceLabel }}</span>
        <span class="vam-link-details__arrow" aria-hidden="true">{{ link.directed ? '→' : '↔' }}</span>
        <span class="vam-link-details__end">{{ targetLabel }}</span>
      </span>
      <span class="vam-window__subtitle">
        <span
          class="vam-link-details__swatch"
          :style="{ background: linkType?.color ?? 'var(--vam-edge)' }"
          aria-hidden="true"
        />
        <span class="vam-window__kind">{{ typeLabel }}</span>
      </span>
    </div>

    <div class="vam-window__content">
      <!-- Editing takes the body over entirely; see `DetailsPanel` for why. -->
      <!-- `v-bind` of an object; see `DetailsPanel` for why not attribute by
           attribute. -->
      <component :is="editSlot" v-if="editing && editSlot" v-bind="editSlotProps" />

      <DetailsSection v-else-if="editing" :title="map.t('edit.fields')">
        <EditableFields
          :fields="fields ?? []"
          :source="link"
          :editing="true"
          :values="draft"
          @update:values="draft = $event"
        />
      </DetailsSection>

      <component
        :is="detailsSlot"
        v-else-if="detailsSlot"
        :link="link"
        :editing="editing"
        :close="() => emit('close')"
      />

      <template v-else>
        <DetailsSection :title="map.t('link.title')">
          <span class="vam-field__key">{{ map.t('link.from') }}</span>
          <span class="vam-field__value">{{ sourceLabel }}</span>
          <span class="vam-field__key">{{ map.t('link.to') }}</span>
          <span class="vam-field__value">{{ targetLabel }}</span>
          <span class="vam-field__key">{{ map.t('link.type') }}</span>
          <span class="vam-field__value">{{ typeLabel }}</span>
          <span class="vam-field__key">{{ map.t('link.layers') }}</span>
          <span class="vam-field__value">{{ link.layers.join(', ') || '—' }}</span>
        </DetailsSection>

        <DetailsSection v-if="metaRows.length > 0" :title="map.t('link.meta')">
          <template v-for="row in metaRows" :key="row.key">
            <span class="vam-field__key">{{ row.key }}</span>
            <span class="vam-field__value">{{ row.value }}</span>
          </template>
        </DetailsSection>
      </template>
    </div>

    <div v-if="canEdit" class="vam-window__actions">
      <button v-if="editing" type="button" class="vam-window__action" @click="cancelEdit">
        {{ map.t('confirm.cancel') }}
      </button>
      <button
        type="button"
        class="vam-window__action vam-window__action--primary"
        @click="editing ? save() : startEdit()"
      >
        {{ editing ? map.t('edit.save') : map.t('edit.start') }}
      </button>
    </div>
  </MapWindow>
</template>

<style>
.vam-link-details {
  top: var(--vam-details-top);
  right: var(--vam-space-3);
}

.vam-link-details__route {
  display: flex;
  align-items: center;
  gap: var(--vam-space-2);
  min-width: 0;
}

.vam-link-details__end {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vam-link-details__arrow {
  flex: 0 0 auto;
  color: var(--vam-fg-muted);
}

.vam-link-details__swatch {
  width: var(--vam-legend-swatch-size);
  height: 3px;
  border-radius: 2px;
}

/* Shared with the entity window: the row of buttons pinned under the body. */
.vam-window__actions {
  display: flex;
  flex: 0 0 auto;
  justify-content: flex-end;
  gap: var(--vam-space-2);
  padding-top: var(--vam-space-2);
  border-top: 1px solid var(--vam-border);
}

.vam-window__action {
  padding: var(--vam-space-1) var(--vam-space-3);
  border: 1px solid var(--vam-border);
  border-radius: var(--vam-radius-md);
  background: var(--vam-surface);
  color: var(--vam-fg);
  font-family: var(--vam-font);
  font-size: var(--vam-font-size);
  cursor: pointer;
  transition:
    background var(--vam-transition),
    border-color var(--vam-transition);
}

.vam-window__action:hover {
  border-color: var(--vam-border-strong);
  background: var(--vam-surface-sunken);
}

.vam-window__action:focus-visible {
  outline: 2px solid var(--vam-focus-ring);
  outline-offset: 1px;
}

.vam-window__action--primary {
  border-color: var(--vam-accent);
  background: var(--vam-accent);
  color: var(--vam-accent-fg);
  font-weight: var(--vam-font-weight-medium);
}

.vam-window__action--primary:hover {
  border-color: var(--vam-accent);
  background: var(--vam-accent);
}
</style>
