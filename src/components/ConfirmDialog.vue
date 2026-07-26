<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useTranslate } from '../composables/useTranslate'

/**
 * Confirmation before something irreversible.
 *
 * The package's own, not the browser's and not a dependency's: `confirm()` is
 * unstyleable, blocks the main thread and looks like a phishing prompt, and a
 * dialog library would be a runtime dependency for one box. It is built out of
 * the same tokens as the rest of the map, so it follows the theme.
 *
 * Focus moves to the cancel button on open and is trapped between the two
 * actions: the destructive one must never be what a stray Enter lands on.
 */
withDefaults(
  defineProps<{
    title: string
    /** Body text. Already interpolated by the caller. */
    body?: string
    confirmLabel?: string
    cancelLabel?: string
    /** Draws the confirm button as destructive. */
    danger?: boolean
  }>(),
  { danger: true },
)

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const t = useTranslate()
const cancelButton = ref<HTMLButtonElement>()

onMounted(() => {
  cancelButton.value?.focus()
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  // Stopped here: the map closes its topmost window on Escape, and dismissing a
  // dialog must not also dismiss whatever it was opened over.
  event.stopPropagation()
  emit('cancel')
}
</script>

<template>
  <div class="vam-confirm" @pointerdown.self="emit('cancel')">
    <div class="vam-confirm__box" role="alertdialog" aria-modal="true" :aria-label="title">
      <strong class="vam-confirm__title">{{ title }}</strong>
      <p v-if="body" class="vam-confirm__body">{{ body }}</p>

      <div class="vam-confirm__actions">
        <button ref="cancelButton" type="button" class="vam-confirm__button" @click="emit('cancel')">
          {{ cancelLabel ?? t('confirm.cancel') }}
        </button>
        <button
          type="button"
          class="vam-confirm__button vam-confirm__button--primary"
          :class="{ 'vam-confirm__button--danger': danger }"
          @click="emit('confirm')"
        >
          {{ confirmLabel ?? t('confirm.confirm') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style>
.vam-confirm {
  position: absolute;
  /* Above the menus, which are above the windows: this is the last word. */
  z-index: 80;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--vam-space-4);
  background: var(--vam-confirm-scrim);
  font-family: var(--vam-font);
}

.vam-confirm__box {
  display: flex;
  flex-direction: column;
  gap: var(--vam-space-3);
  width: 360px;
  max-width: 100%;
  padding: var(--vam-space-4);
  border: 1px solid var(--vam-window-border);
  border-radius: var(--vam-window-radius);
  background: var(--vam-surface);
  box-shadow: var(--vam-shadow-lg);
  color: var(--vam-fg);
}

.vam-confirm__title {
  font-size: var(--vam-font-size-lg);
  line-height: var(--vam-line-height-lg);
}

.vam-confirm__body {
  margin: 0;
  color: var(--vam-fg-subtle);
  font-size: var(--vam-font-size);
  line-height: var(--vam-line-height);
}

.vam-confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--vam-space-2);
}

.vam-confirm__button {
  padding: var(--vam-space-2) var(--vam-space-4);
  border: 1px solid var(--vam-border);
  border-radius: var(--vam-radius-md);
  background: var(--vam-surface);
  color: var(--vam-fg);
  font: inherit;
  cursor: pointer;
  transition:
    background var(--vam-transition),
    border-color var(--vam-transition);
}

.vam-confirm__button:hover {
  border-color: var(--vam-border-strong);
  background: var(--vam-surface-sunken);
}

.vam-confirm__button:focus-visible {
  outline: 2px solid var(--vam-focus-ring);
  outline-offset: 1px;
}

.vam-confirm__button--primary {
  border-color: var(--vam-accent);
  background: var(--vam-accent);
  color: var(--vam-accent-fg);
  font-weight: var(--vam-font-weight-medium);
}

.vam-confirm__button--primary:hover {
  border-color: var(--vam-accent);
  background: var(--vam-accent);
}

.vam-confirm__button--danger,
.vam-confirm__button--danger:hover {
  border-color: var(--vam-menu-danger);
  background: var(--vam-menu-danger);
  color: var(--vam-fg-inverted);
}
</style>
