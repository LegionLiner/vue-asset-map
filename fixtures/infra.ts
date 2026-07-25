/**
 * Демо-инфраструктура: одна и та же фикстура используется плейграундом и тестами.
 *
 * Лежит вне `src/`, потому что не должна попадать в публикуемый пакет: это
 * данные примера, а не часть API библиотеки.
 */
import type { NetworkEntity, NetworkLink, NetworkView } from '../src/types/index'

/** Метаданные активов в этом демо. Потребитель задаёт свою форму. */
export interface AssetMeta {
  owner?: string
  os?: string
  externalIp?: string
  overlayIp?: string
  fqdn?: string
  cpu?: number
  ramGb?: number
  location?: string
  tags?: string[]
}

export type DemoEntity = NetworkEntity<AssetMeta>
export type DemoLink = NetworkLink<{ bandwidth?: string; protocol?: string }>

/** Слои связей. Значения совпадают с id видов — это и есть дефолт проекции. */
export const LAYER_PHYSICAL = 'physical'
export const LAYER_LOGICAL = 'logical'

export const KIND_CLOUD = 'cloud'
export const KIND_VPS = 'vps'
export const KIND_ROUTER = 'router'
export const KIND_HYPERVISOR = 'hypervisor'
export const KIND_WORKSTATION = 'workstation'
export const KIND_CONTAINER = 'container'

const entity = (id: string, kind: string, label: string, extra: Partial<DemoEntity> = {}): DemoEntity => ({
  id,
  kind,
  label,
  ...extra,
})

export const entities: DemoEntity[] = [
  // --- Облака -------------------------------------------------------------
  entity('internet', KIND_CLOUD, 'Интернет', {
    status: 'online',
    meta: { location: 'WAN' },
  }),
  entity('cloudflare', KIND_CLOUD, 'Cloudflare', {
    status: 'online',
    sublabels: ['1.1.1.1'],
    meta: { location: 'Anycast', tags: ['cdn', 'dns'] },
  }),

  // --- VPS ----------------------------------------------------------------
  entity('vps-tailscale', KIND_VPS, 'Tailscale VPS', {
    status: 'online',
    sublabels: ['46.8.158.127', '100.64.0.2'],
    badges: [{ id: 'vpn', color: 'var(--vnm-accent)', tooltip: 'Координатор VPN' }],
    meta: {
      externalIp: '46.8.158.127',
      overlayIp: '100.64.0.2',
      os: 'Debian 12',
      owner: 'infra',
      cpu: 2,
      ramGb: 4,
      location: 'RU',
    },
  }),
  entity('vps-brainstorm', KIND_VPS, 'BrainStorm VPS', {
    status: 'online',
    sublabels: ['91.242.163.141', '100.64.0.3'],
    meta: {
      externalIp: '91.242.163.141',
      overlayIp: '100.64.0.3',
      os: 'Ubuntu 24.04',
      owner: 'brainstorm',
      cpu: 4,
      ramGb: 8,
      location: 'RU',
    },
  }),
  entity('vps-160-usa', KIND_VPS, 'VPS 160 (USA)', {
    status: 'degraded',
    sublabels: ['23.152.0.160'],
    meta: { externalIp: '23.152.0.160', os: 'Ubuntu 22.04', location: 'US', cpu: 2, ramGb: 2 },
  }),
  entity('vps-nginx', KIND_VPS, 'NGINX VPS', {
    status: 'online',
    sublabels: ['46.8.158.122'],
    badges: [{ id: 'tls', tooltip: 'Терминация TLS' }],
    meta: { externalIp: '46.8.158.122', os: 'Alpine 3.20', location: 'RU', cpu: 1, ramGb: 1 },
  }),

  // --- Роутеры ------------------------------------------------------------
  entity('keenetic-1', KIND_ROUTER, 'Keenetic 1', {
    status: 'online',
    sublabels: ['pteam.keenetic.pro', '192.168.1.1'],
    meta: { fqdn: 'pteam.keenetic.pro', location: 'Office A' },
  }),
  entity('keenetic-2', KIND_ROUTER, 'Keenetic 2', {
    status: 'online',
    sublabels: ['pteam2.netcraze.pro', '192.168.2.1'],
    meta: { fqdn: 'pteam2.netcraze.pro', location: 'Office B' },
  }),

  // --- Гипервизоры --------------------------------------------------------
  entity('pve-artjom', KIND_HYPERVISOR, 'Proxmox Artjom home', {
    status: 'online',
    sublabels: ['192.168.1.10'],
    parentId: 'keenetic-1',
    meta: { os: 'Proxmox VE 8', owner: 'Artjom', cpu: 8, ramGb: 32, location: 'Home' },
  }),
  entity('pve-beelink', KIND_HYPERVISOR, 'Proxmox Beelink', {
    status: 'online',
    sublabels: ['192.168.2.10'],
    parentId: 'keenetic-2',
    meta: { os: 'Proxmox VE 8', cpu: 8, ramGb: 16, location: 'Office B' },
  }),
  entity('pve-gpu', KIND_HYPERVISOR, 'Proxmox GPU server', {
    status: 'degraded',
    sublabels: ['192.168.2.11'],
    parentId: 'keenetic-2',
    meta: { os: 'Proxmox VE 8', cpu: 32, ramGb: 128, location: 'Office B', tags: ['gpu'] },
  }),

  // --- Рабочие станции ----------------------------------------------------
  entity('ws-artjom', KIND_WORKSTATION, 'Artjom', {
    status: 'online',
    sublabels: ['10.38.24.70', '100.64.0.70'],
    parentId: 'keenetic-1',
    meta: { overlayIp: '100.64.0.70', owner: 'Artjom', os: 'Windows 11' },
  }),
  entity('ws-sergey', KIND_WORKSTATION, 'Sergey', {
    status: 'online',
    sublabels: ['10.38.24.71', '100.64.0.71'],
    parentId: 'keenetic-1',
    meta: { overlayIp: '100.64.0.71', owner: 'Sergey', os: 'macOS 15' },
  }),
  entity('ws-dmitry', KIND_WORKSTATION, 'Dmitry', {
    status: 'online',
    sublabels: ['10.38.24.72', '100.64.0.72'],
    parentId: 'keenetic-2',
    meta: { overlayIp: '100.64.0.72', owner: 'Dmitry', os: 'Fedora 41' },
  }),
  entity('ws-vlad', KIND_WORKSTATION, 'Vlad', {
    status: 'offline',
    sublabels: ['10.38.24.73', '100.64.0.73'],
    parentId: 'keenetic-2',
    meta: { overlayIp: '100.64.0.73', owner: 'Vlad', os: 'Windows 11' },
  }),
  entity('ws-andrey', KIND_WORKSTATION, 'Andrey', {
    status: 'online',
    sublabels: ['10.38.24.74', '100.64.0.74'],
    parentId: 'keenetic-2',
    meta: { overlayIp: '100.64.0.74', owner: 'Andrey', os: 'Ubuntu 24.04' },
  }),

  // --- 14 однотипных контейнеров: проверка автоматической свёртки ----------
  ...Array.from({ length: 14 }, (_, index) =>
    entity(`ct-web-${index + 1}`, KIND_CONTAINER, `web-${String(index + 1).padStart(2, '0')}`, {
      status: index === 3 ? 'offline' : 'online',
      sublabels: [`10.38.99.${index + 1}`],
      parentId: 'pve-beelink',
      meta: { os: 'Debian 12', owner: 'web-farm', tags: ['lxc'] },
    }),
  ),
]

const link = (
  id: string,
  source: string,
  target: string,
  layers: string[],
  extra: Partial<DemoLink> = {},
): DemoLink => ({ id, source, target, layers, ...extra })

export const links: DemoLink[] = [
  // --- Физическая топология: всё сходится к Интернету ---------------------
  link('l-inet-cf', 'internet', 'cloudflare', [LAYER_PHYSICAL], { kind: 'solid' }),
  link('l-inet-tailscale', 'internet', 'vps-tailscale', [LAYER_PHYSICAL], { kind: 'solid' }),
  link('l-inet-brainstorm', 'internet', 'vps-brainstorm', [LAYER_PHYSICAL], { kind: 'solid' }),
  link('l-inet-160', 'internet', 'vps-160-usa', [LAYER_PHYSICAL], { kind: 'solid' }),
  link('l-inet-nginx', 'internet', 'vps-nginx', [LAYER_PHYSICAL], { kind: 'solid' }),
  link('l-inet-keen1', 'internet', 'keenetic-1', [LAYER_PHYSICAL], { kind: 'solid' }),
  link('l-inet-keen2', 'internet', 'keenetic-2', [LAYER_PHYSICAL], { kind: 'solid' }),
  link('l-cf-nginx', 'cloudflare', 'vps-nginx', [LAYER_PHYSICAL], { kind: 'solid', directed: true }),

  link('l-keen1-pve-artjom', 'keenetic-1', 'pve-artjom', [LAYER_PHYSICAL], { kind: 'solid' }),
  link('l-keen2-pve-beelink', 'keenetic-2', 'pve-beelink', [LAYER_PHYSICAL], { kind: 'solid' }),
  link('l-keen2-pve-gpu', 'keenetic-2', 'pve-gpu', [LAYER_PHYSICAL], { kind: 'solid' }),

  link('l-keen1-ws-artjom', 'keenetic-1', 'ws-artjom', [LAYER_PHYSICAL], { kind: 'solid' }),
  link('l-keen1-ws-sergey', 'keenetic-1', 'ws-sergey', [LAYER_PHYSICAL], { kind: 'solid' }),
  link('l-keen2-ws-dmitry', 'keenetic-2', 'ws-dmitry', [LAYER_PHYSICAL], { kind: 'solid' }),
  link('l-keen2-ws-vlad', 'keenetic-2', 'ws-vlad', [LAYER_PHYSICAL], { kind: 'solid' }),
  link('l-keen2-ws-andrey', 'keenetic-2', 'ws-andrey', [LAYER_PHYSICAL], { kind: 'solid' }),

  // Второй канал офиса B: настоящая кратность связи между двумя узлами.
  link('l-keen2-inet-backup', 'keenetic-2', 'internet', [LAYER_PHYSICAL], { kind: 'dashed' }),

  // Контейнеры висят на своём гипервизоре.
  ...Array.from({ length: 14 }, (_, index) =>
    link(`l-beelink-ct-${index + 1}`, 'pve-beelink', `ct-web-${index + 1}`, [LAYER_PHYSICAL], {
      kind: 'solid',
    }),
  ),
  // Пара связей внутри фермы контейнеров: попадут в internalLinkCount группы.
  link('l-ct-1-2', 'ct-web-1', 'ct-web-2', [LAYER_PHYSICAL], { kind: 'solid' }),
  link('l-ct-2-3', 'ct-web-2', 'ct-web-3', [LAYER_PHYSICAL], { kind: 'solid' }),

  // --- Логический вид: VPN-оверлей вокруг Tailscale VPS -------------------
  link('o-ts-brainstorm', 'vps-tailscale', 'vps-brainstorm', [LAYER_LOGICAL], { kind: 'dashed' }),
  link('o-ts-nginx', 'vps-tailscale', 'vps-nginx', [LAYER_LOGICAL], { kind: 'dashed' }),
  link('o-ts-artjom', 'vps-tailscale', 'ws-artjom', [LAYER_LOGICAL], { kind: 'dashed' }),
  link('o-ts-sergey', 'vps-tailscale', 'ws-sergey', [LAYER_LOGICAL], { kind: 'dashed' }),
  link('o-ts-dmitry', 'vps-tailscale', 'ws-dmitry', [LAYER_LOGICAL], { kind: 'dashed' }),
  link('o-ts-vlad', 'vps-tailscale', 'ws-vlad', [LAYER_LOGICAL], { kind: 'dashed' }),
  link('o-ts-andrey', 'vps-tailscale', 'ws-andrey', [LAYER_LOGICAL], { kind: 'dashed' }),
  link('o-ts-pve-artjom', 'vps-tailscale', 'pve-artjom', [LAYER_LOGICAL], { kind: 'dashed' }),
  link('o-ts-pve-beelink', 'vps-tailscale', 'pve-beelink', [LAYER_LOGICAL], { kind: 'dashed' }),
  link('o-ts-pve-gpu', 'vps-tailscale', 'pve-gpu', [LAYER_LOGICAL], { kind: 'dashed' }),
  // Прямой пиринг мимо координатора: в логическом виде появляется второй путь.
  link('o-artjom-dmitry', 'ws-artjom', 'ws-dmitry', [LAYER_LOGICAL], { kind: 'dashed' }),
]

export const views: NetworkView[] = [
  {
    id: LAYER_PHYSICAL,
    label: 'Физическая топология',
    showSublabels: false,
    hideIsolated: false,
    layout: { engine: 'radial', options: { rootId: 'internet' } },
  },
  {
    id: LAYER_LOGICAL,
    label: 'VPN-оверлей',
    showSublabels: true,
    // В оверлее не участвуют облака и контейнеры — их нечего показывать пустыми.
    hideIsolated: true,
    layout: { engine: 'radial', options: { rootId: 'vps-tailscale' } },
  },
]

export const statusColors: Record<string, string> = {
  online: 'var(--vnm-status-online)',
  offline: 'var(--vnm-status-offline)',
  degraded: 'var(--vnm-status-warning)',
}

/** Синтетический граф для бенчмарка: `nodes` узлов и примерно `edges` рёбер. */
export function generateLargeGraph(
  nodeCount: number,
  edgeCount: number,
): { entities: DemoEntity[]; links: DemoLink[] } {
  const kinds = [KIND_VPS, KIND_ROUTER, KIND_HYPERVISOR, KIND_WORKSTATION, KIND_CONTAINER]
  const bigEntities: DemoEntity[] = []

  for (let index = 0; index < nodeCount; index += 1) {
    const kind = kinds[index % kinds.length] ?? KIND_WORKSTATION
    // Иерархия: каждый 20-й узел — «полка», остальные висят на ближайшей полке.
    const isShelf = index % 20 === 0
    const shelfIndex = Math.floor(index / 20) * 20
    bigEntities.push({
      id: `n-${index}`,
      kind,
      label: `node-${index}`,
      status: index % 7 === 0 ? 'offline' : 'online',
      sublabels: [`10.${(index >> 16) & 255}.${(index >> 8) & 255}.${index & 255}`],
      parentId: isShelf ? null : `n-${shelfIndex}`,
    })
  }

  const bigLinks: DemoLink[] = []
  for (let index = 0; index < edgeCount; index += 1) {
    // Детерминированная «случайность»: без Math.random, чтобы бенчмарк был
    // воспроизводим прогон к прогону.
    const source = (index * 7919) % nodeCount
    const target = (index * 104729 + 13) % nodeCount
    if (source === target) continue
    bigLinks.push({
      id: `e-${index}`,
      source: `n-${source}`,
      target: `n-${target}`,
      layers: [LAYER_PHYSICAL],
      kind: 'solid',
    })
  }

  return { entities: bigEntities, links: bigLinks }
}
