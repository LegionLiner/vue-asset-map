<script setup lang="ts">
import { computed } from 'vue'
import { useTranslate } from '../../composables/useTranslate'
import { fieldLabel, fieldToInput, readField } from '../../core/field'
import type { FieldDef } from '../../types/field'

/**
 * The rows of a details window, in whichever of its two states it is in.
 *
 * One component for both because they have to agree: a field the read view
 * shows and the edit view omits is a field someone will try to change and
 * cannot. The schema decides what appears; `editing` decides only how.
 *
 * The two states are laid out differently on purpose. Reading is scanning, so
 * values sit in a second column against their labels. Editing is typing, so the
 * label goes above and the control takes the full width of the window — a text
 * field squeezed into half a panel is the thing that makes a form feel like an
 * afterthought.
 *
 * Values are held by the parent — this writes through `update:values` and keeps
 * nothing of its own, so cancelling an edit is the parent dropping a draft
 * rather than this component being asked to roll anything back.
 */
const props = defineProps<{
  fields: readonly FieldDef[]
  /** The record being shown: an entity or a link. */
  source: object
  editing: boolean
  /** Draft values by field key. Only holds fields that have been touched. */
  values: Readonly<Record<string, unknown>>
}>()

const emit = defineEmits<{
  'update:values': [values: Record<string, unknown>]
}>()

const t = useTranslate()

/** The value to show: the draft if the field was touched, else the record's. */
function currentOf(field: FieldDef): unknown {
  return Object.prototype.hasOwnProperty.call(props.values, field.key)
    ? props.values[field.key]
    : readField(props.source, field.key)
}

function onInput(field: FieldDef, raw: string): void {
  emit('update:values', { ...props.values, [field.key]: raw })
}

const rows = computed(() =>
  props.fields.map((field) => ({
    field,
    label: fieldLabel(field),
    display: fieldToInput(currentOf(field)),
    editable: props.editing && field.readonly !== true,
    kind: field.type ?? 'text',
  })),
)
</script>

<template>
  <div v-if="rows.length === 0" class="vam-fields__empty">{{ t('edit.empty') }}</div>

  <!-- Editing: one field per row, label above, control full width. -->
  <div v-else-if="editing" class="vam-fields vam-fields--editing">
    <div v-for="row in rows" :key="row.field.key" class="vam-fields__field">
      <label class="vam-fields__key" :for="`vam-field-${row.field.key}`">{{ row.label }}</label>

      <select
        v-if="row.editable && row.kind === 'select'"
        :id="`vam-field-${row.field.key}`"
        class="vam-fields__input"
        :value="row.display"
        @change="onInput(row.field, ($event.target as HTMLSelectElement).value)"
      >
        <option value="">—</option>
        <option v-for="option in row.field.options ?? []" :key="option.value" :value="option.value">
          {{ option.label ?? option.value }}
        </option>
      </select>

      <textarea
        v-else-if="row.editable && row.kind === 'textarea'"
        :id="`vam-field-${row.field.key}`"
        class="vam-fields__input"
        rows="3"
        :value="row.display"
        :placeholder="row.field.placeholder"
        @input="onInput(row.field, ($event.target as HTMLTextAreaElement).value)"
      />

      <input
        v-else-if="row.editable"
        :id="`vam-field-${row.field.key}`"
        class="vam-fields__input"
        :type="row.kind === 'number' ? 'number' : 'text'"
        :value="row.display"
        :placeholder="row.field.placeholder"
        @input="onInput(row.field, ($event.target as HTMLInputElement).value)"
      />

      <!-- A readonly field still occupies its row: leaving a gap where a
           control should be reads as something failing to render. -->
      <span v-else class="vam-fields__value">{{ row.display || '—' }}</span>
    </div>
  </div>

  <!-- Reading: label and value side by side, for scanning. -->
  <div v-else class="vam-fields">
    <template v-for="row in rows" :key="row.field.key">
      <span class="vam-fields__key">{{ row.label }}</span>
      <span class="vam-fields__value">{{ row.display || '—' }}</span>
    </template>
  </div>
</template>

<style>
/*
 * `grid-column` because a details section lays its children out in two columns:
 * dropped in as a plain child, the whole form would be squeezed into the label
 * column and every control with it. Spanning is harmless outside a grid, so this
 * also holds when a consumer places the fields in a layout of their own.
 */
.vam-fields,
.vam-fields--editing,
.vam-fields__empty {
  grid-column: 1 / -1;
}

.vam-fields {
  display: grid;
  grid-template-columns: minmax(0, 128px) minmax(0, 1fr);
  gap: var(--vam-space-2) var(--vam-space-3);
  align-items: center;
  font-size: var(--vam-font-size);
}

/* One column, so nothing competes with the control for width. */
.vam-fields--editing {
  display: flex;
  flex-direction: column;
  align-items: baseline;
  gap: var(--vam-space-3);
}

.vam-fields__field {
  display: flex;
  flex-direction: column;
  gap: var(--vam-space-1);
  min-width: 0;
  width: 100%;
}

.vam-fields__key {
  color: var(--vam-fg-muted);
  font-size: var(--vam-font-size-sm);
}

.vam-fields__value {
  overflow-wrap: anywhere;
  color: var(--vam-fg);
}

.vam-fields__input {
  display: block;
  box-sizing: border-box;
  width: 100%;
  padding: var(--vam-space-2);
  border: 1px solid var(--vam-border);
  border-radius: var(--vam-radius-md);
  background: var(--vam-surface);
  color: var(--vam-fg);
  font-family: var(--vam-font);
  font-size: var(--vam-font-size);
  line-height: var(--vam-line-height);
}

.vam-fields__input:hover {
  border-color: var(--vam-border-strong);
}

.vam-fields__input:focus-visible {
  outline: 2px solid var(--vam-focus-ring);
  outline-offset: -1px;
}

textarea.vam-fields__input {
  resize: vertical;
}

.vam-fields__empty {
  color: var(--vam-fg-muted);
  font-size: var(--vam-font-size-sm);
}
</style>
