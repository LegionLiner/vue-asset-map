import { computed, onScopeDispose, ref, type ComputedRef, type Ref } from 'vue'
import type { XY } from '../types/entity'

/** Return value of {@link useDraggableWindow}. */
export interface UseDraggableWindowReturn {
  /** Offset from the window's CSS position, in px. */
  position: Ref<XY>
  dragging: Ref<boolean>
  /** Bind to the window root: a `transform` carrying the current offset. */
  style: ComputedRef<Record<string, string>>
  /** Bind to the title bar. */
  onPointerDown: (event: PointerEvent) => void
  /** Returns the window to the offset it started at. */
  reset: () => void
}

/**
 * Interactive elements that must not start a drag.
 *
 * Without this exception the title-bar buttons stop responding: `preventDefault()`
 * on `pointerdown` stops the browser synthesising a `click`, and
 * `setPointerCapture` redirects the following `pointerup` to the bar itself.
 */
const NON_DRAGGABLE = 'button, a, input, select, textarea, [role="button"]'

/**
 * Drags a floating window by its title bar.
 *
 * Built on Pointer Events rather than mouse/touch: one code path for mouse,
 * touch and stylus, and `setPointerCapture` removes the need to subscribe to
 * `document` — events keep arriving at the element even once the pointer leaves
 * it. That also settles SSR: this module never touches `document`.
 *
 * @param initial - starting offset in px, relative to the window's CSS position.
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
    // Cast: `removeEventListener` is typed over the generic `Event`, and a
    // `PointerEvent` handler cannot be described to it without one.
    target?.removeEventListener('pointermove', onPointerMove as EventListener)
    target?.removeEventListener('pointerup', stop)
    target?.removeEventListener('pointercancel', stop)
    target = undefined
  }

  const onPointerDown = (event: PointerEvent): void => {
    // Primary button only: a right click belongs to the context menu.
    if (event.button !== 0) return

    // Pressing a button in the bar is a button press, not the start of a drag.
    // Without this the close and collapse buttons do not work at all.
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
