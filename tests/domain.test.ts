import { describe, expect, it } from 'vitest'
import {
  applyGeneratedBlueprints,
  clearLayoutState,
  clearProjectState,
  createPlannerNode,
  createDefaultProjectState,
  expandInputs,
  generateBlueprintsForNode,
  getPlacementPreview,
  layoutStateKey,
  projectStateKey,
  removePlannerEdges,
  saveLayoutState,
  saveProjectState,
  validateAndPack,
  validateProject,
} from '../src/domain'
import { panelDefinitions, type BlueprintComponent } from '../src/types'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => data.delete(key),
    setItem: (key, value) => data.set(key, value),
  }
}

function projectWithIronPlate() {
  const project = createDefaultProjectState()
  const node = createPlannerNode(
    'iron-plate',
    114,
    project.settings,
    { x: 420, y: 180 },
    'node-iron-plate',
  )
  return validateAndPack({
    ...project,
    plannerNodes: [node],
    selectedPlannerNodeId: node.id,
  })
}

describe('factory planner domain', () => {
  it('keeps layout and project storage independent', () => {
    const storage = memoryStorage()
    saveProjectState(createDefaultProjectState(), storage)
    saveLayoutState({ panels: ['planner'] }, storage)

    clearProjectState(storage)
    expect(storage.getItem(projectStateKey)).toBeNull()
    expect(storage.getItem(layoutStateKey)).not.toBeNull()

    clearLayoutState(storage)
    expect(storage.getItem(layoutStateKey)).toBeNull()
  })

  it('starts with required Dockview panels and no editor or statistics panel', () => {
    const titles = panelDefinitions.map((panel) => panel.title)
    expect(titles).toEqual([
      'Production planner',
      'Blueprint List',
      'Recipe Library',
      'Inspector',
    ])
    expect(titles).not.toContain('Floor Plan')
    expect(titles).not.toContain('Validation')
    expect(titles).not.toContain('Export')
    expect(titles).not.toContain('Settings')
    expect(titles).not.toContain('Blueprint Editor')
    expect(titles).not.toContain('Statistics')
  })

  it('rounds 5.7 machines to 6 with 95 percent clocks', () => {
    const project = projectWithIronPlate()
    const node = project.plannerNodes[0]
    expect(node.machineCount).toBe(5.7)
    expect(node.roundedMachineCount).toBe(6)
    expect(node.clockPercent).toBe(95)

    const generated = generateBlueprintsForNode(project, node.id)
    const machines = generated[0].components.filter((component) => component.type === 'machine')
    expect(machines).toHaveLength(6)
    expect(machines.every((machine) => machine.clockPercent === 95)).toBe(true)
  })

  it('returns red, yellow, and normal placement previews', () => {
    const existing: BlueprintComponent[] = [
      {
        id: 'machine-1',
        type: 'machine',
        label: 'Constructor',
        xCm: 0,
        yCm: 0,
        widthCm: 800,
        heightCm: 800,
        rotation: 0,
      },
    ]
    const colliding: BlueprintComponent = { ...existing[0], id: 'machine-2' }
    const clear: BlueprintComponent = { ...existing[0], id: 'machine-3', xCm: 1200 }

    expect(getPlacementPreview(existing, colliding, false)).toMatchObject({
      outline: 'red',
      canPlace: false,
    })
    expect(getPlacementPreview(existing, colliding, true)).toMatchObject({
      outline: 'yellow',
      canPlace: true,
    })
    expect(getPlacementPreview(existing, clear, false)).toMatchObject({
      outline: 'normal',
      canPlace: true,
    })
  })

  it('creates partial tiled metadata and floor tile groups', () => {
    const base = projectWithIronPlate()
    const project = {
      ...base,
      settings: {
        ...base.settings,
        generationMode: 'partial-tiled' as const,
        partialTileWidthFoundations: 1,
        partialTileHeightFoundations: 1,
      },
    }
    const generated = generateBlueprintsForNode(project, project.plannerNodes[0].id, 'partial-tiled')

    expect(generated.length).toBeGreaterThan(1)
    expect(generated[0].partialTileGroup).toMatchObject({
      baseDisplayName: expect.stringContaining('Iron Plate'),
      tileWidthFoundations: 1,
      tileHeightFoundations: 1,
      row: 0,
      column: 0,
      sourcePlannerNodeId: project.plannerNodes[0].id,
    })

    const packed = applyGeneratedBlueprints(project)
    expect(packed.floorPlan.floors[0].placements[0].partialGroup).toMatchObject({
      baseDisplayName: expect.stringContaining('Iron Plate'),
    })
  })

  it('orders upstream floor placements before consumers for left-to-right flow', () => {
    const expanded = expandInputs(projectWithIronPlate(), 'node-iron-plate', true)
    const packed = applyGeneratedBlueprints(expanded)
    const placements = packed.floorPlan.floors.flatMap((floor) => floor.placements)
    const ingot = placements.find((placement) => placement.label.includes('Iron Ingot'))
    const plate = placements.find((placement) => placement.label.includes('Iron Plate'))

    expect(ingot).toBeDefined()
    expect(plate).toBeDefined()
    expect(ingot?.xCm).toBeLessThanOrEqual(plate?.xCm ?? Number.POSITIVE_INFINITY)
  })

  it('removes planner connections without removing nodes', () => {
    const expanded = expandInputs(projectWithIronPlate(), 'node-iron-plate', false)
    const edgeId = expanded.plannerEdges[0]?.id

    expect(edgeId).toBeDefined()
    const updated = removePlannerEdges(expanded, [edgeId ?? ''])

    expect(updated.plannerEdges.some((edge) => edge.id === edgeId)).toBe(false)
    expect(updated.plannerNodes).toHaveLength(expanded.plannerNodes.length)
  })

  it('warns when logistic throughput exceeds tier capacity', () => {
    const generated = applyGeneratedBlueprints(projectWithIronPlate())
    const report = validateProject(generated)
    expect(report.issues.some((issue) => issue.message.includes('Directional belt tier'))).toBe(true)
  })
})
