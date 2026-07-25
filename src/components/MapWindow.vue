<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDraggableWindow } from '../composables/useDraggableWindow'
import { useTranslate } from '../composables/useTranslate'
import { IconClose, IconCollapseWindow, IconDragHandle } from './icons/index'
import type { XY } from '../types/entity'

/**
 * Плавающее окно поверх полотна: шапка, перетаскивание, сжатие, закрытие.
 *
 * Отдельный компонент, а не часть панели подробностей, потому что окна нужны не
 * только ей: потребитель собирает из него свои — историю, легенду, журнал
 * событий — и получает ту же шапку, то же перетаскивание и те же токены темы,
 * не переписывая логику указателя заново.
 *
 * Позиционирование задаёт вызывающая сторона обычным `style`: атрибуты падают на
 * корень, а `transform` от перетаскивания с ними складывается.
 */
const props = withDefaults(
  defineProps<{
    /** Подпись в центре шапки. */
    title?: string
    /** Кнопка закрытия. Окна вроде истории закрывать нельзя — передайте `false`. */
    closable?: boolean
    /** Кнопка сжатия до высоты шапки. */
    collapsible?: boolean
    /** Окно без тела: только шапка со своим содержимым. */
    headerOnly?: boolean
    /** Ручка перетаскивания слева. Нужна окнам без заголовка. */
    dragHandle?: boolean
    /** Начальный сдвиг. Полезен, чтобы окна не ложились ровно друг на друга. */
    offset?: XY
    /** Подписи кнопок. Без них берутся из локали. */
    closeLabel?: string
    collapseLabel?: string
    expandLabel?: string
  }>(),
  {
    closable: true,
    collapsible: true,
    headerOnly: false,
    dragHandle: false,
  },
)

const emit = defineEmits<{
  close: []
  'collapse-change': [collapsed: boolean]
}>()

defineSlots<{
  /** Содержимое шапки между кнопками. Без него показывается `title`. */
  header?(props: { collapsed: boolean }): unknown
  /** Тело окна. Не рендерится при `headerOnly` и в сжатом состоянии. */
  default?(props: { collapsed: boolean }): unknown
}>()

const t = useTranslate()
const { style, dragging, onPointerDown, reset } = useDraggableWindow(props.offset)

const collapsed = ref(false)

const hasBody = computed(() => !props.headerOnly && !collapsed.value)

const collapseLabel = computed(() => {
  if (collapsed.value) return props.expandLabel ?? t.value('window.expand')
  return props.collapseLabel ?? t.value('window.collapse')
})

function toggleCollapsed(): void {
  collapsed.value = !collapsed.value
  emit('collapse-change', collapsed.value)
}

defineExpose({
  /** Сжато ли окно — снаружи это иногда нужно знать. */
  collapsed,
  /** Вернуть окно в исходное положение. */
  resetPosition: reset,
})
</script>

<template>
  <aside
    class="vnm-window"
    :class="{
      'vnm-window--collapsed': collapsed,
      'vnm-window--dragging': dragging,
      'vnm-window--header-only': headerOnly,
    }"
    :style="style"
  >
    <header class="vnm-window__header" @pointerdown="onPointerDown">
      <span v-if="dragHandle" class="vnm-window__grip" :aria-label="t('window.drag')" role="img">
        <IconDragHandle />
      </span>

      <button
        v-if="closable"
        type="button"
        class="vnm-window__button"
        :aria-label="closeLabel ?? t('window.close')"
        @click="emit('close')"
      >
        <IconClose />
      </button>

      <div class="vnm-window__caption">
        <slot name="header" :collapsed="collapsed">{{ title }}</slot>
      </div>

      <button
        v-if="collapsible"
        type="button"
        class="vnm-window__button"
        :aria-label="collapseLabel"
        :aria-expanded="!collapsed"
        @click="toggleCollapsed"
      >
        <IconCollapseWindow :class="{ 'vnm-window__icon--flipped': collapsed }" />
      </button>
    </header>

    <div v-if="hasBody" class="vnm-window__body">
      <slot :collapsed="collapsed" />
    </div>
  </aside>
</template>

<style>
.vnm-window {
  position: absolute;
  z-index: 20;
  display: flex;
  flex-direction: column;
  width: var(--vnm-window-width);
  max-width: calc(100% - var(--vnm-space-5));
  max-height: calc(100% - var(--vnm-space-5));
  border-radius: var(--vnm-window-radius);
  background: var(--vnm-surface);
  box-shadow: var(--vnm-shadow-lg);
  color: var(--vnm-fg);
  font-family: var(--vnm-font);
  font-size: var(--vnm-font-size);
  line-height: var(--vnm-line-height);
}

/* Окно из одной шапки: ширину задаёт содержимое, а не общий токен. */
.vnm-window--header-only {
  width: auto;
}

.vnm-window__header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--vnm-space-2);
  min-height: var(--vnm-window-header-height);
  padding: var(--vnm-space-1);
  border-radius: var(--vnm-window-radius) var(--vnm-window-radius) 0 0;
  background: var(--vnm-surface-sunken);
  cursor: grab;
  /* Иначе браузер начнёт своё «перетаскивание» и выделение текста в шапке. */
  touch-action: none;
  user-select: none;
}

.vnm-window--dragging .vnm-window__header {
  cursor: grabbing;
}

/* Сжатое окно и окно без тела — только шапка: скругление возвращается снизу. */
.vnm-window--collapsed .vnm-window__header,
.vnm-window--header-only .vnm-window__header {
  border-radius: var(--vnm-window-radius);
}

.vnm-window__grip {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  padding: 0 2px;
  color: var(--vnm-fg-muted);
}

.vnm-window__caption {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  gap: var(--vnm-space-2);
  min-width: 0;
  overflow: hidden;
  color: var(--vnm-fg-subtle);
  font-size: var(--vnm-font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vnm-window__button {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: var(--vnm-radius-sm);
  background: transparent;
  color: var(--vnm-fg-muted);
  cursor: pointer;
}

.vnm-window__button:hover {
  color: var(--vnm-fg-subtle);
}

.vnm-window__button:focus-visible {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: 1px;
}

.vnm-window__icon--flipped {
  transform: rotate(180deg);
}

.vnm-window__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--vnm-space-4);
  min-height: 0;
  padding: var(--vnm-space-4);
}
</style>
