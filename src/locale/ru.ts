import type { LocaleMessages } from '../types/locale'

export const ru: LocaleMessages = {
  'search.placeholder': 'Поиск: имя, IP, домен, 10.38.24.0/24',
  'search.label': 'Поиск по карте',
  'search.clear': 'Очистить поиск',
  'search.results': 'Найдено: {count}',
  'search.empty': 'Ничего не найдено',

  'view.label': 'Вид',
  'view.switch': 'Переключить вид карты',

  'filter.label': 'Фильтры',
  'filter.kinds': 'Типы узлов',
  'filter.statuses': 'Состояние',
  'filter.reset': 'Сбросить фильтры',
  'filter.empty': 'Нет доступных значений',
  'filter.active': 'Активных фильтров: {count}',
  'filter.search': 'Поиск по фильтрам',
  'filter.close': 'Закрыть фильтры',

  'details.title': 'Сведения',
  'details.close': 'Закрыть панель',
  'details.kind': 'Тип',
  'details.status': 'Состояние',
  'details.id': 'Идентификатор',
  'details.addresses': 'Адреса',
  'details.meta': 'Дополнительно',
  'details.neighbors': 'Связи',
  'details.tab.overview': 'Обзор',
  'details.tab.links': 'Связи',
  'details.empty': 'Выберите узел на карте',
  'details.collapseWindow': 'Свернуть окно',
  'details.expandWindow': 'Развернуть окно',

  'window.close': 'Закрыть окно',
  'window.collapse': 'Свернуть окно',
  'window.expand': 'Развернуть окно',
  'window.drag': 'Перетащить окно',

  'group.label': '{bucket}',
  'group.expand': 'Раскрыть группу',
  'group.collapse': 'Свернуть группу',
  'group.members': 'Узлов в группе: {count}',
  'group.internalLinks': 'Связей внутри группы: {count}',

  'link.aggregated': 'Связей: {count}',
  'link.direction': 'Направление: {source} → {target}',

  'canvas.label': 'Карта сети',
  'canvas.empty': 'Нет данных для отображения',
  'canvas.loading': 'Построение карты…',
  'canvas.error': 'Не удалось построить карту',

  'controls.zoomIn': 'Приблизить',
  'controls.zoomOut': 'Отдалить',
  'controls.fitView': 'Показать всю карту',
  'controls.relayout': 'Перестроить раскладку',
  'controls.theme.light': 'Светлая тема',
  'controls.theme.dark': 'Тёмная тема',

  'minimap.label': 'Обзорная карта',

  'marker.membership': 'Принадлежность: {label}',

  'node.status': 'Состояние: {status}',
  'node.badges': 'Метки: {count}',
}
