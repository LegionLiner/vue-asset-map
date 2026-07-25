import type { LocaleMessages } from '../types/locale'

export const en: LocaleMessages = {
  'search.placeholder': 'Search: name, IP, domain, 10.38.24.0/24',
  'search.label': 'Search the map',
  'search.clear': 'Clear search',
  'search.results': 'Found: {count}',
  'search.empty': 'Nothing found',

  'view.label': 'View',
  'view.switch': 'Switch map view',

  'filter.label': 'Filters',
  'filter.kinds': 'Node types',
  'filter.statuses': 'Status',
  'filter.reset': 'Reset filters',
  'filter.empty': 'No values available',
  'filter.active': 'Active filters: {count}',
  'filter.search': 'Search filters',
  'filter.close': 'Close filters',

  'details.title': 'Details',
  'details.close': 'Close panel',
  'details.kind': 'Type',
  'details.status': 'Status',
  'details.id': 'Identifier',
  'details.addresses': 'Addresses',
  'details.meta': 'Additional',
  'details.neighbors': 'Links',
  'details.tab.overview': 'Overview',
  'details.tab.links': 'Links',
  'details.empty': 'Select a node on the map',
  'details.collapseWindow': 'Collapse window',
  'details.expandWindow': 'Expand window',

  'group.label': '{bucket}',
  'group.expand': 'Expand group',
  'group.collapse': 'Collapse group',
  'group.members': 'Nodes in group: {count}',
  'group.internalLinks': 'Links inside group: {count}',

  'link.aggregated': 'Links: {count}',
  'link.direction': 'Direction: {source} → {target}',

  'canvas.label': 'Network map',
  'canvas.empty': 'Nothing to display',
  'canvas.loading': 'Building the map…',
  'canvas.error': 'Failed to build the map',

  'controls.zoomIn': 'Zoom in',
  'controls.zoomOut': 'Zoom out',
  'controls.fitView': 'Fit the whole map',
  'controls.relayout': 'Rebuild layout',
  'controls.theme.light': 'Light theme',
  'controls.theme.dark': 'Dark theme',

  'minimap.label': 'Overview map',

  'node.status': 'Status: {status}',
  'node.badges': 'Badges: {count}',
}
