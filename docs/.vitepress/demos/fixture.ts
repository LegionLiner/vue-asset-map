/**
 * Every example on the site runs on one dataset — the same demo infrastructure
 * the playground and the tests use, so a change to it cannot leave the docs
 * showing something that no longer exists.
 */
import {
  CloudIcon,
  ContainerIcon,
  RouterIcon,
  ServerIcon,
  VpsIcon,
  WorkstationIcon,
} from '../../../playground/icons'

export {
  entities,
  links,
  views,
  filterGroups,
  nodeMarkers,
  markerAnchors,
  statusColors,
  generateLargeGraph,
  KIND_CLOUD,
  KIND_VPS,
  KIND_ROUTER,
  KIND_HYPERVISOR,
  KIND_WORKSTATION,
  KIND_CONTAINER,
  LAYER_PHYSICAL,
  LAYER_LOGICAL,
} from '../../../fixtures/infra'

export type { AssetMeta, DemoEntity, DemoLink } from '../../../fixtures/infra'

/** `type` → icon component, exactly as a consumer would declare it. */
export const kindIcons = {
  cloud: CloudIcon,
  router: RouterIcon,
  hypervisor: ServerIcon,
  vps: VpsIcon,
  workstation: WorkstationIcon,
  container: ContainerIcon,
}
