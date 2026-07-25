/**
 * Заглушки браузерных API, которых нет в jsdom.
 *
 * VueFlow измеряет полотно через ResizeObserver и читает размеры узлов. В jsdom
 * первого не существует, а второе всегда ноль — без заглушек компонент падает
 * ещё до того, как дойдёт до проверяемого поведения.
 *
 * Файл подключается как `setupFiles` для всех тестов; в node-окружении
 * присваивания просто не срабатывают, потому что `globalThis.window` там нет.
 */

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}

if (typeof globalThis.window !== 'undefined') {
  // Полотну нужен непустой размер: иначе VueFlow считает, что показывать негде.
  Object.defineProperty(globalThis.HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => 1200,
  })
  Object.defineProperty(globalThis.HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => 800,
  })

  if (typeof globalThis.window.matchMedia !== 'function') {
    globalThis.window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof globalThis.window.matchMedia
  }
}
