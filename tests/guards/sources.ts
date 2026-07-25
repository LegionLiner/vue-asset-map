import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Чтение исходников с диска для guard-тестов.
 *
 * Именно с диска, а не через `import.meta.glob`: Vitest отключает обработку CSS,
 * поэтому импорт `.css` даёт пустую строку, и проверка тем была бы зелёной,
 * ничего не проверяя. Заодно так очевидно, что тест смотрит на настоящий текст
 * файла, а не на результат сборки.
 */

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

export interface SourceFile {
  /** Путь от корня репозитория, всегда со прямыми слэшами. */
  path: string
  content: string
}

export function readSources(directory: string, extensions: readonly string[]): SourceFile[] {
  const absolute = join(repoRoot, directory)
  const files: SourceFile[] = []

  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!extensions.some((extension) => entry.name.endsWith(extension))) continue
      files.push({
        path: relative(repoRoot, full).split(sep).join('/'),
        content: readFileSync(full, 'utf8'),
      })
    }
  }

  walk(absolute)
  return files.sort((a, b) => a.path.localeCompare(b.path))
}

/** Убирает комментарии всех трёх видов: в них можно писать что угодно. */
export function stripComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

export function fileNamed(files: readonly SourceFile[], fileName: string): SourceFile {
  const found = files.find((file) => file.path.endsWith(fileName))
  if (!found) throw new Error(`guard: не найден файл ${fileName}`)
  return found
}
