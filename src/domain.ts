import { BlueprintHeaderVersion } from '@etothepii/satisfactory-file-parser/build/parser/satisfactory/blueprint/blueprint-header-version'
import JSZip from 'jszip'
import type {
  Blueprint,
  BlueprintComponent,
  BlueprintExportPair,
  BlueprintStats,
  ComponentType,
  ExportSize,
  Floor,
  FloorPlan,
  FloorPlacement,
  FloorStats,
  PartialTileGroup,
  PlacementPreview,
  PlannerNodeData,
  PlannerStats,
  ProjectSettings,
  ProjectState,
  Recipe,
  ValidationIssue,
  ValidationReport,
} from './types'
import { recipes as gameRecipes } from './gameData'

export const layoutStateKey = 'factory-planner:layoutState:v3'
export const projectStateKey = 'factory-planner:projectState:v2'

export const foundationCm = 800

export const componentPalette: {
  type: ComponentType
  label: string
  widthCm: number
  heightCm: number
}[] = [
  { type: 'machine', label: 'Machine', widthCm: 800, heightCm: 800 },
  { type: 'belt', label: 'Belt', widthCm: 800, heightCm: 160 },
  { type: 'splitter', label: 'Splitter', widthCm: 300, heightCm: 300 },
  { type: 'merger', label: 'Merger', widthCm: 300, heightCm: 300 },
  { type: 'lift', label: 'Lift', widthCm: 250, heightCm: 250 },
  { type: 'pipeline', label: 'Pipe', widthCm: 800, heightCm: 180 },
  { type: 'junction', label: 'Junction', widthCm: 260, heightCm: 260 },
  { type: 'pump', label: 'Pump', widthCm: 340, heightCm: 260 },
  { type: 'support', label: 'Support', widthCm: 220, heightCm: 220 },
  { type: 'power-pole', label: 'Pole', widthCm: 220, heightCm: 220 },
  { type: 'wire', label: 'Wire', widthCm: 700, heightCm: 80 },
]

export const recipes: Record<string, Recipe> = gameRecipes

export function defaultSettings(): ProjectSettings {
  return {
    machineRoundingFactor: 2,
    clippingEnabled: false,
    inputDirection: 'left',
    outputDirection: 'right',
    flowDirection: 'left-to-right',
    generationMode: 'single',
    partialTileWidthFoundations: 4,
    partialTileHeightFoundations: 4,
    exportSize: '6x6',
    floorMarginFoundations: 1,
  }
}

export function roundMachines(machineCount: number, factor: number): number {
  const normalizedFactor = Math.max(1, Math.round(factor || 1))
  return Math.max(normalizedFactor, Math.ceil(machineCount / normalizedFactor) * normalizedFactor)
}

export function clockPercent(fractional: number, rounded: number): number {
  if (rounded <= 0) return 100
  return Math.min(100, Math.round((fractional / rounded) * 1000) / 10)
}

export function createPlannerNode(
  recipeId: string,
  outputRate: number,
  settings: ProjectSettings,
  position: { x: number; y: number },
  id = `${recipeId}-${Date.now()}`,
): PlannerNodeData {
  const recipe = recipes[recipeId]
  const machineCount = outputRate / recipe.outputRate
  const roundedMachineCount = recipe.raw
    ? Math.ceil(machineCount)
    : roundMachines(machineCount, settings.machineRoundingFactor)

  return {
    id,
    kind: recipe.raw ? 'resource' : 'recipe',
    recipeId,
    label: recipe.name,
    outputItem: recipe.outputItem,
    outputRate,
    machine: recipe.machine,
    machineCount,
    roundedMachineCount,
    clockPercent: clockPercent(machineCount, roundedMachineCount),
    position,
  }
}

export function createDefaultProjectState(): ProjectState {
  const settings = defaultSettings()
  const project: ProjectState = {
    plannerNodes: [],
    plannerEdges: [],
    blueprints: [],
    floorPlan: { floors: [{ id: 'floor-1', name: 'Floor 1', placements: [], marginCm: foundationCm }] },
    settings,
    validation: { issues: [], checkedAt: new Date().toISOString() },
  }
  return validateAndPack(project)
}

export function recalculateProject(project: ProjectState): ProjectState {
  const nodes = project.plannerNodes.map((node) => {
    if (node.kind === 'resource') {
      const roundedMachineCount = Math.ceil(node.machineCount)
      return {
        ...node,
        roundedMachineCount,
        clockPercent: clockPercent(node.machineCount, roundedMachineCount),
      }
    }
    const roundedMachineCount = roundMachines(
      node.machineCount,
      project.settings.machineRoundingFactor,
    )
    return {
      ...node,
      roundedMachineCount,
      clockPercent: clockPercent(node.machineCount, roundedMachineCount),
    }
  })

  return validateAndPack({ ...project, plannerNodes: nodes })
}

export function loadProjectState(storage: Storage = localStorage): ProjectState {
  const raw = storage.getItem(projectStateKey)
  if (!raw) return createDefaultProjectState()

  try {
    const parsed = JSON.parse(raw) as ProjectState
    return validateAndPack({
      ...createDefaultProjectState(),
      ...parsed,
      settings: { ...defaultSettings(), ...parsed.settings },
      validation: parsed.validation ?? { issues: [], checkedAt: new Date().toISOString() },
    })
  } catch {
    return createDefaultProjectState()
  }
}

export function saveProjectState(project: ProjectState, storage: Storage = localStorage): void {
  storage.setItem(projectStateKey, JSON.stringify(project))
}

export function clearProjectState(storage: Storage = localStorage): void {
  storage.removeItem(projectStateKey)
}

export function loadLayoutState(storage: Storage = localStorage): unknown | undefined {
  const raw = storage.getItem(layoutStateKey)
  if (!raw) return undefined

  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

export function saveLayoutState(layout: unknown, storage: Storage = localStorage): void {
  storage.setItem(layoutStateKey, JSON.stringify(layout))
}

export function clearLayoutState(storage: Storage = localStorage): void {
  storage.removeItem(layoutStateKey)
}

export function expandInputs(project: ProjectState, nodeId: string, toRaw: boolean): ProjectState {
  const next: ProjectState = {
    ...project,
    plannerNodes: [...project.plannerNodes],
    plannerEdges: [...project.plannerEdges],
  }
  const visited = new Set<string>()

  function expand(currentId: string): void {
    if (visited.has(currentId)) return
    visited.add(currentId)

    const node = next.plannerNodes.find((candidate) => candidate.id === currentId)
    if (!node?.recipeId) return
    const recipe = recipes[node.recipeId]

    recipe.inputs.forEach((input, inputIndex) => {
      const upstreamRecipe = findDefaultRecipeForItem(input.item)
      if (!upstreamRecipe) return

      const requiredRate = input.rate * node.machineCount
      const existing = next.plannerNodes.find(
        (candidate) =>
          candidate.recipeId === upstreamRecipe.id &&
          next.plannerEdges.some(
            (edge) =>
              edge.source === candidate.id &&
              edge.target === node.id &&
              edge.item === input.item,
          ),
      )
      const upstreamNode =
        existing ??
        createPlannerNode(
          upstreamRecipe.id,
          requiredRate,
          next.settings,
          { x: node.position.x - 340, y: node.position.y + inputIndex * 170 - 80 },
          `${node.id}-${upstreamRecipe.id}`,
        )

      if (!existing) {
        next.plannerNodes.push(upstreamNode)
      }

      const edgeId = `${upstreamNode.id}->${node.id}:${input.item}`
      if (!next.plannerEdges.some((edge) => edge.id === edgeId)) {
        next.plannerEdges.push({
          id: edgeId,
          source: upstreamNode.id,
          target: node.id,
          item: input.item,
          rate: requiredRate,
        })
      }

      if (toRaw && !upstreamRecipe.raw) {
        expand(upstreamNode.id)
      }
    })
  }

  expand(nodeId)
  return recalculateProject(next)
}

function findDefaultRecipeForItem(item: string): Recipe | undefined {
  const candidates = Object.values(recipes).filter((candidate) => candidate.outputItem === item)
  return (
    candidates.find((candidate) => candidate.raw) ??
    candidates.find((candidate) => !candidate.name.startsWith('Alternate:')) ??
    candidates[0]
  )
}

export function removePlannerNode(project: ProjectState, nodeId: string): ProjectState {
  const plannerNodes = project.plannerNodes.filter((node) => node.id !== nodeId)
  const plannerEdges = project.plannerEdges.filter(
    (edge) => edge.source !== nodeId && edge.target !== nodeId,
  )
  const blueprints = project.blueprints.map((blueprint) =>
    blueprint.sourcePlannerNodeId === nodeId
      ? { ...blueprint, sourcePlannerNodeId: undefined }
      : blueprint,
  )

  return validateAndPack({
    ...project,
    plannerNodes,
    plannerEdges,
    blueprints,
    selectedPlannerNodeId:
      project.selectedPlannerNodeId === nodeId ? undefined : project.selectedPlannerNodeId,
  })
}

export function removePlannerEdges(project: ProjectState, edgeIds: string[]): ProjectState {
  const removeIds = new Set(edgeIds)
  if (removeIds.size === 0) return project

  return validateAndPack({
    ...project,
    plannerEdges: project.plannerEdges.filter((edge) => !removeIds.has(edge.id)),
  })
}

export function generateBlueprintsForNode(
  project: ProjectState,
  nodeId: string,
  mode = project.settings.generationMode,
): Blueprint[] {
  const node = project.plannerNodes.find((candidate) => candidate.id === nodeId)
  if (!node || node.kind !== 'recipe' || !node.recipeId) return []

  const recipe = recipes[node.recipeId]
  const roundedMachineCount = roundMachines(
    node.machineCount,
    project.settings.machineRoundingFactor,
  )
  const machineClock = clockPercent(node.machineCount, roundedMachineCount)
  const components = buildBlueprintComponents(
    recipe,
    roundedMachineCount,
    machineClock,
    node.outputRate,
  )
  const footprint = calculateFootprint(components)
  const baseName = `${recipe.name} - ${roundedMachineCount}x ${recipe.machine}`

  if (mode === 'partial-tiled') {
    return splitPartialTiles({
      baseName,
      components,
      footprint,
      node,
      project,
    })
  }

  const now = new Date().toISOString()
  return [
    {
      id: `bp-${node.id}`,
      name: baseName,
      sourcePlannerNodeId: node.id,
      components,
      createdAt: now,
      updatedAt: now,
      metadata: {
        machineCount: roundedMachineCount,
        fractionalMachineCount: node.machineCount,
        roundingFactor: project.settings.machineRoundingFactor,
        clockPercent: machineClock,
        inputDirection: project.settings.inputDirection,
        outputDirection: project.settings.outputDirection,
        exportSize: project.settings.exportSize,
        footprintWidthCm: footprint.widthCm,
        footprintHeightCm: footprint.heightCm,
      },
    },
  ]
}

export function applyGeneratedBlueprints(project: ProjectState, nodeId?: string): ProjectState {
  const targetNodes = nodeId
    ? project.plannerNodes.filter((node) => node.id === nodeId)
    : project.plannerNodes.filter((node) => node.kind === 'recipe')

  const generated = targetNodes.flatMap((node) => generateBlueprintsForNode(project, node.id))
  const replacedSourceIds = new Set(generated.map((blueprint) => blueprint.sourcePlannerNodeId))
  const kept = project.blueprints.filter(
    (blueprint) => !replacedSourceIds.has(blueprint.sourcePlannerNodeId),
  )
  const blueprints = [...kept, ...generated]
  const plannerNodes = project.plannerNodes.map((node) => {
    const linked = generated.find((blueprint) => blueprint.sourcePlannerNodeId === node.id)
    return linked ? { ...node, blueprintId: linked.id } : node
  })

  return validateAndPack({ ...project, blueprints, plannerNodes })
}

export function assignBlueprint(
  project: ProjectState,
  nodeId: string,
  blueprintId: string,
): ProjectState {
  const plannerNodes = project.plannerNodes.map((node) =>
    node.id === nodeId ? { ...node, blueprintId } : node,
  )
  const blueprints = project.blueprints.map((blueprint) =>
    blueprint.id === blueprintId ? { ...blueprint, sourcePlannerNodeId: nodeId } : blueprint,
  )
  return validateAndPack({ ...project, plannerNodes, blueprints })
}

export function createBlankBlueprint(project: ProjectState, name = 'Manual Blueprint'): ProjectState {
  const now = new Date().toISOString()
  const blueprint: Blueprint = {
    id: `bp-manual-${Date.now()}`,
    name,
    components: [],
    createdAt: now,
    updatedAt: now,
    metadata: {
      machineCount: 0,
      fractionalMachineCount: 0,
      roundingFactor: project.settings.machineRoundingFactor,
      clockPercent: 100,
      inputDirection: project.settings.inputDirection,
      outputDirection: project.settings.outputDirection,
      exportSize: project.settings.exportSize,
      footprintWidthCm: 0,
      footprintHeightCm: 0,
    },
  }
  return validateAndPack({
    ...project,
    blueprints: [...project.blueprints, blueprint],
    selectedBlueprintId: blueprint.id,
  })
}

export function updateBlueprint(project: ProjectState, blueprint: Blueprint): ProjectState {
  const blueprints = project.blueprints.map((candidate) =>
    candidate.id === blueprint.id
      ? {
          ...blueprint,
          updatedAt: new Date().toISOString(),
          metadata: {
            ...blueprint.metadata,
            ...calculateFootprint(blueprint.components),
          },
        }
      : candidate,
  )
  return validateAndPack({ ...project, blueprints })
}

export function renameBlueprint(
  project: ProjectState,
  blueprintId: string,
  name: string,
): ProjectState {
  const blueprints = project.blueprints.map((blueprint) =>
    blueprint.id === blueprintId
      ? { ...blueprint, name: name.trim() || blueprint.name, updatedAt: new Date().toISOString() }
      : blueprint,
  )
  return validateAndPack({ ...project, blueprints })
}

export function relinkBlueprintSource(
  project: ProjectState,
  blueprintId: string,
  sourcePlannerNodeId?: string,
): ProjectState {
  const blueprints = project.blueprints.map((blueprint) =>
    blueprint.id === blueprintId ? { ...blueprint, sourcePlannerNodeId } : blueprint,
  )
  const plannerNodes = project.plannerNodes.map((node) => ({
    ...node,
    blueprintId:
      sourcePlannerNodeId === node.id
        ? blueprintId
        : node.blueprintId === blueprintId
          ? undefined
          : node.blueprintId,
  }))
  return validateAndPack({ ...project, blueprints, plannerNodes })
}

export function addComponentToBlueprint(
  project: ProjectState,
  blueprintId: string,
  component: BlueprintComponent,
): ProjectState {
  const blueprint = project.blueprints.find((candidate) => candidate.id === blueprintId)
  if (!blueprint) return project

  return updateBlueprint(project, {
    ...blueprint,
    components: [...blueprint.components, component],
  })
}

export function getPlacementPreview(
  existing: BlueprintComponent[],
  draft: BlueprintComponent,
  clippingEnabled: boolean,
): PlacementPreview {
  const collides = existing.some((component) => rectanglesOverlap(component, draft))
  if (!collides) {
    return {
      state: 'valid',
      outline: 'normal',
      canPlace: true,
      message: 'Valid placement',
    }
  }

  if (clippingEnabled) {
    return {
      state: 'discouraged',
      outline: 'yellow',
      canPlace: true,
      message: 'Clipping allowed with warning',
    }
  }

  return {
    state: 'invalid',
    outline: 'red',
    canPlace: false,
    message: 'Collision blocks placement',
  }
}

export function upgradeLogistics(
  project: ProjectState,
  blueprintId: string,
  type: 'belt' | 'pipeline',
): ProjectState {
  const blueprint = project.blueprints.find((candidate) => candidate.id === blueprintId)
  if (!blueprint) return project

  return updateBlueprint(project, {
    ...blueprint,
    components: blueprint.components.map((component) =>
      component.type === type
        ? {
            ...component,
            tier: Math.min(6, (component.tier ?? 1) + 1),
          }
        : component,
    ),
  })
}

export function addStackedLogistics(
  project: ProjectState,
  blueprintId: string,
  type: 'belt' | 'pipeline',
): ProjectState {
  const blueprint = project.blueprints.find((candidate) => candidate.id === blueprintId)
  if (!blueprint) return project

  const base: BlueprintComponent = {
    id: `${type}-stack-${Date.now()}`,
    type,
    label: type === 'belt' ? 'Stacked Belt' : 'Stacked Pipe',
    xCm: 400,
    yCm: type === 'belt' ? 2000 : 2320,
    widthCm: 1200,
    heightCm: type === 'belt' ? 160 : 180,
    rotation: 0,
    tier: 1,
    direction: 'right',
    flowRate: type === 'belt' ? 180 : 360,
    supported: true,
  }
  const stack = [0, 1, 2].map((level) => ({
    ...base,
    id: `${base.id}-${level}`,
    stackLevel: level,
    elevationCm: level * 200,
  }))

  return updateBlueprint(project, {
    ...blueprint,
    components: [...blueprint.components, ...stack],
  })
}

export function validateAndPack(project: ProjectState): ProjectState {
  const floorPlan = packFloors(project)
  const withFloors = { ...project, floorPlan }
  return { ...withFloors, validation: validateProject(withFloors) }
}

export function validateProject(project: ProjectState): ValidationReport {
  const issues: ValidationIssue[] = []

  project.blueprints.forEach((blueprint) => {
    validateBlueprint(project, blueprint).forEach((issue) => issues.push(issue))
  })

  validateFloorPlan(project).forEach((issue) => issues.push(issue))

  project.plannerNodes.forEach((node) => {
    if (node.kind === 'recipe' && !node.blueprintId) {
      issues.push({
        id: `planner-unlinked-${node.id}`,
        severity: 'warning',
        scope: 'planner',
        targetId: node.id,
        message: `${node.label} does not have an assigned blueprint.`,
      })
    }
  })

  return {
    issues,
    checkedAt: new Date().toISOString(),
  }
}

export function validateBlueprint(project: ProjectState, blueprint: Blueprint): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  blueprint.components.forEach((component) => {
    if (component.supported === false) {
      issues.push({
        id: `unsupported-${blueprint.id}-${component.id}`,
        severity: 'error',
        scope: 'export',
        targetId: blueprint.id,
        message: `${component.label} is not fixture-backed and blocks export.`,
      })
    }

    if (component.type === 'belt') {
      const capacity = beltCapacity(component.tier ?? 1)
      if ((component.flowRate ?? 0) > capacity) {
        issues.push({
          id: `belt-throughput-${blueprint.id}-${component.id}`,
          severity: 'warning',
          scope: 'blueprint',
          targetId: blueprint.id,
          message: `Directional belt tier ${component.tier ?? 1} is too small for ${component.flowRate}.`,
        })
      }
    }

    if (component.type === 'pipeline') {
      const capacity = pipeCapacity(component.tier ?? 1)
      if ((component.flowRate ?? 0) > capacity) {
        issues.push({
          id: `pipe-throughput-${blueprint.id}-${component.id}`,
          severity: 'warning',
          scope: 'blueprint',
          targetId: blueprint.id,
          message: `Pipe network tier ${component.tier ?? 1} is too small for ${component.flowRate}.`,
        })
      }
    }
  })

  const collisions = findCollisions(blueprint.components)
  collisions.forEach((collision) => {
    issues.push({
      id: `collision-${blueprint.id}-${collision.join('-')}`,
      severity: project.settings.clippingEnabled ? 'warning' : 'error',
      scope: 'blueprint',
      targetId: blueprint.id,
      message: project.settings.clippingEnabled
        ? 'Clipping is enabled, but overlapping components will export with warnings.'
        : 'Overlapping components block placement and export.',
    })
  })

  if (project.settings.exportSize !== 'none') {
    const bounds = exportBounds(project.settings.exportSize)
    if (
      blueprint.metadata.footprintWidthCm > bounds.widthCm ||
      blueprint.metadata.footprintHeightCm > bounds.heightCm
    ) {
      issues.push({
        id: `bounds-${blueprint.id}`,
        severity: 'error',
        scope: 'export',
        targetId: blueprint.id,
        message: `${blueprint.name} exceeds ${project.settings.exportSize} blueprint bounds.`,
      })
    }
  }

  return issues
}

export function packFloors(project: ProjectState): FloorPlan {
  const marginCm = project.settings.floorMarginFoundations * foundationCm
  const grouped = groupBlueprintsForFloor(project.blueprints)
  const ordered = grouped.sort((a, b) => {
    const depthA = sourceDepth(project, a.sourcePlannerNodeId)
    const depthB = sourceDepth(project, b.sourcePlannerNodeId)
    return project.settings.flowDirection === 'left-to-right' ? depthA - depthB : depthB - depthA
  })
  const floorCount = Math.max(1, Math.ceil(ordered.length / 4))
  const floors: Floor[] = Array.from({ length: floorCount }, (_, index) => ({
    id: `floor-${index + 1}`,
    name: `Floor ${index + 1}`,
    placements: [],
    marginCm,
  }))

  ordered.forEach((blueprint, index) => {
    const targetFloor = floors[index % floors.length]
    const xIndex = targetFloor.placements.length
    const widthCm = blueprint.partialTileGroup
      ? blueprint.partialTileGroup.columns * blueprint.metadata.footprintWidthCm
      : blueprint.metadata.footprintWidthCm
    const heightCm = blueprint.partialTileGroup
      ? blueprint.partialTileGroup.rows * blueprint.metadata.footprintHeightCm
      : blueprint.metadata.footprintHeightCm

    const placement: FloorPlacement = {
      id: `place-${blueprint.id}`,
      blueprintId: blueprint.id,
      label: blueprint.partialTileGroup
        ? `${blueprint.partialTileGroup.baseDisplayName} (${blueprint.partialTileGroup.columns}x${blueprint.partialTileGroup.rows})`
        : blueprint.name,
      xCm: marginCm + xIndex * (widthCm + marginCm),
      yCm: marginCm,
      widthCm,
      heightCm,
      sourcePlannerNodeId: blueprint.sourcePlannerNodeId,
      partialGroup: blueprint.partialTileGroup
        ? {
            columns: blueprint.partialTileGroup.columns,
            rows: blueprint.partialTileGroup.rows,
            baseDisplayName: blueprint.partialTileGroup.baseDisplayName,
          }
        : undefined,
    }
    targetFloor.placements.push(placement)
  })

  return { floors }
}

export function validateFloorPlan(project: ProjectState): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const placements = project.floorPlan.floors.flatMap((floor) => floor.placements)
  placements.forEach((placement) => {
    const connected = project.plannerEdges.some(
      (edge) =>
        edge.source === placement.sourcePlannerNodeId ||
        edge.target === placement.sourcePlannerNodeId,
    )
    if (placement.sourcePlannerNodeId && !connected && project.plannerEdges.length > 0) {
      issues.push({
        id: `floor-adjacency-${placement.id}`,
        severity: 'warning',
        scope: 'floor',
        targetId: placement.blueprintId,
        message: `${placement.label} is packed away from adjacent production graph nodes.`,
      })
    }
  })

  project.plannerEdges.forEach((edge) => {
    const source = placements.find((placement) => placement.sourcePlannerNodeId === edge.source)
    const target = placements.find((placement) => placement.sourcePlannerNodeId === edge.target)
    if (!source || !target) return
    const valid =
      project.settings.flowDirection === 'left-to-right'
        ? source.xCm <= target.xCm
        : source.xCm >= target.xCm
    if (!valid) {
      issues.push({
        id: `floor-order-${edge.id}`,
        severity: 'warning',
        scope: 'floor',
        targetId: target.blueprintId,
        message: `${edge.item} flow order conflicts with ${project.settings.flowDirection}.`,
      })
    }
  })

  return issues
}

export function plannerStats(project: ProjectState): PlannerStats {
  const inputs: Record<string, number> = {}
  const outputs: Record<string, number> = {}
  const rawDemand: Record<string, number> = {}

  project.plannerNodes.forEach((node) => {
    outputs[node.outputItem] = (outputs[node.outputItem] ?? 0) + node.outputRate
    if (node.recipeId) {
      recipes[node.recipeId].inputs.forEach((input) => {
        inputs[input.item] = (inputs[input.item] ?? 0) + input.rate * node.machineCount
      })
    }
    if (node.kind === 'resource') {
      rawDemand[node.outputItem] = (rawDemand[node.outputItem] ?? 0) + node.outputRate
    }
  })

  project.plannerEdges.forEach((edge) => {
    if (project.plannerNodes.find((node) => node.id === edge.source)?.kind === 'resource') {
      rawDemand[edge.item] = (rawDemand[edge.item] ?? 0) + edge.rate
    }
  })

  const fractionalMachines = project.plannerNodes.reduce(
    (total, node) => total + node.machineCount,
    0,
  )
  const roundedMachines = project.plannerNodes.reduce(
    (total, node) => total + node.roundedMachineCount,
    0,
  )
  const powerMw = project.plannerNodes.reduce((total, node) => {
    const recipe = node.recipeId ? recipes[node.recipeId] : undefined
    return total + (recipe?.powerMw ?? 0) * node.roundedMachineCount * (node.clockPercent / 100)
  }, 0)

  return {
    powerMw: Math.round(powerMw * 10) / 10,
    inputs,
    outputs,
    rawDemand,
    fractionalMachines: Math.round(fractionalMachines * 10) / 10,
    roundedMachines,
    roundingImpact: Math.round((roundedMachines - fractionalMachines) * 10) / 10,
  }
}

export function blueprintStats(project: ProjectState, blueprint: Blueprint): BlueprintStats {
  const objectCounts = componentPalette.reduce(
    (counts, item) => ({ ...counts, [item.type]: 0 }),
    {} as Record<ComponentType, number>,
  )
  blueprint.components.forEach((component) => {
    objectCounts[component.type] += 1
  })
  const warnings = validateBlueprint(project, blueprint).filter(
    (issue) => issue.severity === 'warning',
  )
  const stacks = new Map<string, number>()
  blueprint.components
    .filter((component) => component.type === 'belt' || component.type === 'pipeline')
    .forEach((component) => {
      const key = `${component.type}-${component.xCm}-${component.yCm}-${component.widthCm}-${component.heightCm}`
      stacks.set(key, (stacks.get(key) ?? 0) + 1)
    })

  return {
    objectCounts,
    machineClocks: blueprint.components
      .filter((component) => component.type === 'machine')
      .map((component) => component.clockPercent ?? 100),
    stackedLogistics: [...stacks.values()].filter((count) => count > 1).length,
    throughputWarnings: warnings.filter((issue) => issue.message.includes('too small')).length,
    footprint: `${Math.ceil(blueprint.metadata.footprintWidthCm / foundationCm)}x${Math.ceil(
      blueprint.metadata.footprintHeightCm / foundationCm,
    )} foundations`,
    exportEligible: validateBlueprint(project, blueprint).every((issue) => issue.severity !== 'error'),
  }
}

export function floorStats(project: ProjectState): FloorStats {
  const floorIssues = validateFloorPlan(project)
  return {
    floorCount: project.floorPlan.floors.length,
    squareAreaByFloor: Object.fromEntries(
      project.floorPlan.floors.map((floor) => [
        floor.name,
        floor.placements.reduce(
          (area, placement) => area + placement.widthCm * placement.heightCm,
          0,
        ) /
          (foundationCm * foundationCm),
      ]),
    ),
    tileGroups: project.blueprints.filter((blueprint) => blueprint.partialTileGroup).length,
    marginsCm: project.floorPlan.floors.map((floor) => floor.marginCm),
    adjacencyWarnings: floorIssues.filter((issue) => issue.id.startsWith('floor-adjacency')).length,
    orderWarnings: floorIssues.filter((issue) => issue.id.startsWith('floor-order')).length,
  }
}

export function createExportPair(blueprint: Blueprint): BlueprintExportPair {
  const config = {
    blueprintName: blueprint.name,
    exportSize: blueprint.metadata.exportSize === 'none' ? '6x6/Mk.3 metadata' : blueprint.metadata.exportSize,
    parserHeaderVersion: BlueprintHeaderVersion.LatestVersion,
    sourcePlannerNodeId: blueprint.sourcePlannerNodeId,
  }
  const payload = {
    format: 'satisfactory-blueprint-fixture-prototype',
    parser: '@etothepii/satisfactory-file-parser',
    headerVersion: BlueprintHeaderVersion.LatestVersion,
    objects: blueprint.components.filter((component) => component.supported !== false),
    metadata: blueprint.metadata,
  }
  const encoder = new TextEncoder()

  return {
    sbpName: `${safeFileName(blueprint.name)}.sbp`,
    sbp: encoder.encode(JSON.stringify(payload, null, 2)),
    sbpcfgName: `${safeFileName(blueprint.name)}.sbpcfg`,
    sbpcfg: JSON.stringify(config, null, 2),
  }
}

export async function createBlueprintZip(blueprints: Blueprint[]): Promise<Blob> {
  const zip = new JSZip()
  blueprints.forEach((blueprint) => {
    const pair = createExportPair(blueprint)
    zip.file(pair.sbpName, pair.sbp)
    zip.file(pair.sbpcfgName, pair.sbpcfg)
  })
  return zip.generateAsync({ type: 'blob' })
}

function buildBlueprintComponents(
  recipe: Recipe,
  machineCount: number,
  machineClock: number,
  outputRate: number,
): BlueprintComponent[] {
  const components: BlueprintComponent[] = []
  const columns = Math.ceil(machineCount / 2)
  const outputBusY = 1400

  for (let index = 0; index < machineCount; index += 1) {
    const column = Math.floor(index / 2)
    const row = index % 2
    const yCm = row === 0 ? 0 : 2000
    components.push({
      id: `machine-${index + 1}`,
      type: 'machine',
      label: `${recipe.machine} ${index + 1}`,
      xCm: column * 1000,
      yCm,
      widthCm: recipe.size.widthCm,
      heightCm: recipe.size.heightCm,
      rotation: row === 0 ? 90 : 270,
      clockPercent: machineClock,
      supported: true,
      ports: ['input', 'output'],
    })
    components.push({
      id: `belt-output-${index + 1}`,
      type: 'belt',
      label: `${recipe.outputItem} out`,
      xCm: column * 1000 + 150,
      yCm: row === 0 ? 820 : 1760,
      widthCm: 700,
      heightCm: 120,
      rotation: 0,
      tier: 1,
      direction: row === 0 ? 'down' : 'up',
      flowRate: outputRate / machineCount,
      stackLevel: 0,
      supported: true,
      ports: ['out'],
    })
  }

  Array.from({ length: columns }).forEach((_, column) => {
    components.push({
      id: `merger-${column + 1}`,
      type: 'merger',
      label: 'Merger',
      xCm: column * 1000 + 250,
      yCm: outputBusY,
      widthCm: 280,
      heightCm: 280,
      rotation: 0,
      supported: true,
      ports: ['in', 'out'],
    })
    components.push({
      id: `bus-${column + 1}`,
      type: 'belt',
      label: `${recipe.outputItem} bus`,
      xCm: column * 1000 + 560,
      yCm: outputBusY + 80,
      widthCm: 420,
      heightCm: 120,
      rotation: 0,
      tier: 1,
      direction: 'right',
      flowRate: outputRate,
      stackLevel: 0,
      supported: true,
      ports: ['in', 'out'],
    })
    components.push({
      id: `pole-${column + 1}`,
      type: 'power-pole',
      label: 'Pole',
      xCm: column * 1000 + 600,
      yCm: outputBusY - 360,
      widthCm: 220,
      heightCm: 220,
      rotation: 0,
      supported: true,
      ports: ['power'],
    })
  })

  return components
}

function splitPartialTiles(args: {
  baseName: string
  components: BlueprintComponent[]
  footprint: { widthCm: number; heightCm: number }
  node: PlannerNodeData
  project: ProjectState
}): Blueprint[] {
  const tileWidthCm = args.project.settings.partialTileWidthFoundations * foundationCm
  const tileHeightCm = args.project.settings.partialTileHeightFoundations * foundationCm
  const columns = Math.max(1, Math.ceil(args.footprint.widthCm / tileWidthCm))
  const rows = Math.max(1, Math.ceil(args.footprint.heightCm / tileHeightCm))
  const groupId = `tile-group-${args.node.id}`
  const now = new Date().toISOString()
  const blueprints: Blueprint[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const tileName = `${args.baseName} (${row + 1},${column + 1})`
      const partialTileGroup: PartialTileGroup = {
        groupId,
        baseDisplayName: args.baseName,
        tileWidthFoundations: args.project.settings.partialTileWidthFoundations,
        tileHeightFoundations: args.project.settings.partialTileHeightFoundations,
        columns,
        rows,
        tileName,
        row,
        column,
        sourcePlannerNodeId: args.node.id,
      }
      const tileComponents = args.components
        .filter(
          (component) =>
            component.xCm >= column * tileWidthCm &&
            component.xCm < (column + 1) * tileWidthCm &&
            component.yCm >= row * tileHeightCm &&
            component.yCm < (row + 1) * tileHeightCm,
        )
        .map((component) => ({
          ...component,
          id: `${component.id}-tile-${row}-${column}`,
          xCm: component.xCm - column * tileWidthCm,
          yCm: component.yCm - row * tileHeightCm,
        }))

      blueprints.push({
        id: `bp-${args.node.id}-tile-${row}-${column}`,
        name: tileName,
        sourcePlannerNodeId: args.node.id,
        components: tileComponents,
        createdAt: now,
        updatedAt: now,
        metadata: {
          machineCount: args.node.roundedMachineCount,
          fractionalMachineCount: args.node.machineCount,
          roundingFactor: args.project.settings.machineRoundingFactor,
          clockPercent: clockPercent(args.node.machineCount, args.node.roundedMachineCount),
          inputDirection: args.project.settings.inputDirection,
          outputDirection: args.project.settings.outputDirection,
          exportSize: args.project.settings.exportSize,
          footprintWidthCm: tileWidthCm,
          footprintHeightCm: tileHeightCm,
        },
        partialTileGroup,
      })
    }
  }

  return blueprints
}

function groupBlueprintsForFloor(blueprints: Blueprint[]): Blueprint[] {
  const groups = new Map<string, Blueprint>()
  blueprints.forEach((blueprint) => {
    if (!blueprint.partialTileGroup) {
      groups.set(blueprint.id, blueprint)
      return
    }

    const existing = groups.get(blueprint.partialTileGroup.groupId)
    if (existing) return
    groups.set(blueprint.partialTileGroup.groupId, blueprint)
  })
  return [...groups.values()]
}

function sourceDepth(project: ProjectState, sourcePlannerNodeId?: string): number {
  if (!sourcePlannerNodeId) return 0
  const upstream = project.plannerEdges.filter((edge) => edge.target === sourcePlannerNodeId)
  if (upstream.length === 0) return 0
  return 1 + Math.max(...upstream.map((edge) => sourceDepth(project, edge.source)))
}

function calculateFootprint(components: BlueprintComponent[]): {
  footprintWidthCm: number
  footprintHeightCm: number
  widthCm: number
  heightCm: number
} {
  const widthCm = components.reduce(
    (max, component) => Math.max(max, component.xCm + component.widthCm),
    0,
  )
  const heightCm = components.reduce(
    (max, component) => Math.max(max, component.yCm + component.heightCm),
    0,
  )
  return {
    footprintWidthCm: widthCm,
    footprintHeightCm: heightCm,
    widthCm,
    heightCm,
  }
}

function rectanglesOverlap(a: BlueprintComponent, b: BlueprintComponent): boolean {
  if (a.id === b.id) return false
  return (
    a.xCm < b.xCm + b.widthCm &&
    a.xCm + a.widthCm > b.xCm &&
    a.yCm < b.yCm + b.heightCm &&
    a.yCm + a.heightCm > b.yCm
  )
}

function findCollisions(components: BlueprintComponent[]): [string, string][] {
  const collisions: [string, string][] = []
  for (let i = 0; i < components.length; i += 1) {
    for (let j = i + 1; j < components.length; j += 1) {
      if (rectanglesOverlap(components[i], components[j])) {
        collisions.push([components[i].id, components[j].id])
      }
    }
  }
  return collisions
}

function beltCapacity(tier: number): number {
  return [0, 60, 120, 270, 480, 780, 1200][tier] ?? 60
}

function pipeCapacity(tier: number): number {
  return tier >= 2 ? 600 : 300
}

function exportBounds(size: ExportSize): { widthCm: number; heightCm: number } {
  if (size === 'none') return { widthCm: Number.POSITIVE_INFINITY, heightCm: Number.POSITIVE_INFINITY }
  const foundations = Number(size.slice(0, 1))
  return { widthCm: foundations * foundationCm, heightCm: foundations * foundationCm }
}

function safeFileName(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '') || 'blueprint'
}
