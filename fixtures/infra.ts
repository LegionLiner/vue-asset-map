import type {
  FilterGroupDef,
  AssetEntity,
  AssetLink,
  AssetView,
  NodeMarkerDef,
  MarkerAnchor,
  LinkTypeDef,
} from '../src/types/index'
import { connectionMarkers } from '../src/core/markers'

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
  subnet?: 'internet' | 'vpn' | 'docker'
  assetType?: 'device' | 'vm' | 'container' | 'database' | 'service'
  severity?: 'critical' | 'high' | 'medium' | 'low'
}

export type DemoEntity = AssetEntity<AssetMeta>
export type DemoLink = AssetLink<{ bandwidth?: string; protocol?: string }>

export const LAYER_PHYSICAL = 'physical'
export const LAYER_LOGICAL = 'logical'

export const KIND_CLOUD = 'cloud'
export const KIND_VPS = 'vps'
export const KIND_ROUTER = 'router'
export const KIND_HYPERVISOR = 'hypervisor'
export const KIND_WORKSTATION = 'workstation'
export const KIND_CONTAINER = 'container'

const entity = (id: string, type: string, label: string, extra: Partial<DemoEntity> = {}): DemoEntity => ({
  id,
  type,
  label,
  ...extra,
})

export const entities: DemoEntity[] = [
  entity('internet', KIND_CLOUD, 'Интернет', {
    status: 'online',
    meta: { subnet: 'internet', assetType: 'service', severity: 'critical', location: 'WAN' },
  }),
  entity('cloudflare', KIND_CLOUD, 'Cloudflare', {
    status: 'online',
    sublabels: ['1.1.1.1'],
    meta: {
      subnet: 'internet',
      assetType: 'service',
      severity: 'high',
      location: 'Anycast',
      tags: ['cdn', 'dns'],
    },
  }),

  entity('vps-tailscale', KIND_VPS, 'Tailscale VPS', {
    status: 'online',
    sublabels: ['46.8.158.127', '100.64.0.2'],
    badges: [{ id: 'vpn' }],
    meta: {
      subnet: 'vpn',
      assetType: 'vm',
      severity: 'critical',
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
      subnet: 'vpn',
      assetType: 'vm',
      severity: 'high',
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
    meta: {
      subnet: 'internet',
      assetType: 'vm',
      severity: 'medium',
      externalIp: '23.152.0.160',
      os: 'Ubuntu 22.04',
      location: 'US',
      cpu: 2,
      ramGb: 2,
    },
  }),
  entity('vps-nginx', KIND_VPS, 'NGINX VPS', {
    status: 'online',
    sublabels: ['46.8.158.122'],
    badges: [{ id: 'tls', tooltip: 'Терминация TLS' }],
    meta: {
      subnet: 'internet',
      assetType: 'vm',
      severity: 'high',
      externalIp: '46.8.158.122',
      os: 'Alpine 3.20',
      location: 'RU',
      cpu: 1,
      ramGb: 1,
    },
  }),

  entity('keenetic-1', KIND_ROUTER, 'Keenetic 1', {
    status: 'online',
    sublabels: ['pteam.keenetic.pro', '192.168.1.1'],
    meta: {
      subnet: 'internet',
      assetType: 'device',
      severity: 'high',
      fqdn: 'pteam.keenetic.pro',
      location: 'Office A',
    },
  }),
  entity('keenetic-2', KIND_ROUTER, 'Keenetic 2', {
    status: 'online',
    sublabels: ['pteam2.netcraze.pro', '192.168.2.1'],
    meta: {
      subnet: 'internet',
      assetType: 'device',
      severity: 'high',
      fqdn: 'pteam2.netcraze.pro',
      location: 'Office B',
    },
  }),

  entity('pve-artjom', KIND_HYPERVISOR, 'Proxmox Artjom home', {
    status: 'online',
    sublabels: ['192.168.1.10'],
    parentId: 'keenetic-1',
    meta: {
      subnet: 'vpn',
      assetType: 'device',
      severity: 'medium',
      os: 'Proxmox VE 8',
      owner: 'Artjom',
      cpu: 8,
      ramGb: 32,
      location: 'Home',
    },
  }),
  entity('pve-beelink', KIND_HYPERVISOR, 'Proxmox Beelink', {
    status: 'online',
    sublabels: ['192.168.2.10'],
    parentId: 'keenetic-2',
    meta: {
      subnet: 'vpn',
      assetType: 'device',
      severity: 'high',
      os: 'Proxmox VE 8',
      cpu: 8,
      ramGb: 16,
      location: 'Office B',
    },
  }),
  entity('pve-gpu', KIND_HYPERVISOR, 'Proxmox GPU server', {
    status: 'degraded',
    sublabels: ['192.168.2.11'],
    parentId: 'keenetic-2',
    meta: {
      subnet: 'vpn',
      assetType: 'device',
      severity: 'critical',
      os: 'Proxmox VE 8',
      cpu: 32,
      ramGb: 128,
      location: 'Office B',
      tags: ['gpu'],
    },
  }),

  entity('ws-artjom', KIND_WORKSTATION, 'Artjom', {
    status: 'online',
    sublabels: ['10.38.24.70', '100.64.0.70'],
    parentId: 'keenetic-1',
    meta: {
      subnet: 'vpn',
      assetType: 'device',
      severity: 'low',
      overlayIp: '100.64.0.70',
      owner: 'Artjom',
      os: 'Windows 11',
    },
  }),
  entity('ws-sergey', KIND_WORKSTATION, 'Sergey', {
    status: 'online',
    sublabels: ['10.38.24.71', '100.64.0.71'],
    parentId: 'keenetic-1',
    meta: {
      subnet: 'vpn',
      assetType: 'device',
      severity: 'low',
      overlayIp: '100.64.0.71',
      owner: 'Sergey',
      os: 'macOS 15',
    },
  }),
  entity('ws-dmitry', KIND_WORKSTATION, 'Dmitry', {
    status: 'online',
    sublabels: ['10.38.24.72', '100.64.0.72'],
    parentId: 'keenetic-2',
    meta: {
      subnet: 'vpn',
      assetType: 'device',
      severity: 'medium',
      overlayIp: '100.64.0.72',
      owner: 'Dmitry',
      os: 'Fedora 41',
    },
  }),
  entity('ws-vlad', KIND_WORKSTATION, 'Vlad', {
    status: 'offline',
    sublabels: ['10.38.24.73', '100.64.0.73'],
    parentId: 'keenetic-2',
    meta: {
      subnet: 'vpn',
      assetType: 'device',
      severity: 'low',
      overlayIp: '100.64.0.73',
      owner: 'Vlad',
      os: 'Windows 11',
    },
  }),
  entity('ws-andrey', KIND_WORKSTATION, 'Andrey', {
    status: 'online',
    sublabels: ['10.38.24.74', '100.64.0.74'],
    parentId: 'keenetic-2',
    meta: {
      subnet: 'vpn',
      assetType: 'device',
      severity: 'low',
      overlayIp: '100.64.0.74',
      owner: 'Andrey',
      os: 'Ubuntu 24.04',
    },
  }),

  ...Array.from({ length: 14 }, (_, index) =>
    entity(`ct-web-${index + 1}`, KIND_CONTAINER, `web-${String(index + 1).padStart(2, '0')}`, {
      status: index === 3 ? 'offline' : 'online',
      sublabels: [`10.38.99.${index + 1}`],
      parentId: 'pve-beelink',
      meta: {
        os: 'Debian 12',
        owner: 'web-farm',
        tags: ['lxc'],
        subnet: 'docker',
        assetType: 'container',
        severity: index % 4 === 0 ? 'medium' : 'low',
      },
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
  link('l-inet-cf', 'internet', 'cloudflare', [LAYER_PHYSICAL], { type: 'fiber' }),
  link('l-inet-tailscale', 'internet', 'vps-tailscale', [LAYER_PHYSICAL], { type: 'fiber' }),
  link('l-inet-brainstorm', 'internet', 'vps-brainstorm', [LAYER_PHYSICAL], { type: 'solid' }),
  link('l-inet-160', 'internet', 'vps-160-usa', [LAYER_PHYSICAL], { type: 'solid' }),
  link('l-inet-nginx', 'internet', 'vps-nginx', [LAYER_PHYSICAL], { type: 'fiber' }),
  link('l-inet-keen1', 'internet', 'keenetic-1', [LAYER_PHYSICAL], { type: 'fiber' }),
  link('l-inet-keen2', 'internet', 'keenetic-2', [LAYER_PHYSICAL], { type: 'fiber' }),
  link('l-cf-nginx', 'cloudflare', 'vps-nginx', [LAYER_PHYSICAL], { type: 'solid', directed: true }),

  link('l-keen1-pve-artjom', 'keenetic-1', 'pve-artjom', [LAYER_PHYSICAL], { type: 'solid' }),
  link('l-keen2-pve-beelink', 'keenetic-2', 'pve-beelink', [LAYER_PHYSICAL], { type: 'solid' }),
  link('l-keen2-pve-gpu', 'keenetic-2', 'pve-gpu', [LAYER_PHYSICAL], { type: 'solid' }),

  link('l-keen1-ws-artjom', 'keenetic-1', 'ws-artjom', [LAYER_PHYSICAL], { type: 'wifi' }),
  link('l-keen1-ws-sergey', 'keenetic-1', 'ws-sergey', [LAYER_PHYSICAL], { type: 'wifi' }),
  link('l-keen2-ws-dmitry', 'keenetic-2', 'ws-dmitry', [LAYER_PHYSICAL], { type: 'wifi' }),
  link('l-keen2-ws-vlad', 'keenetic-2', 'ws-vlad', [LAYER_PHYSICAL], { type: 'wifi' }),
  link('l-keen2-ws-andrey', 'keenetic-2', 'ws-andrey', [LAYER_PHYSICAL], { type: 'wifi' }),

  link('l-keen2-inet-backup', 'keenetic-2', 'internet', [LAYER_PHYSICAL], { type: 'dashed' }),

  ...Array.from({ length: 14 }, (_, index) =>
    link(`l-beelink-ct-${index + 1}`, 'pve-beelink', `ct-web-${index + 1}`, [LAYER_PHYSICAL], {
      type: 'solid',
    }),
  ),
  link('l-ct-1-2', 'ct-web-1', 'ct-web-2', [LAYER_PHYSICAL], { type: 'solid' }),
  link('l-ct-2-3', 'ct-web-2', 'ct-web-3', [LAYER_PHYSICAL], { type: 'solid' }),

  link('o-ts-brainstorm', 'vps-tailscale', 'vps-brainstorm', [LAYER_LOGICAL], { type: 'dashed' }),
  link('o-ts-nginx', 'vps-tailscale', 'vps-nginx', [LAYER_LOGICAL], { type: 'dashed' }),
  link('o-ts-artjom', 'vps-tailscale', 'ws-artjom', [LAYER_LOGICAL], { type: 'dashed' }),
  link('o-ts-sergey', 'vps-tailscale', 'ws-sergey', [LAYER_LOGICAL], { type: 'dashed' }),
  link('o-ts-dmitry', 'vps-tailscale', 'ws-dmitry', [LAYER_LOGICAL], { type: 'dashed' }),
  link('o-ts-vlad', 'vps-tailscale', 'ws-vlad', [LAYER_LOGICAL], { type: 'dashed' }),
  link('o-ts-andrey', 'vps-tailscale', 'ws-andrey', [LAYER_LOGICAL], { type: 'dashed' }),
  link('o-ts-pve-artjom', 'vps-tailscale', 'pve-artjom', [LAYER_LOGICAL], { type: 'dashed' }),
  link('o-ts-pve-beelink', 'vps-tailscale', 'pve-beelink', [LAYER_LOGICAL], { type: 'dashed' }),
  link('o-ts-pve-gpu', 'vps-tailscale', 'pve-gpu', [LAYER_LOGICAL], { type: 'dashed' }),
  link('o-artjom-dmitry', 'ws-artjom', 'ws-dmitry', [LAYER_LOGICAL], { type: 'dashed' }),
]

export const views: AssetView[] = [
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
    hideIsolated: true,
    layout: { engine: 'radial', options: { rootId: 'vps-tailscale' } },
  },
]

export const filterGroups: FilterGroupDef[] = [
  {
    id: 'subnet',
    label: 'Подсеть',
    valuesOf: (entity) => [(entity.meta as AssetMeta | undefined)?.subnet ?? ''],
    options: [
      { value: 'internet', label: 'Интернет' },
      { value: 'vpn', label: 'VPN' },
      { value: 'docker', label: 'Docker Bridge' },
    ],
  },
  {
    id: 'assetType',
    label: 'Тип актива',
    valuesOf: (entity) => [(entity.meta as AssetMeta | undefined)?.assetType ?? ''],
    options: [
      { value: 'device', label: 'Физическое устройство' },
      { value: 'vm', label: 'Виртуальная машина' },
      { value: 'container', label: 'Контейнер' },
      { value: 'database', label: 'База данных' },
      { value: 'service', label: 'Сервис' },
    ],
  },
  {
    id: 'severity',
    label: 'Критичность',
    valuesOf: (entity) => [(entity.meta as AssetMeta | undefined)?.severity ?? ''],
    options: [
      { value: 'critical', label: 'Критический' },
      { value: 'high', label: 'Высокий' },
      { value: 'medium', label: 'Средний' },
      { value: 'low', label: 'Низкий' },
    ],
    defaultOpen: false,
  },
]

export const markerAnchors: MarkerAnchor[] = [
  { id: 'keenetic-1', label: 'Keenetic 1' },
  { id: 'keenetic-2', label: 'Keenetic 2' },
  { id: 'vps-tailscale', label: 'Tailscale VPS' },
]

export const nodeMarkers: NodeMarkerDef[] = connectionMarkers(markerAnchors)

export const statusColors: Record<string, string> = {
  online: 'var(--vam-status-online)',
  offline: 'var(--vam-status-offline)',
  degraded: 'var(--vam-status-warning)',
}

/**
 * The kinds of connection this fixture uses.
 *
 * Each carries a dash as well as a colour: colour alone does not survive a
 * monochrome print or a red-green deficiency, and the legend is meant to be
 * readable by everyone who can see the map.
 */
export const linkTypes: LinkTypeDef[] = [
  { id: 'fiber', label: 'Оптоволокно', color: '#2f7d4f', width: 2 },
  { id: 'wifi', label: 'Wi-Fi', color: '#c07b1e', dash: '2 3' },
  { id: 'solid', label: 'Ethernet', color: '#4d6d9a' },
  { id: 'dashed', label: 'VPN-туннель', color: '#5a5ee7', dash: '6 4' },
]

export function generateLargeGraph(
  nodeCount: number,
  edgeCount: number,
): { entities: DemoEntity[]; links: DemoLink[] } {
  const types = [KIND_VPS, KIND_ROUTER, KIND_HYPERVISOR, KIND_WORKSTATION, KIND_CONTAINER]
  const bigEntities: DemoEntity[] = []

  for (let index = 0; index < nodeCount; index += 1) {
    const type = types[index % types.length] ?? KIND_WORKSTATION
    const isShelf = index % 20 === 0
    const shelfIndex = Math.floor(index / 20) * 20
    bigEntities.push({
      id: `n-${index}`,
      type,
      label: `node-${index}`,
      status: index % 7 === 0 ? 'offline' : 'online',
      sublabels: [`10.${(index >> 16) & 255}.${(index >> 8) & 255}.${index & 255}`],
      parentId: isShelf ? null : `n-${shelfIndex}`,
    })
  }

  const bigLinks: DemoLink[] = []
  for (let index = 0; index < edgeCount; index += 1) {
    const source = (index * 7919) % nodeCount
    const target = (index * 104729 + 13) % nodeCount
    if (source === target) continue
    bigLinks.push({
      id: `e-${index}`,
      source: `n-${source}`,
      target: `n-${target}`,
      layers: [LAYER_PHYSICAL],
      type: 'solid',
    })
  }

  return { entities: bigEntities, links: bigLinks }
}
