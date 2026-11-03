import type { EntityId, XY } from '../types/entity'
import { LayoutAbortedError, LayoutLimitError, type LayoutEngine, type LayoutGraph } from './types'

/**
 * Running a layout engine off the main thread.
 *
 * Two halves on one subpath, `vue-asset-map/layout-worker`, free of Vue so the
 * worker can import it: {@link exposeLayoutEngine} goes in the application's
 * own worker file, {@link createWorkerLayout} turns that worker back into an
 * ordinary engine for `:layout`.
 *
 * The worker file belongs to the application rather than the package on
 * purpose: only the application's bundler knows how to emit a worker chunk, and
 * a worker bundled inside a library breaks under half of them.
 *
 * ```ts
 * // layout.worker.ts
 * import { exposeLayoutEngine } from 'vue-asset-map/layout-worker'
 * import { dagreLayout } from 'vue-asset-map/layout-dagre'
 * exposeLayoutEngine(dagreLayout)
 *
 * // the map
 * const dagreOffThread = createWorkerLayout(
 *   'dagre',
 *   () => new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' }),
 * )
 * ```
 */

interface RunRequest {
  type: 'vam-layout-run'
  id: number
  engine: string
  graph: LayoutGraph
  options?: unknown
}

interface SerializedError {
  name: string
  message: string
  engineName?: string
  nodeCount?: number
  limit?: number
}

type RunResponse =
  | { type: 'vam-layout-result'; id: number; positions: [EntityId, XY][] }
  | { type: 'vam-layout-error'; id: number; error: SerializedError }

/** The part of a worker's global scope the engine side needs. */
export interface LayoutWorkerScope {
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void
  postMessage(message: unknown): void
}

/** The part of a `Worker` the map side needs; a real `Worker` satisfies it. */
export interface LayoutWorker {
  postMessage(message: unknown): void
  terminate(): void
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  removeEventListener(type: 'error', listener: (event: ErrorEvent) => void): void
}

function isWorkerScope(value: unknown): value is LayoutWorkerScope {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { addEventListener?: unknown; postMessage?: unknown }
  return typeof candidate.addEventListener === 'function' && typeof candidate.postMessage === 'function'
}

/** The worker's own global scope; outside a worker there is nothing to serve from. */
function currentScope(): LayoutWorkerScope {
  const scope: unknown = globalThis
  if (!isWorkerScope(scope)) throw new Error('exposeLayoutEngine must run inside a worker')
  return scope
}

function isRunRequest(data: unknown): data is RunRequest {
  return typeof data === 'object' && data !== null && (data as { type?: unknown }).type === 'vam-layout-run'
}

function isRunResponse(data: unknown): data is RunResponse {
  const type = typeof data === 'object' && data !== null ? (data as { type?: unknown }).type : undefined
  return type === 'vam-layout-result' || type === 'vam-layout-error'
}

function serializeError(error: unknown): SerializedError {
  if (error instanceof LayoutLimitError) {
    return {
      name: error.name,
      message: error.message,
      engineName: error.engineName,
      nodeCount: error.nodeCount,
      limit: error.limit,
    }
  }
  if (error instanceof Error) return { name: error.name, message: error.message }
  return { name: 'Error', message: String(error) }
}

/**
 * Errors are rebuilt as the classes the map checks for: a refused graph has to
 * read as a `LayoutLimitError` on this side too, or the map would report a
 * failure where it should quietly fall back to the grid.
 */
function rebuildError(error: SerializedError): Error {
  if (error.name === 'LayoutLimitError') {
    return new LayoutLimitError(error.engineName ?? 'unknown', error.nodeCount ?? 0, error.limit ?? 0)
  }
  const rebuilt = new Error(error.message)
  rebuilt.name = error.name
  return rebuilt
}

/**
 * Serves layout engines from inside a worker.
 *
 * Call once at the top of the worker file. Several engines may be exposed
 * together; a request names the one it wants, and a single engine also answers
 * requests for any name.
 */
export function exposeLayoutEngine(
  engines: LayoutEngine | readonly LayoutEngine[],
  scope: LayoutWorkerScope = currentScope(),
): void {
  // Annotated: `Array.isArray` does not narrow a readonly array, and the union
  // would otherwise widen to `any`.
  const list: readonly LayoutEngine[] = Array.isArray(engines) ? engines : [engines as LayoutEngine]
  const byName = new Map<string, LayoutEngine>(list.map((engine) => [engine.name, engine]))

  scope.addEventListener('message', (event) => {
    const request = event.data
    if (!isRunRequest(request)) return

    const engine = byName.get(request.engine) ?? (list.length === 1 ? list[0] : undefined)
    const reply = (response: RunResponse): void => scope.postMessage(response)

    if (!engine) {
      reply({
        type: 'vam-layout-error',
        id: request.id,
        error: { name: 'Error', message: `No layout engine "${request.engine}" in this worker` },
      })
      return
    }

    engine
      .run(request.graph, request.options)
      .then((positions) => reply({ type: 'vam-layout-result', id: request.id, positions: [...positions] }))
      .catch((error: unknown) =>
        reply({ type: 'vam-layout-error', id: request.id, error: serializeError(error) }),
      )
  })
}

/**
 * An engine that runs inside a worker.
 *
 * The worker is created on the first run and kept for the next ones. Aborting a
 * run terminates it: a synchronous engine such as dagre cannot be interrupted
 * any other way, and leaving it computing a layout nobody wants would hold the
 * worker for the next run. A fresh one is created when needed.
 *
 * @param name - Engine name: reported in `layout-start`/`layout-done`, and the
 *   engine the worker is asked for.
 * @param createWorker - Makes the worker; usually a `new Worker(new URL(…))`.
 */
export function createWorkerLayout<O = unknown>(
  name: string,
  createWorker: () => LayoutWorker,
): LayoutEngine<O> {
  let worker: LayoutWorker | undefined
  let nextId = 0

  return {
    name,

    run(graph: LayoutGraph, options?: O, signal?: AbortSignal): Promise<Map<EntityId, XY>> {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) {
          reject(new LayoutAbortedError(name))
          return
        }

        const current = worker ?? createWorker()
        worker = current
        nextId += 1
        const id = nextId

        const discard = (): void => {
          current.terminate()
          if (worker === current) worker = undefined
        }

        const cleanup = (): void => {
          current.removeEventListener('message', onMessage)
          current.removeEventListener('error', onError)
          signal?.removeEventListener('abort', onAbort)
        }

        const onMessage = (event: MessageEvent): void => {
          const response: unknown = event.data
          if (!isRunResponse(response) || response.id !== id) return
          cleanup()
          if (response.type === 'vam-layout-result') resolve(new Map(response.positions))
          else reject(rebuildError(response.error))
        }

        const onError = (event: ErrorEvent): void => {
          cleanup()
          // A worker that failed to load or crashed is not trusted with the next run.
          discard()
          reject(new Error(event.message || `Layout worker "${name}" failed`))
        }

        const onAbort = (): void => {
          cleanup()
          discard()
          reject(new LayoutAbortedError(name))
        }

        current.addEventListener('message', onMessage)
        current.addEventListener('error', onError)
        signal?.addEventListener('abort', onAbort)

        const request: RunRequest = {
          type: 'vam-layout-run',
          id,
          engine: name,
          graph,
          ...(options !== undefined ? { options } : {}),
        }

        try {
          current.postMessage(request)
        } catch (error) {
          // Options carrying a function cannot be cloned into a worker.
          cleanup()
          reject(error)
        }
      })
    },
  }
}
