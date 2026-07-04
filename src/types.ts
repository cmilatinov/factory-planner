import type { ReactNode } from 'react'

export const panelDefinitions = [
  { id: 'planner', title: 'Production planner', component: 'planner' },
  { id: 'blueprint-list', title: 'Blueprint List', component: 'blueprintList' },
  { id: 'recipe-library', title: 'Recipe Library', component: 'recipeLibrary' },
  { id: 'inspector', title: 'Inspector', component: 'inspector' },
] as const

export const optionalPanelDefinitions = [
  { id: 'floor-plan', title: 'Floor Plan', component: 'floorPlan' },
  { id: 'validation', title: 'Validation', component: 'validation' },
  { id: 'export', title: 'Export', component: 'export' },
  { id: 'settings', title: 'Settings', component: 'settings' },
] as const

export type DefaultPanelId = (typeof panelDefinitions)[number]['id']

export type PlannerNodeKind = 'recipe' | 'resource'

export interface RecipeInput {
  item: string
  rate: number
}

export interface Recipe {
  id: string
  name: string
  machine: string
  outputItem: string
  outputRate: number
  inputs: RecipeInput[]
  powerMw: number
  size: {
    widthCm: number
    heightCm: number
  }
  raw?: boolean
}

export interface PlannerNodeData {
  id: string
  kind: PlannerNodeKind
  recipeId?: string
  label: string
  outputItem: string
  outputRate: number
  machine: string
  machineCount: number
  roundedMachineCount: number
  clockPercent: number
  blueprintId?: string
  position: {
    x: number
    y: number
  }
}

export interface PlannerEdgeData {
  id: string
  source: string
  target: string
  item: string
  rate: number
}

export type ComponentType =
  | 'machine'
  | 'belt'
  | 'splitter'
  | 'merger'
  | 'lift'
  | 'pipeline'
  | 'junction'
  | 'pump'
  | 'support'
  | 'power-pole'
  | 'wire'

export type Orientation = 0 | 90 | 180 | 270

export interface BlueprintComponent {
  id: string
  type: ComponentType
  label: string
  xCm: number
  yCm: number
  widthCm: number
  heightCm: number
  rotation: Orientation
  clockPercent?: number
  tier?: number
  stackLevel?: number
  elevationCm?: number
  direction?: 'left' | 'right' | 'up' | 'down'
  flowRate?: number
  supported?: boolean
  ports?: string[]
}

export interface PartialTileGroup {
  groupId: string
  baseDisplayName: string
  tileWidthFoundations: number
  tileHeightFoundations: number
  columns: number
  rows: number
  tileName: string
  row: number
  column: number
  sourcePlannerNodeId?: string
}

export interface Blueprint {
  id: string
  name: string
  sourcePlannerNodeId?: string
  components: BlueprintComponent[]
  createdAt: string
  updatedAt: string
  metadata: {
    machineCount: number
    fractionalMachineCount: number
    roundingFactor: number
    clockPercent: number
    inputDirection: DirectionSetting
    outputDirection: DirectionSetting
    exportSize: ExportSize
    footprintWidthCm: number
    footprintHeightCm: number
  }
  partialTileGroup?: PartialTileGroup
}

export type DirectionSetting = 'left' | 'right' | 'up' | 'down'

export type FlowDirection = 'left-to-right' | 'right-to-left'

export type GenerationMode = 'single' | 'partial-tiled'

export type ExportSize = 'none' | '4x4' | '5x5' | '6x6'

export interface ProjectSettings {
  machineRoundingFactor: number
  clippingEnabled: boolean
  inputDirection: DirectionSetting
  outputDirection: DirectionSetting
  flowDirection: FlowDirection
  generationMode: GenerationMode
  partialTileWidthFoundations: number
  partialTileHeightFoundations: number
  exportSize: ExportSize
  floorMarginFoundations: number
}

export interface FloorPlacement {
  id: string
  blueprintId: string
  label: string
  xCm: number
  yCm: number
  widthCm: number
  heightCm: number
  sourcePlannerNodeId?: string
  partialGroup?: Pick<PartialTileGroup, 'columns' | 'rows' | 'baseDisplayName'>
}

export interface Floor {
  id: string
  name: string
  placements: FloorPlacement[]
  marginCm: number
}

export interface FloorPlan {
  floors: Floor[]
}

export interface ProjectState {
  plannerNodes: PlannerNodeData[]
  plannerEdges: PlannerEdgeData[]
  blueprints: Blueprint[]
  floorPlan: FloorPlan
  settings: ProjectSettings
  selectedPlannerNodeId?: string
  selectedBlueprintId?: string
  validation: ValidationReport
}

export type ValidationSeverity = 'warning' | 'error'

export interface ValidationIssue {
  id: string
  severity: ValidationSeverity
  scope: 'planner' | 'blueprint' | 'floor' | 'export'
  message: string
  targetId?: string
}

export interface ValidationReport {
  issues: ValidationIssue[]
  checkedAt: string
}

export interface PlacementPreview {
  state: 'valid' | 'discouraged' | 'invalid'
  outline: 'normal' | 'yellow' | 'red'
  canPlace: boolean
  message: string
}

export interface PlannerStats {
  powerMw: number
  inputs: Record<string, number>
  outputs: Record<string, number>
  rawDemand: Record<string, number>
  fractionalMachines: number
  roundedMachines: number
  roundingImpact: number
}

export interface BlueprintStats {
  objectCounts: Record<ComponentType, number>
  machineClocks: number[]
  stackedLogistics: number
  throughputWarnings: number
  footprint: string
  exportEligible: boolean
}

export interface FloorStats {
  floorCount: number
  squareAreaByFloor: Record<string, number>
  tileGroups: number
  marginsCm: number[]
  adjacencyWarnings: number
  orderWarnings: number
}

export interface StatisticWindow {
  sourcePanelId: string
  title: string
  zIndex: number
  x: number
  y: number
  width: number
  height: number
  content: ReactNode
}

export interface BlueprintExportPair {
  sbpName: string
  sbp: Uint8Array
  sbpcfgName: string
  sbpcfg: string
}
