import { describe, expect, it } from 'vitest'
import {
  applyFields,
  fieldFromInput,
  fieldLabel,
  fieldToInput,
  readField,
  writeField,
} from '../../src/core/field'

describe('readField', () => {
  it('читает вложенный путь', () => {
    expect(readField({ meta: { speed: '1 Гбит/с' } }, 'meta.speed')).toBe('1 Гбит/с')
  })

  it('отсутствующая ветка — это undefined, а не исключение', () => {
    // Схема пишется под форму, которую данные обязаны иметь; запись без `meta`
    // — обычное дело, а не исключительная ситуация.
    expect(readField({ id: 'a' }, 'meta.speed')).toBeUndefined()
    expect(readField({ meta: null }, 'meta.speed')).toBeUndefined()
    expect(readField(undefined, 'meta.speed')).toBeUndefined()
  })
})

describe('writeField', () => {
  it('возвращает копию, исходный объект не трогает', () => {
    // Сущности принадлежат потребителю: правка уходит новым объектом, который
    // приложение вольно принять или отбросить.
    const source = { id: 'a', label: 'Было' }
    const next = writeField(source, 'label', 'Стало')

    expect(next).not.toBe(source)
    expect(source.label).toBe('Было')
    expect(next.label).toBe('Стало')
  })

  it('копирует каждый уровень пути, а не только верхний', () => {
    const source = { id: 'a', meta: { speed: '100', owner: 'demo' } }
    const next = writeField(source, 'meta.speed', '1000')

    expect(next.meta).not.toBe(source.meta)
    expect(source.meta.speed).toBe('100')
    expect(next.meta).toEqual({ speed: '1000', owner: 'demo' })
  })

  it('создаёт недостающие ветки', () => {
    expect(writeField({ id: 'a' }, 'meta.speed', '1000')).toEqual({ id: 'a', meta: { speed: '1000' } })
  })

  it('не-объект посреди пути заменяется, а не роняет запись', () => {
    expect(writeField({ meta: 'строка' }, 'meta.speed', '10')).toEqual({ meta: { speed: '10' } })
  })
})

describe('applyFields', () => {
  it('значение, равное текущему, изменением не считается', () => {
    // Открыть форму и закрыть — не правка: приложение не должно получить запись.
    const source = { id: 'a', label: 'Хост' }
    expect(applyFields(source, { label: 'Хост' })).toBe(source)
  })

  it('применяет только тронутые поля, одним новым объектом', () => {
    const source = { id: 'a', label: 'Хост', meta: { speed: '100' } }
    const next = applyFields(source, { label: 'Новый', 'meta.speed': '1000' })

    expect(next).not.toBe(source)
    expect(next).toEqual({ id: 'a', label: 'Новый', meta: { speed: '1000' } })
  })

  it('пустой набор правок возвращает тот же объект', () => {
    const source = { id: 'a' }
    expect(applyFields(source, {})).toBe(source)
  })
})

describe('значения полей ввода', () => {
  it('массив показывается перечислением', () => {
    expect(fieldToInput(['a', 'b'])).toBe('a, b')
  })

  it('пусто и отсутствие — одно и то же пустое поле', () => {
    expect(fieldToInput(undefined)).toBe('')
    expect(fieldToInput(null)).toBe('')
  })

  it('пустая строка на входе означает «нет значения»', () => {
    // Для необязательного поля хранить '' — это другой вид неверного, чем не
    // хранить ничего.
    expect(fieldFromInput('   ', { key: 'x' })).toBeUndefined()
  })

  it('числовое поле отдаёт число', () => {
    expect(fieldFromInput('42', { key: 'x', type: 'number' })).toBe(42)
  })

  it('нечисло в числовом поле сохраняет введённый текст', () => {
    // Молча превратить это в NaN значило бы уничтожить набранное.
    expect(fieldFromInput('быстро', { key: 'x', type: 'number' })).toBe('быстро')
  })

  it('подпись берётся из поля, иначе из хвоста пути', () => {
    expect(fieldLabel({ key: 'meta.speed', label: 'Скорость' })).toBe('Скорость')
    expect(fieldLabel({ key: 'meta.speed' })).toBe('speed')
  })
})
