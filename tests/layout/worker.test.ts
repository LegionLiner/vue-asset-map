import { describe, expect, it, vi } from 'vitest'
import {
  createWorkerLayout,
  exposeLayoutEngine,
  isLayoutAborted,
  isLayoutLimit,
  manualLayout,
  type LayoutEngine,
  type LayoutGraph,
  type LayoutWorker,
  type LayoutWorkerScope,
} from '../../src/layout/index'
import { dagreLayout } from '../../src/layout/dagre'

/**
 * Настоящего воркера в тестах нет, поэтому обе стороны соединяются вручную:
 * сообщения ходят через `queueMicrotask`, как через границу потока, и
 * структурно копируются — функции и прокси через неё не проходят.
 */
function connect(engines: LayoutEngine | LayoutEngine[]) {
  const toWorker: ((event: { data: unknown }) => void)[] = []
  const toMain = new Set<(event: MessageEvent) => void>()
  const errors = new Set<(event: ErrorEvent) => void>()
  let terminated = 0

  const scope: LayoutWorkerScope = {
    addEventListener: (_type, listener) => toWorker.push(listener),
    postMessage: (message) => {
      const data = structuredClone(message)
      queueMicrotask(() => {
        for (const listener of toMain) listener({ data } as MessageEvent)
      })
    },
  }
  exposeLayoutEngine(engines, scope)

  const worker: LayoutWorker = {
    postMessage: (message) => {
      const data = structuredClone(message)
      queueMicrotask(() => {
        for (const listener of toWorker) listener({ data })
      })
    },
    terminate: () => {
      terminated += 1
    },
    addEventListener: ((type: string, listener: never) => {
      if (type === 'message') toMain.add(listener)
      else errors.add(listener)
    }) as LayoutWorker['addEventListener'],
    removeEventListener: ((type: string, listener: never) => {
      if (type === 'message') toMain.delete(listener)
      else errors.delete(listener)
    }) as LayoutWorker['removeEventListener'],
  }

  return {
    worker,
    terminated: () => terminated,
    crash: (message: string) => {
      for (const listener of errors) listener({ message } as ErrorEvent)
    },
  }
}

const graph: LayoutGraph = {
  nodes: [
    { id: 'a', width: 100, height: 50 },
    { id: 'b', width: 100, height: 50, pinned: { x: 7, y: 9 } },
  ],
  edges: [{ id: 'e', source: 'a', target: 'b' }],
}

describe('createWorkerLayout + exposeLayoutEngine', () => {
  it('раскладка из воркера совпадает с той же раскладкой на месте', async () => {
    const { worker } = connect(manualLayout)
    const engine = createWorkerLayout('manual', () => worker)

    const remote = await engine.run(graph, { columns: 3 })
    const local = await manualLayout.run(graph, { columns: 3 })

    expect(engine.name).toBe('manual')
    expect([...remote]).toEqual([...local])
  })

  it('воркер создаётся один раз и переиспользуется', async () => {
    const { worker } = connect(manualLayout)
    const create = vi.fn(() => worker)
    const engine = createWorkerLayout('manual', create)

    await engine.run(graph)
    await engine.run(graph)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('воркер с несколькими движками отвечает тем, который просили', async () => {
    const { worker } = connect([manualLayout, dagreLayout])
    const engine = createWorkerLayout('dagre', () => worker)

    const positions = await engine.run(graph, { rankdir: 'LR' })
    expect(positions.size).toBe(2)
  })

  it('неизвестный движок — понятная ошибка', async () => {
    const { worker } = connect([manualLayout, dagreLayout])
    const engine = createWorkerLayout('radial', () => worker)

    await expect(engine.run(graph)).rejects.toThrow(/No layout engine "radial"/)
  })

  it('отмена прерывает воркер: синхронный движок иначе не остановить', async () => {
    const { worker, terminated } = connect(manualLayout)
    const create = vi.fn(() => worker)
    const engine = createWorkerLayout('manual', create)
    const controller = new AbortController()

    const pending = engine.run(graph, undefined, controller.signal)
    controller.abort()

    const error = await pending.catch((caught: unknown) => caught)
    expect(isLayoutAborted(error)).toBe(true)
    expect(terminated()).toBe(1)

    // Следующий запуск получает новый воркер.
    await engine.run(graph)
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('уже отменённый запуск не трогает воркер вовсе', async () => {
    const create = vi.fn(() => connect(manualLayout).worker)
    const engine = createWorkerLayout('manual', create)
    const controller = new AbortController()
    controller.abort()

    await expect(engine.run(graph, undefined, controller.signal)).rejects.toSatisfy(isLayoutAborted)
    expect(create).not.toHaveBeenCalled()
  })

  it('отказ по размеру возвращается как LayoutLimitError', async () => {
    const { worker } = connect(dagreLayout)
    const engine = createWorkerLayout('dagre', () => worker)

    const error = await engine.run(graph, { maxNodes: 1 }).catch((caught: unknown) => caught)
    expect(isLayoutLimit(error)).toBe(true)
  })

  it('упавший воркер отклоняет запуск и заменяется новым', async () => {
    const silent: LayoutEngine = { name: 'silent', run: () => new Promise(() => {}) }
    const first = connect(silent)
    const second = connect(manualLayout)
    const create = vi.fn().mockReturnValueOnce(first.worker).mockReturnValueOnce(second.worker)
    const engine = createWorkerLayout('silent', create)

    const pending = engine.run(graph)
    first.crash('boom')
    await expect(pending).rejects.toThrow('boom')
    expect(first.terminated()).toBe(1)

    await engine.run(graph)
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('опции, которые нельзя передать в воркер, отклоняют запуск, а не роняют карту', async () => {
    const { worker } = connect(manualLayout)
    const engine = createWorkerLayout('manual', () => worker)

    await expect(engine.run(graph, { origin: () => 0 })).rejects.toBeDefined()
  })

  it('вне воркера exposeLayoutEngine без scope отказывается внятно', () => {
    expect(() => exposeLayoutEngine(manualLayout)).toThrow(/inside a worker/)
  })
})
