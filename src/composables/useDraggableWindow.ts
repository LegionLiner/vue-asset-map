import { computed, onScopeDispose, ref, type ComputedRef, type Ref } from 'vue'
import type { XY } from '../types/entity'

export interface UseDraggableWindowReturn {
  position: Ref<XY>
  dragging: Ref<boolean>
  /** Стили для корневого элемента окна. */
  style: ComputedRef<Record<string, string>>
  /** Навешивается на шапку окна. */
  onPointerDown: (event: PointerEvent) => void
  reset: () => void
}

/**
 * Интерактивные элементы, с которых перетаскивание не начинается.
 *
 * Без этого исключения кнопки в шапке перестают нажиматься: `preventDefault()`
 * на `pointerdown` запрещает браузеру синтезировать `click`, а
 * `setPointerCapture` увозит последующий `pointerup` на шапку вместо кнопки.
 */
const NON_DRAGGABLE = 'button, a, input, select, textarea, [role="button"]'

/**
 * Перетаскивание плавающего окна за шапку.
 *
 * На Pointer Events, а не на mouse/touch: один код на мышь, тач и стилус, а
 * `setPointerCapture` избавляет от подписок на `document` — события продолжают
 * приходить в сам элемент, даже если курсор ушёл за его границы. Это заодно
 * решает вопрос с SSR: обращений к `document` здесь нет вообще.
 */
export function useDraggableWindow(initial: XY = { x: 0, y: 0 }): UseDraggableWindowReturn {
  const position = ref<XY>({ ...initial })
  const dragging = ref(false)

  let origin: XY = { x: 0, y: 0 }
  let start: XY = { x: 0, y: 0 }
  let target: Element | undefined

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging.value) return
    position.value = {
      x: start.x + (event.clientX - origin.x),
      y: start.y + (event.clientY - origin.y),
    }
  }

  const stop = (): void => {
    if (!dragging.value) return
    dragging.value = false
    target?.removeEventListener('pointermove', onPointerMove as EventListener)
    target?.removeEventListener('pointerup', stop)
    target?.removeEventListener('pointercancel', stop)
    target = undefined
  }

  const onPointerDown = (event: PointerEvent): void => {
    // Тянуть окно должна только основная кнопка: правый клик — контекстное меню.
    if (event.button !== 0) return

    // Нажатие на кнопку внутри шапки — это нажатие на кнопку, а не начало
    // перетаскивания. Иначе кнопки закрытия и сжатия окна не работают вовсе.
    if (event.target instanceof Element && event.target.closest(NON_DRAGGABLE)) return

    const element = event.currentTarget
    if (!(element instanceof Element)) return

    event.preventDefault()
    dragging.value = true
    origin = { x: event.clientX, y: event.clientY }
    start = { ...position.value }
    target = element

    element.setPointerCapture(event.pointerId)
    element.addEventListener('pointermove', onPointerMove as EventListener)
    element.addEventListener('pointerup', stop)
    element.addEventListener('pointercancel', stop)
  }

  const reset = (): void => {
    position.value = { ...initial }
  }

  const style = computed(() => ({
    transform: `translate(${position.value.x}px, ${position.value.y}px)`,
  }))

  onScopeDispose(stop)

  return { position, dragging, style, onPointerDown, reset }
}
