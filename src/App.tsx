import '@xyflow/react/dist/style.css'
import 'dockview-react/dist/styles/dockview.css'
import { DockviewReact, themeLight } from 'dockview-react'
import type {
  DockviewApi,
  DockviewReadyEvent,
  GetTabContextMenuItemsParams,
  IDockviewPanelProps,
  SerializedDockview,
} from 'dockview-react'
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type EdgeChange,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
  applyNodeChanges,
  getBezierPath,
} from '@xyflow/react'
import {
  ArrowRight,
  BarChart3,
  Box,
  Download,
  Layers,
  ListChecks,
  MousePointer2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import './App.css'
import { itemIcons, machineIcons } from './gameData'
import {
  addComponentToBlueprint,
  addStackedLogistics,
  applyGeneratedBlueprints,
  assignBlueprint,
  blueprintStats,
  clearLayoutState,
  clearProjectState,
  componentPalette,
  createBlankBlueprint,
  createBlueprintZip,
  createDefaultProjectState,
  createExportPair,
  createPlannerNode,
  expandInputs,
  floorStats,
  foundationCm,
  getPlacementPreview,
  loadLayoutState,
  loadProjectState,
  packFloors,
  plannerStats,
  recalculateProject,
  relinkBlueprintSource,
  renameBlueprint,
  removePlannerEdges,
  removePlannerNode,
  recipes,
  saveLayoutState,
  saveProjectState,
  upgradeLogistics,
  validateAndPack,
  validateProject,
} from './domain'
import {
  optionalPanelDefinitions,
  type BlueprintComponent,
  type ComponentType,
  type ExportSize,
  type Floor,
  type GenerationMode,
  type PlannerEdgeData,
  type PlannerNodeData,
  type ProjectSettings,
  type ProjectState,
  type StatisticWindow,
} from './types'

interface AppController {
  project: ProjectState
  updateProject: (updater: (project: ProjectState) => ProjectState) => void
  openBlueprintEditor: (blueprintId: string) => void
  openStatistics: (panelId: string, title: string) => void
  openPanelMenu: (event: ReactMouseEvent, panelId: string, title: string) => void
  resetLayout: () => void
  clearProject: () => void
}

const AppContext = createContext<AppController | null>(null)

function App() {
  const [project, setProject] = useState<ProjectState>(() => loadProjectState())
  const [panelMenu, setPanelMenu] = useState<{
    x: number
    y: number
    panelId: string
    title: string
  }>()
  const [statWindows, setStatWindows] = useState<StatisticWindow[]>([])
  const dockApiRef = useRef<DockviewApi | null>(null)
  const nextZIndex = useRef(20)
  const dockComponents = useMemo(
    () => ({
      planner: PlannerPanel,
      blueprintList: BlueprintListPanel,
      floorPlan: FloorPlanPanel,
      recipeLibrary: RecipeLibraryPanel,
      inspector: InspectorPanel,
      validation: ValidationPanel,
      export: ExportPanel,
      settings: SettingsPanel,
      blueprintEditor: BlueprintEditorPanel,
    }),
    [],
  )

  useEffect(() => {
    saveProjectState(project)
  }, [project])

  const updateProject = useCallback((updater: (current: ProjectState) => ProjectState) => {
    setProject((current) => updater(current))
  }, [])

  const addDefaultPanels = useCallback((api: DockviewApi) => {
    const sideWidth = Math.max(300, Math.round(window.innerWidth * 0.3))
    api.clear()
    api.addPanel({
      id: 'planner',
      title: 'Production planner',
      component: 'planner',
      initialWidth: Math.max(700, Math.round(window.innerWidth * 0.7)),
    })
    api.addPanel({
      id: 'blueprint-list',
      title: 'Blueprint List',
      component: 'blueprintList',
      position: { referencePanel: 'planner', direction: 'right' },
      initialWidth: sideWidth,
    })
    api.addPanel({
      id: 'recipe-library',
      title: 'Recipe Library',
      component: 'recipeLibrary',
      position: { referencePanel: 'blueprint-list', direction: 'within' },
      inactive: true,
    })
    api.addPanel({
      id: 'inspector',
      title: 'Inspector',
      component: 'inspector',
      position: { referencePanel: 'blueprint-list', direction: 'within' },
      inactive: true,
    })
  }, [])

  const openOptionalPanel = useCallback((panelId: string) => {
    const api = dockApiRef.current
    const panel = optionalPanelDefinitions.find((candidate) => candidate.id === panelId)
    if (!api || !panel) return

    const existing = api.getPanel(panel.id)
    if (existing) {
      existing.api.setActive()
      return
    }

    api.addPanel({
      id: panel.id,
      title: panel.title,
      component: panel.component,
      position:
        panel.id === 'floor-plan' || panel.id === 'validation' || panel.id === 'export'
          ? { referencePanel: 'planner', direction: 'within' }
          : api.getPanel('blueprint-list')
            ? { referencePanel: 'blueprint-list', direction: 'within' }
            : { referencePanel: 'planner', direction: 'right' },
      initialWidth: Math.max(300, Math.round(window.innerWidth * 0.3)),
    })
  }, [])

  const onDockReady = useCallback(
    (event: DockviewReadyEvent) => {
      dockApiRef.current = event.api
      const persistedLayout = loadLayoutState() as SerializedDockview | undefined
      if (persistedLayout) {
        try {
          event.api.fromJSON(persistedLayout, { reuseExistingPanels: false })
        } catch {
          addDefaultPanels(event.api)
        }
      } else {
        addDefaultPanels(event.api)
      }
      event.api.onDidLayoutChange(() => {
        saveLayoutState(event.api.toJSON())
      })
    },
    [addDefaultPanels],
  )

  const openBlueprintEditor = useCallback((blueprintId: string) => {
    setProject((current) => ({ ...current, selectedBlueprintId: blueprintId }))
    const api = dockApiRef.current
    if (!api) return

    const blueprint = project.blueprints.find((candidate) => candidate.id === blueprintId)
    const panelId = `blueprint-editor-${blueprintId}`
    const existing = api.getPanel(panelId)
    if (existing) {
      existing.api.setActive()
      return
    }

    api.addPanel({
      id: panelId,
      title: blueprint ? `Blueprint Editor - ${blueprint.name}` : 'Blueprint Editor',
      component: 'blueprintEditor',
      params: { blueprintId },
      position: { referencePanel: 'blueprint-list', direction: 'right' },
    })
  }, [project.blueprints])

  const openStatistics = useCallback(
    (panelId: string, title: string) => {
      const content = renderStatistics(panelId, title, project)
      setStatWindows((current) => {
        const existing = current.find((window) => window.sourcePanelId === panelId)
        const zIndex = nextZIndex.current
        nextZIndex.current += 1
        if (existing) {
          return current.map((window) =>
            window.sourcePanelId === panelId
              ? { ...window, zIndex, content, title: `${title} - Statistics` }
              : window,
          )
        }
        return [
          ...current,
          {
            sourcePanelId: panelId,
            title: `${title} - Statistics`,
            zIndex,
            x: 96 + current.length * 28,
            y: 88 + current.length * 28,
            width: 420,
            height: 340,
            content,
          },
        ]
      })
    },
    [project],
  )

  const openPanelMenu = useCallback(
    (event: ReactMouseEvent, panelId: string, title: string) => {
      event.preventDefault()
      setPanelMenu({ x: event.clientX, y: event.clientY, panelId, title })
    },
    [],
  )

  const resetLayout = useCallback(() => {
    clearLayoutState()
    const api = dockApiRef.current
    if (api) {
      addDefaultPanels(api)
      saveLayoutState(api.toJSON())
    }
  }, [addDefaultPanels])

  const clearProject = useCallback(() => {
    if (!window.confirm('Clear current project? Layout panels will remain unchanged.')) return
    clearProjectState()
    setProject(createDefaultProjectState())
  }, [])

  const controller = useMemo<AppController>(
    () => ({
      project,
      updateProject,
      openBlueprintEditor,
      openStatistics,
      openPanelMenu,
      resetLayout,
      clearProject,
    }),
    [
      clearProject,
      openBlueprintEditor,
      openPanelMenu,
      openStatistics,
      project,
      resetLayout,
      updateProject,
    ],
  )

  const getTabContextMenuItems = useCallback(
    (params: GetTabContextMenuItemsParams) => [
      {
        label: 'Show Statistics',
        action: () => openStatistics(params.panel.id, params.panel.title ?? params.panel.id),
      },
      'separator' as const,
      'close' as const,
    ],
    [openStatistics],
  )

  return (
    <AppContext.Provider value={controller}>
      <main className="app-shell" onClick={() => setPanelMenu(undefined)}>
        <header className="app-toolbar">
          <div>
            <h1>Factory Planner</h1>
            <p>Production graph, blueprint layout, floor packing, validation, and export.</p>
          </div>
          <div className="toolbar-actions">
            <div className="view-actions" aria-label="Open closed views">
              {optionalPanelDefinitions.map((panel) => (
                <button
                  key={panel.id}
                  type="button"
                  className="icon-button"
                  onClick={() => openOptionalPanel(panel.id)}
                  title={`Open ${panel.title}`}
                >
                  {panel.id === 'floor-plan' ? <Layers size={16} /> : null}
                  {panel.id === 'validation' ? <ListChecks size={16} /> : null}
                  {panel.id === 'export' ? <Download size={16} /> : null}
                  {panel.id === 'settings' ? <Settings size={16} /> : null}
                  <span>{panel.title}</span>
                </button>
              ))}
            </div>
            <button type="button" className="icon-button" onClick={resetLayout} title="Reset layout to default">
              <RefreshCw size={16} />
              <span>Reset layout</span>
            </button>
            <button type="button" className="danger-button" onClick={clearProject}>
              <Trash2 size={16} />
              <span>Clear current project</span>
            </button>
          </div>
        </header>

        <section className="workspace dockview-theme-light" data-testid="dockview-workspace">
          <DockviewReact
            components={dockComponents}
            onReady={onDockReady}
            getTabContextMenuItems={getTabContextMenuItems}
            theme={themeLight}
          />
        </section>

        {panelMenu ? (
          <div
            className="context-menu"
            style={{ left: panelMenu.x, top: panelMenu.y }}
            role="menu"
            data-testid="panel-context-menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                openStatistics(panelMenu.panelId, panelMenu.title)
                setPanelMenu(undefined)
              }}
            >
              <BarChart3 size={15} />
              Show Statistics
            </button>
          </div>
        ) : null}

        {statWindows.map((window) => (
          <FloatingStatsWindow
            key={window.sourcePanelId}
            statWindow={window}
            onFocus={() => {
              const zIndex = nextZIndex.current
              nextZIndex.current += 1
              setStatWindows((current) =>
                current.map((candidate) =>
                  candidate.sourcePanelId === window.sourcePanelId
                    ? { ...candidate, zIndex }
                    : candidate,
                ),
              )
            }}
            onChange={(next) => {
              setStatWindows((current) =>
                current.map((candidate) =>
                  candidate.sourcePanelId === window.sourcePanelId
                    ? { ...candidate, ...next }
                    : candidate,
                ),
              )
            }}
            onClose={() => {
              setStatWindows((current) =>
                current.filter((candidate) => candidate.sourcePanelId !== window.sourcePanelId),
              )
            }}
          />
        ))}
      </main>
    </AppContext.Provider>
  )
}

function useApp() {
  const controller = useContext(AppContext)
  if (!controller) throw new Error('AppContext is missing')
  return controller
}

function PanelSurface(props: {
  panelId: string
  title: string
  icon: ReactNode
  children: ReactNode
  actions?: ReactNode
}) {
  const { openPanelMenu } = useApp()
  return (
    <section
      className={`panel-surface ${props.actions ? 'has-floating-actions' : ''}`}
      onContextMenu={(event) => {
        if (event.defaultPrevented) return
        openPanelMenu(event, props.panelId, props.title)
      }}
      data-testid={`panel-${props.panelId}`}
      aria-label={props.title}
    >
      {props.actions ? <div className="floating-panel-actions">{props.actions}</div> : null}
      <div className="panel-body">{props.children}</div>
    </section>
  )
}

const PlannerPanel = memo(function PlannerPanel(_props: IDockviewPanelProps) {
  const { project, updateProject, openStatistics } = useApp()
  const [menu, setMenu] = useState<{ x: number; y: number; nodeId: string }>()
  const [edgeMenu, setEdgeMenu] = useState<{ x: number; y: number; edgeId: string }>()
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([])
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null)
  const nodeTypes = useMemo(() => ({ plannerNode: PlannerNodeCard }), [])
  const edgeTypes = useMemo(() => ({ plannerEdge: PlannerEdgeView }), [])

  const projectNodes = useMemo<Node[]>(
    () =>
      project.plannerNodes.map((node) => ({
        id: node.id,
        type: 'plannerNode',
        position: node.position,
        data: node as unknown as Record<string, unknown>,
      })),
    [project.plannerNodes],
  )
  const [nodes, setNodes] = useState<Node[]>(projectNodes)

  const selectEdge = useCallback(
    (edgeId: string) => {
      setMenu(undefined)
      setEdgeMenu(undefined)
      setSelectedEdgeIds([edgeId])
      updateProject((current) =>
        current.selectedPlannerNodeId ? { ...current, selectedPlannerNodeId: undefined } : current,
      )
    },
    [updateProject],
  )

  const openEdgeMenu = useCallback(
    (event: ReactMouseEvent, edgeId: string) => {
      event.preventDefault()
      event.stopPropagation()
      setMenu(undefined)
      setSelectedEdgeIds([edgeId])
      updateProject((current) =>
        current.selectedPlannerNodeId ? { ...current, selectedPlannerNodeId: undefined } : current,
      )
      setEdgeMenu({ x: event.clientX, y: event.clientY, edgeId })
    },
    [updateProject],
  )

  const edges = useMemo<Edge[]>(
    () =>
      project.plannerEdges.map((edge) => ({
        id: edge.id,
        type: 'plannerEdge',
        source: edge.source,
        target: edge.target,
        selected: selectedEdgeIds.includes(edge.id),
        data: {
          ...edge,
          onSelectEdge: selectEdge,
          onOpenEdgeMenu: openEdgeMenu,
        } as unknown as Record<string, unknown>,
      })),
    [openEdgeMenu, project.plannerEdges, selectEdge, selectedEdgeIds],
  )

  useEffect(() => {
    setNodes(projectNodes)
  }, [projectNodes])

  useEffect(() => {
    setSelectedEdgeIds((current) =>
      current.filter((edgeId) => project.plannerEdges.some((edge) => edge.id === edgeId)),
    )
    setEdgeMenu((current) =>
      current && project.plannerEdges.some((edge) => edge.id === current.edgeId) ? current : undefined,
    )
  }, [project.plannerEdges])

  const selectedNode = project.plannerNodes.find((node) => node.id === menu?.nodeId)

  const addRecipeNode = useCallback(
    (recipeId: string, position: { x: number; y: number }) => {
      updateProject((current) => {
        const recipe = recipes[recipeId]
        if (!recipe) return current
        const node = createPlannerNode(
          recipeId,
          recipe.outputRate,
          current.settings,
          position,
          `node-${recipeId}-${Date.now()}`,
        )
        return validateAndPack({
          ...current,
          plannerNodes: [...current.plannerNodes, node],
          selectedPlannerNodeId: node.id,
        })
      })
    },
    [updateProject],
  )

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Delete') return
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      setMenu(undefined)
      setEdgeMenu(undefined)

      if (selectedEdgeIds.length > 0) {
        const edgeIds = selectedEdgeIds
        setSelectedEdgeIds([])
        updateProject((current) => removePlannerEdges(current, edgeIds))
        return
      }

      const selectedId = project.selectedPlannerNodeId
      if (!selectedId) return
      updateProject((current) => removePlannerNode(current, selectedId))
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [project.selectedPlannerNodeId, selectedEdgeIds, updateProject])

  return (
    <PanelSurface
      panelId="planner"
      title="Production planner"
      icon={<Package size={16} />}
      actions={
        <>
          <button
            type="button"
            onClick={() => updateProject((current) => applyGeneratedBlueprints(current))}
          >
            <Layers size={15} />
            Generate all blueprints for plan
          </button>
          <button type="button" onClick={() => openStatistics('planner', 'Production planner')}>
            <BarChart3 size={15} />
          </button>
        </>
      }
    >
      <div
        className="planner-canvas"
        data-testid="planner-canvas"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('application/x-factory-recipe')) {
            event.preventDefault()
          }
        }}
        onDrop={(event) => {
          const recipeId = event.dataTransfer.getData('application/x-factory-recipe')
          if (!recipeId) return
          event.preventDefault()
          const fallbackRect = event.currentTarget.getBoundingClientRect()
          const position = flowInstance
            ? flowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
            : { x: event.clientX - fallbackRect.left, y: event.clientY - fallbackRect.top }
          addRecipeNode(recipeId, position)
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          nodesDraggable
          panOnDrag
          zoomOnScroll
          onInit={setFlowInstance}
          onNodesChange={(changes: NodeChange[]) => {
            setNodes((current) => applyNodeChanges(changes, current))
          }}
          onEdgesChange={(changes: EdgeChange[]) => {
            const removedEdgeIds = changes
              .filter((change): change is Extract<EdgeChange, { type: 'remove' }> => change.type === 'remove')
              .map((change) => change.id)
            const selectedChanges = changes.filter(
              (change): change is Extract<EdgeChange, { type: 'select' }> => change.type === 'select',
            )

            if (selectedChanges.length > 0) {
              setSelectedEdgeIds((current) => {
                let next = current
                selectedChanges.forEach((change) => {
                  next = change.selected
                    ? Array.from(new Set([...next, change.id]))
                    : next.filter((edgeId) => edgeId !== change.id)
                })
                return next
              })
            }

            if (removedEdgeIds.length > 0) {
              setSelectedEdgeIds((current) =>
                current.filter((edgeId) => !removedEdgeIds.includes(edgeId)),
              )
              setEdgeMenu(undefined)
              updateProject((current) => removePlannerEdges(current, removedEdgeIds))
            }
          }}
          onNodeDragStop={(_event, node) => {
            updateProject((current) => ({
              ...current,
              plannerNodes: current.plannerNodes.map((plannerNode) =>
                plannerNode.id === node.id ? { ...plannerNode, position: node.position } : plannerNode,
              ),
            }))
          }}
          onNodeClick={(_event, node) => {
            setSelectedEdgeIds([])
            setEdgeMenu(undefined)
            updateProject((current) => ({ ...current, selectedPlannerNodeId: node.id }))
          }}
          onNodeContextMenu={(event, node) => {
            event.preventDefault()
            event.stopPropagation()
            setSelectedEdgeIds([])
            setEdgeMenu(undefined)
            updateProject((current) => ({ ...current, selectedPlannerNodeId: node.id }))
            setMenu({ x: event.clientX, y: event.clientY, nodeId: node.id })
          }}
          onEdgeClick={(_event, edge) => {
            selectEdge(edge.id)
          }}
          onEdgeContextMenu={(event, edge) => {
            openEdgeMenu(event, edge.id)
          }}
          onPaneClick={() => {
            setMenu(undefined)
            setEdgeMenu(undefined)
            setSelectedEdgeIds([])
            updateProject((current) =>
              current.selectedPlannerNodeId ? { ...current, selectedPlannerNodeId: undefined } : current,
            )
          }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      {menu && selectedNode ? (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }} role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              updateProject((current) => expandInputs(current, selectedNode.id, false))
              setMenu(undefined)
            }}
          >
            Expand inputs one level
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              updateProject((current) => expandInputs(current, selectedNode.id, true))
              setMenu(undefined)
            }}
          >
            Expand to raw resources
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              updateProject((current) => applyGeneratedBlueprints(current, selectedNode.id))
              setMenu(undefined)
            }}
          >
            Generate blueprint layout
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={project.blueprints.length === 0}
            onClick={() => {
              const blueprint = project.blueprints[0]
              if (blueprint) {
                updateProject((current) => assignBlueprint(current, selectedNode.id, blueprint.id))
              }
              setMenu(undefined)
            }}
          >
            Assign existing blueprint
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger-menu-item"
            onClick={() => {
              updateProject((current) => removePlannerNode(current, selectedNode.id))
              setMenu(undefined)
            }}
          >
            Remove node
          </button>
        </div>
      ) : null}

      {edgeMenu ? (
        <div className="context-menu" style={{ left: edgeMenu.x, top: edgeMenu.y }} role="menu">
          <button
            type="button"
            role="menuitem"
            className="danger-menu-item"
            onClick={() => {
              const edgeId = edgeMenu.edgeId
              setSelectedEdgeIds((current) => current.filter((selected) => selected !== edgeId))
              setEdgeMenu(undefined)
              updateProject((current) => removePlannerEdges(current, [edgeId]))
            }}
          >
            Remove connection
          </button>
        </div>
      ) : null}
    </PanelSurface>
  )
})

const PlannerNodeCard = memo(function PlannerNodeCard(props: NodeProps) {
  const data = props.data as unknown as PlannerNodeData
  const recipe = data.recipeId ? recipes[data.recipeId] : undefined
  const inputs = recipe?.inputs ?? []
  const inputTitle = inputs.length > 0 ? inputs.map((input) => input.item).join(', ') : 'Raw resource'
  const linkedLabel = data.blueprintId ? 'Blueprint linked' : 'No blueprint linked'

  return (
    <div
      className={`planner-node ${data.kind === 'resource' ? 'raw-node' : 'recipe-node'} ${
        props.selected ? 'selected' : ''
      }`}
      title={data.label}
    >
      <div className="planner-node-grid">
        <div className="planner-node-inputs" aria-label="Inputs" title={inputTitle}>
          {inputs.length > 0 ? (
            <Handle
              type="target"
              position={Position.Left}
              className="planner-resource-handle planner-input-handle"
              title={inputTitle}
            />
          ) : null}
          {inputs.length > 0 ? (
            inputs.map((input) => (
              <div key={input.item} className="planner-node-io-row">
                <span className="planner-node-rate">{formatRate(input.rate * data.machineCount)}</span>
                <ItemIcon item={input.item} size="sm" />
              </div>
            ))
          ) : (
            <div className="planner-node-raw-chip" title="Raw resource">
              Raw
            </div>
          )}
        </div>
        <div className="planner-node-machine" title={data.machine}>
          <MachineIcon machine={data.machine} size="lg" />
          <strong
            className="planner-node-machine-count"
            title={`${data.machine}: ${formatRate(data.machineCount)} (${data.roundedMachineCount})`}
          >
            {formatRate(data.machineCount)} ({data.roundedMachineCount})
          </strong>
        </div>
        <div className="planner-node-output" title={data.outputItem}>
          <Handle
            type="source"
            position={Position.Right}
            className="planner-resource-handle planner-output-handle"
            title={data.outputItem}
          />
          <ItemIcon item={data.outputItem} size="md" />
          <strong>{formatRate(data.outputRate)}</strong>
        </div>
      </div>
      <div className="planner-node-footer">
        <span>{data.clockPercent}% clock</span>
        <span>{linkedLabel}</span>
      </div>
    </div>
  )
})

const PlannerEdgeView = memo(function PlannerEdgeView(props: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  })
  const data = props.data as unknown as PlannerEdgeData & {
    onSelectEdge?: (edgeId: string) => void
    onOpenEdgeMenu?: (event: ReactMouseEvent, edgeId: string) => void
  }

  return (
    <>
      <BaseEdge
        id={props.id}
        path={edgePath}
        className={`planner-edge-path ${props.selected ? 'selected' : ''}`}
      />
      <EdgeLabelRenderer>
        <div
          className={`planner-edge-label ${props.selected ? 'selected' : ''}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          title={`${data.item}: ${formatRate(data.rate)}`}
          onClick={(event) => {
            event.stopPropagation()
            data.onSelectEdge?.(props.id)
          }}
          onContextMenu={(event) => data.onOpenEdgeMenu?.(event, props.id)}
        >
          <ItemIcon item={data.item} size="sm" />
          <strong>{formatRate(data.rate)}</strong>
        </div>
      </EdgeLabelRenderer>
    </>
  )
})

type PlannerIconSize = 'sm' | 'md' | 'lg'

function ItemIcon({ item, size = 'md' }: { item: string; size?: PlannerIconSize }) {
  const iconUrl = itemIcons[item as keyof typeof itemIcons]

  return (
    <span
      className={`planner-icon item-icon icon-${size} ${iconUrl ? 'actual-icon' : 'fallback-icon'}`}
      title={item}
      aria-label={item}
      role="img"
    >
      {iconUrl ? <img src={iconUrl} alt="" draggable={false} /> : <span>{createIconCode(item)}</span>}
    </span>
  )
}

function MachineIcon({ machine, size = 'md' }: { machine: string; size?: PlannerIconSize }) {
  const iconUrl = machineIcons[machine as keyof typeof machineIcons]

  return (
    <span
      className={`planner-icon machine-icon icon-${size} ${iconUrl ? 'actual-icon' : 'fallback-icon'}`}
      title={machine}
      aria-label={machine}
      role="img"
    >
      {iconUrl ? <img src={iconUrl} alt="" draggable={false} /> : <span>{createIconCode(machine)}</span>}
    </span>
  )
}

const BlueprintListPanel = memo(function BlueprintListPanel(_props: IDockviewPanelProps) {
  const { project, updateProject, openBlueprintEditor, openStatistics } = useApp()
  const [query, setQuery] = useState('')
  const filtered = project.blueprints.filter((blueprint) =>
    blueprint.name.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <PanelSurface
      panelId="blueprint-list"
      title="Blueprint List"
      icon={<Box size={16} />}
      actions={
        <>
          <button
            type="button"
            onClick={() =>
              updateProject((current) => {
                const next = createBlankBlueprint(current)
                const created = next.blueprints.at(-1)
                if (created) queueMicrotask(() => openBlueprintEditor(created.id))
                return next
              })
            }
          >
            <Plus size={15} />
            Create
          </button>
          <button type="button" onClick={() => openStatistics('blueprint-list', 'Blueprint List')}>
            <BarChart3 size={15} />
          </button>
        </>
      }
    >
      <label className="search-box">
        <Search size={15} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search blueprints"
          aria-label="Search blueprints"
        />
      </label>
      <div className="blueprint-list">
        {filtered.length === 0 ? <p className="empty-state">No blueprints match the search.</p> : null}
        {filtered.map((blueprint) => (
          <article
            key={blueprint.id}
            className={`blueprint-row ${
              project.selectedBlueprintId === blueprint.id ? 'selected-row' : ''
            }`}
          >
            <div className="blueprint-row-main">
              <input
                value={blueprint.name}
                aria-label={`Rename ${blueprint.name}`}
                onChange={(event) =>
                  updateProject((current) =>
                    renameBlueprint(current, blueprint.id, event.target.value),
                  )
                }
              />
              <span>
                {blueprint.components.length} objects
                {blueprint.sourcePlannerNodeId ? ' - linked to planner' : ' - unlinked'}
              </span>
            </div>
            <select
              aria-label={`Source node for ${blueprint.name}`}
              value={blueprint.sourcePlannerNodeId ?? ''}
              onChange={(event) =>
                updateProject((current) =>
                  relinkBlueprintSource(current, blueprint.id, event.target.value || undefined),
                )
              }
            >
              <option value="">No source node</option>
              {project.plannerNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => openBlueprintEditor(blueprint.id)}
              data-testid={`open-blueprint-${blueprint.id}`}
            >
              <Pencil size={15} />
              Open
            </button>
          </article>
        ))}
      </div>
    </PanelSurface>
  )
})

const FloorPlanPanel = memo(function FloorPlanPanel(_props: IDockviewPanelProps) {
  const { project, updateProject, openStatistics } = useApp()
  const [floorId, setFloorId] = useState(project.floorPlan.floors[0]?.id ?? 'floor-1')
  const activeFloor = project.floorPlan.floors.find((floor) => floor.id === floorId) ?? project.floorPlan.floors[0]

  useEffect(() => {
    if (!project.floorPlan.floors.some((floor) => floor.id === floorId)) {
      setFloorId(project.floorPlan.floors[0]?.id ?? 'floor-1')
    }
  }, [floorId, project.floorPlan.floors])

  return (
    <PanelSurface
      panelId="floor-plan"
      title="Floor Plan"
      icon={<Layers size={16} />}
      actions={
        <>
          <button
            type="button"
            onClick={() =>
              updateProject((current) => ({ ...current, floorPlan: packFloors(current) }))
            }
          >
            <RefreshCw size={15} />
            Repack
          </button>
          <button type="button" onClick={() => openStatistics('floor-plan', 'Floor Plan')}>
            <BarChart3 size={15} />
          </button>
        </>
      }
    >
      <div className="floor-tabs" role="tablist">
        {project.floorPlan.floors.map((floor) => (
          <button
            key={floor.id}
            type="button"
            role="tab"
            aria-selected={floor.id === activeFloor.id}
            onClick={() => setFloorId(floor.id)}
          >
            {floor.name}
          </button>
        ))}
      </div>
      <FloorCanvas floor={activeFloor} />
    </PanelSurface>
  )
})

function FloorCanvas({ floor }: { floor: Floor }) {
  const scale = 0.05
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 24, y: 24 })
  const panDragRef = useRef<{ startX: number; startY: number; x: number; y: number } | undefined>(
    undefined,
  )
  const width =
    Math.max(9000, ...floor.placements.map((placement) => placement.xCm + placement.widthCm + floor.marginCm)) *
    scale
  const height =
    Math.max(5200, ...floor.placements.map((placement) => placement.yCm + placement.heightCm + floor.marginCm)) *
    scale

  useEffect(() => {
    setZoom(1)
    setPan({ x: 24, y: 24 })
  }, [floor.id])

  function onPointerMove(event: PointerEvent) {
    if (!panDragRef.current) return
    setPan({
      x: panDragRef.current.x + event.clientX - panDragRef.current.startX,
      y: panDragRef.current.y + event.clientY - panDragRef.current.startY,
    })
  }

  function onPointerUp() {
    panDragRef.current = undefined
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }

  function startPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    panDragRef.current = { startX: event.clientX, startY: event.clientY, x: pan.x, y: pan.y }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  return (
    <div
      className="floor-viewport"
      onPointerDown={startPan}
      onWheel={(event) => {
        event.preventDefault()
        setZoom((current) => Math.min(2.4, Math.max(0.35, current - event.deltaY * 0.001)))
      }}
      data-testid="floor-viewport"
    >
      <div className="floor-zoom-controls">
        <button type="button" onClick={() => setZoom((current) => Math.min(2.4, current + 0.15))}>
          +
        </button>
        <button type="button" onClick={() => setZoom((current) => Math.max(0.35, current - 0.15))}>
          -
        </button>
        <button
          type="button"
          onClick={() => {
            setZoom(1)
            setPan({ x: 24, y: 24 })
          }}
        >
          Reset
        </button>
      </div>
      <div
        className="floor-canvas"
        style={{
          width,
          height,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
        data-testid="floor-canvas"
      >
        <div className="floor-canvas-content">
          {floor.placements.map((placement) => (
            <div
              key={placement.id}
              className={`floor-placement ${placement.partialGroup ? 'partial-placement' : ''}`}
              style={{
                left: placement.xCm * scale,
                top: placement.yCm * scale,
                width: placement.widthCm * scale,
                height: placement.heightCm * scale,
              }}
            >
              <strong>{placement.label}</strong>
              <span>
                {Math.ceil(placement.widthCm / foundationCm)}x
                {Math.ceil(placement.heightCm / foundationCm)} foundations
              </span>
              {placement.partialGroup ? (
                <div
                  className="tile-grid"
                  data-testid="floor-tile-grid"
                  style={{
                    gridTemplateColumns: `repeat(${placement.partialGroup.columns}, 1fr)`,
                    gridTemplateRows: `repeat(${placement.partialGroup.rows}, 1fr)`,
                  }}
                >
                  {Array.from({
                    length: placement.partialGroup.columns * placement.partialGroup.rows,
                  }).map((_, index) => (
                    <span key={index}>{index + 1}</span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const RecipeLibraryPanel = memo(function RecipeLibraryPanel(_props: IDockviewPanelProps) {
  const { updateProject } = useApp()
  const [query, setQuery] = useState('')
  const filteredRecipes = Object.values(recipes).filter((recipe) =>
    `${recipe.name} ${recipe.machine} ${recipe.outputItem}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )

  return (
    <PanelSurface panelId="recipe-library" title="Recipe Library" icon={<Package size={16} />}>
      <label className="search-box">
        <Search size={15} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search recipes"
          aria-label="Search recipes"
        />
      </label>
      <div className="recipe-list">
        {filteredRecipes.length === 0 ? <p className="empty-state">No recipes match the search.</p> : null}
        {filteredRecipes.map((recipe) => (
          <article
            key={recipe.id}
            className="recipe-row"
            data-testid={`recipe-row-${recipe.id}`}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('application/x-factory-recipe', recipe.id)
              event.dataTransfer.effectAllowed = 'copy'
            }}
          >
            <div className="recipe-row-main">
              <ItemIcon item={recipe.outputItem} size="sm" />
              <div>
                <strong>{recipe.name}</strong>
                <span className="recipe-row-machine">
                  <MachineIcon machine={recipe.machine} size="sm" />
                  {recipe.machine}
                </span>
              </div>
            </div>
            <span className="recipe-rate">
              <ItemIcon item={recipe.outputItem} size="sm" />
              {formatRate(recipe.outputRate)}
            </span>
            <button
              type="button"
              onClick={() =>
                updateProject((current) => {
                  const node = createPlannerNode(
                    recipe.id,
                    recipe.outputRate,
                    current.settings,
                    {
                      x: 260 + current.plannerNodes.length * 40,
                      y: 320 + current.plannerNodes.length * 30,
                    },
                    `node-${recipe.id}-${Date.now()}`,
                  )
                  return validateAndPack({
                    ...current,
                    plannerNodes: [...current.plannerNodes, node],
                    selectedPlannerNodeId: node.id,
                  })
                })
              }
            >
              <Plus size={15} />
              Add
            </button>
          </article>
        ))}
      </div>
    </PanelSurface>
  )
})

const InspectorPanel = memo(function InspectorPanel(_props: IDockviewPanelProps) {
  const { project } = useApp()
  const selectedNode = project.plannerNodes.find((node) => node.id === project.selectedPlannerNodeId)
  const selectedBlueprint = project.blueprints.find(
    (blueprint) => blueprint.id === project.selectedBlueprintId,
  )

  return (
    <PanelSurface panelId="inspector" title="Inspector" icon={<MousePointer2 size={16} />}>
      <div className="inspector-stack">
        <StatBlock title="Selected Node">
          {selectedNode ? (
            <>
              <StatLine label="Name" value={selectedNode.label} />
              <StatLine label="Rate" value={formatRate(selectedNode.outputRate)} />
              <StatLine
                label="Machines"
                value={`${formatRate(selectedNode.machineCount)} (${selectedNode.roundedMachineCount})`}
              />
              <StatLine label="Clock" value={`${selectedNode.clockPercent}%`} />
            </>
          ) : (
            <p className="empty-state">No planner node selected.</p>
          )}
        </StatBlock>
        <StatBlock title="Selected Blueprint">
          {selectedBlueprint ? (
            <>
              <StatLine label="Name" value={selectedBlueprint.name} />
              <StatLine label="Objects" value={String(selectedBlueprint.components.length)} />
              <StatLine
                label="Footprint"
                value={`${Math.ceil(selectedBlueprint.metadata.footprintWidthCm / foundationCm)}x${Math.ceil(
                  selectedBlueprint.metadata.footprintHeightCm / foundationCm,
                )}`}
              />
              <StatLine
                label="Source"
                value={selectedBlueprint.sourcePlannerNodeId ?? 'Unlinked'}
              />
            </>
          ) : (
            <p className="empty-state">No blueprint selected.</p>
          )}
        </StatBlock>
      </div>
    </PanelSurface>
  )
})

const ValidationPanel = memo(function ValidationPanel(_props: IDockviewPanelProps) {
  const { project, updateProject } = useApp()
  const errors = project.validation.issues.filter((issue) => issue.severity === 'error')
  const warnings = project.validation.issues.filter((issue) => issue.severity === 'warning')

  return (
    <PanelSurface
      panelId="validation"
      title="Validation"
      icon={<ListChecks size={16} />}
      actions={
        <button
          type="button"
          onClick={() =>
            updateProject((current) => ({ ...current, validation: validateProject(current) }))
          }
        >
          <RefreshCw size={15} />
          Validate
        </button>
      }
    >
      <div className="validation-summary">
        <StatLine label="Errors" value={String(errors.length)} />
        <StatLine label="Warnings" value={String(warnings.length)} />
        <StatLine label="Checked" value={new Date(project.validation.checkedAt).toLocaleTimeString()} />
      </div>
      <div className="issue-list">
        {project.validation.issues.length === 0 ? (
          <p className="empty-state">No validation issues.</p>
        ) : null}
        {project.validation.issues.map((issue) => (
          <article key={issue.id} className={`issue ${issue.severity}`}>
            <strong>{issue.severity}</strong>
            <span>{issue.message}</span>
          </article>
        ))}
      </div>
    </PanelSurface>
  )
})

const ExportPanel = memo(function ExportPanel(_props: IDockviewPanelProps) {
  const { project } = useApp()
  const [selected, setSelected] = useState<string[]>([])
  const [status, setStatus] = useState('Ready')
  const selectedIds = selected.length === 0 ? project.blueprints.map((blueprint) => blueprint.id) : selected
  const selectedBlueprints = project.blueprints.filter((blueprint) => selectedIds.includes(blueprint.id))
  const blockingIssues = project.validation.issues.filter(
    (issue) => issue.severity === 'error' && selectedIds.includes(issue.targetId ?? ''),
  )

  async function exportSelected() {
    if (blockingIssues.length > 0) {
      setStatus('Export blocked by validation errors.')
      return
    }
    if (selectedBlueprints.length === 0) {
      setStatus('Select at least one blueprint.')
      return
    }
    if (selectedBlueprints.length === 1) {
      const pair = createExportPair(selectedBlueprints[0])
      setStatus(`Created ${pair.sbpName} and ${pair.sbpcfgName}.`)
      return
    }
    await createBlueprintZip(selectedBlueprints)
    setStatus(`Created zip with ${selectedBlueprints.length} blueprint file pairs.`)
  }

  return (
    <PanelSurface panelId="export" title="Export" icon={<Download size={16} />}>
      <div className="export-list">
        {project.blueprints.length === 0 ? (
          <p className="empty-state">Generate or create blueprints before export.</p>
        ) : null}
        {project.blueprints.map((blueprint) => (
          <label key={blueprint.id} className="check-row">
            <input
              type="checkbox"
              checked={selected.length === 0 || selected.includes(blueprint.id)}
              onChange={(event) => {
                setSelected((current) => {
                  const base =
                    current.length === 0 ? project.blueprints.map((item) => item.id) : current
                  return event.target.checked
                    ? [...new Set([...base, blueprint.id])]
                    : base.filter((id) => id !== blueprint.id)
                })
              }}
            />
            <span>{blueprint.name}</span>
          </label>
        ))}
      </div>
      <div className="export-footer">
        <button type="button" onClick={exportSelected}>
          <Download size={15} />
          Batch export selected
        </button>
        <span>{status}</span>
      </div>
    </PanelSurface>
  )
})

const SettingsPanel = memo(function SettingsPanel(_props: IDockviewPanelProps) {
  const { project, updateProject, resetLayout, clearProject } = useApp()

  function updateSettings(settings: Partial<ProjectSettings>) {
    updateProject((current) =>
      recalculateProject({
        ...current,
        settings: { ...current.settings, ...settings },
      }),
    )
  }

  return (
    <PanelSurface panelId="settings" title="Settings" icon={<Settings size={16} />}>
      <div className="settings-layout">
        <section className="settings-group">
          <h3>Planner</h3>
          <div className="settings-group-grid">
            <label>
              Machine rounding factor
              <input
                type="number"
                min={1}
                value={project.settings.machineRoundingFactor}
                onChange={(event) =>
                  updateSettings({ machineRoundingFactor: Number(event.target.value) || 1 })
                }
              />
            </label>
            <label className="settings-check-field">
              <input
                type="checkbox"
                checked={project.settings.clippingEnabled}
                onChange={(event) => updateSettings({ clippingEnabled: event.target.checked })}
              />
              <span>Clipping enabled</span>
            </label>
          </div>
        </section>

        <section className="settings-group">
          <h3>Blueprint Generation</h3>
          <div className="settings-group-grid">
            <SelectSetting
              label="Input direction"
              value={project.settings.inputDirection}
              options={['left', 'right', 'up', 'down']}
              onChange={(value) => updateSettings({ inputDirection: value })}
            />
            <SelectSetting
              label="Output direction"
              value={project.settings.outputDirection}
              options={['left', 'right', 'up', 'down']}
              onChange={(value) => updateSettings({ outputDirection: value })}
            />
            <SelectSetting
              label="Generation mode"
              value={project.settings.generationMode}
              options={['single', 'partial-tiled']}
              onChange={(value) => updateSettings({ generationMode: value as GenerationMode })}
            />
            <label>
              Partial tile width
              <input
                type="number"
                min={1}
                value={project.settings.partialTileWidthFoundations}
                onChange={(event) =>
                  updateSettings({ partialTileWidthFoundations: Number(event.target.value) || 1 })
                }
              />
            </label>
            <label>
              Partial tile height
              <input
                type="number"
                min={1}
                value={project.settings.partialTileHeightFoundations}
                onChange={(event) =>
                  updateSettings({ partialTileHeightFoundations: Number(event.target.value) || 1 })
                }
              />
            </label>
          </div>
        </section>

        <section className="settings-group">
          <h3>Floor Planning</h3>
          <div className="settings-group-grid">
            <SelectSetting
              label="Floor flow"
              value={project.settings.flowDirection}
              options={['left-to-right', 'right-to-left']}
              onChange={(value) => updateSettings({ flowDirection: value })}
            />
            <label>
              Floor margin foundations
              <input
                type="number"
                min={0}
                value={project.settings.floorMarginFoundations}
                onChange={(event) =>
                  updateSettings({ floorMarginFoundations: Number(event.target.value) || 0 })
                }
              />
            </label>
          </div>
        </section>

        <section className="settings-group">
          <h3>Export</h3>
          <div className="settings-group-grid">
            <SelectSetting
              label="Blueprint export size"
              value={project.settings.exportSize}
              options={['none', '4x4', '5x5', '6x6']}
              onChange={(value) => updateSettings({ exportSize: value as ExportSize })}
            />
          </div>
        </section>

        <section className="settings-group">
          <h3>Project</h3>
          <div className="settings-actions">
            <button type="button" onClick={resetLayout}>
              <RefreshCw size={15} />
              Reset layout to default
            </button>
            <button type="button" className="danger-button" onClick={clearProject}>
              <Trash2 size={15} />
              Clear current project
            </button>
          </div>
        </section>
      </div>
    </PanelSurface>
  )
})

const BlueprintEditorPanel = memo(function BlueprintEditorPanel(props: IDockviewPanelProps) {
  const { project, updateProject } = useApp()
  const params = props.params as { blueprintId?: string } | undefined
  const blueprint = project.blueprints.find((candidate) => candidate.id === params?.blueprintId)
  const [selectedType, setSelectedType] = useState<ComponentType>('machine')
  const [collidePreview, setCollidePreview] = useState(false)

  if (!blueprint) {
    return (
      <PanelSurface panelId="blueprint-editor-missing" title="Blueprint Editor" icon={<Wrench size={16} />}>
        <p className="empty-state">Blueprint not found.</p>
      </PanelSurface>
    )
  }

  const paletteItem = componentPalette.find((item) => item.type === selectedType) ?? componentPalette[0]
  const blueprintId = blueprint.id
  const firstComponent = blueprint.components[0]
  const draft: BlueprintComponent = {
    id: 'preview',
    type: selectedType,
    label: paletteItem.label,
    xCm: collidePreview && firstComponent ? firstComponent.xCm : 4200,
    yCm: collidePreview && firstComponent ? firstComponent.yCm : 900,
    widthCm: paletteItem.widthCm,
    heightCm: paletteItem.heightCm,
    rotation: 0,
    tier: selectedType === 'belt' || selectedType === 'pipeline' ? 1 : undefined,
    direction: selectedType === 'belt' ? 'right' : undefined,
    flowRate: selectedType === 'belt' ? 120 : selectedType === 'pipeline' ? 360 : undefined,
    supported: true,
    ports: ['in', 'out'],
  }
  const preview = getPlacementPreview(blueprint.components, draft, project.settings.clippingEnabled)

  function placeDraft() {
    if (!preview.canPlace) return
    updateProject((current) =>
      addComponentToBlueprint(current, blueprintId, {
        ...draft,
        id: `${draft.type}-${Date.now()}`,
        label: paletteItem.label,
      }),
    )
  }

  return (
    <PanelSurface
      panelId={`blueprint-editor-${blueprint.id}`}
      title="Blueprint Editor"
      icon={<Wrench size={16} />}
      actions={
        <>
          <button
            type="button"
            onClick={() => updateProject((current) => upgradeLogistics(current, blueprintId, 'belt'))}
          >
            <Zap size={15} />
            Upgrade belts
          </button>
          <button
            type="button"
            onClick={() =>
              updateProject((current) => upgradeLogistics(current, blueprintId, 'pipeline'))
            }
          >
            <Wrench size={15} />
            Upgrade pipes
          </button>
        </>
      }
    >
      <div className="editor-layout">
        <aside className="component-palette" aria-label="Component palette">
          {componentPalette.map((item) => (
            <button
              key={item.type}
              type="button"
              className={selectedType === item.type ? 'active-tool' : ''}
              onClick={() => setSelectedType(item.type)}
              title={item.label}
            >
              <ComponentGlyph type={item.type} />
              <span>{item.label}</span>
            </button>
          ))}
          <button type="button" onClick={() => setCollidePreview((value) => !value)}>
            <MousePointer2 size={15} />
            Collision preview
          </button>
          <button type="button" onClick={placeDraft} disabled={!preview.canPlace} data-testid="place-preview">
            <Plus size={15} />
            Place
          </button>
          <button
            type="button"
            onClick={() => updateProject((current) => addStackedLogistics(current, blueprintId, 'belt'))}
          >
            <Layers size={15} />
            Stack belts
          </button>
          <button
            type="button"
            onClick={() => updateProject((current) => addStackedLogistics(current, blueprintId, 'pipeline'))}
          >
            <Layers size={15} />
            Stack pipes
          </button>
        </aside>
        <div className="editor-main">
          <div className="preview-status" data-testid="placement-preview">
            <span className={`preview-dot ${preview.outline}`} />
            {preview.message}
          </div>
          <div className="blueprint-scroll">
            <div className="blueprint-canvas" data-testid="blueprint-editor-canvas">
              {[4, 5, 6].map((size) => (
                <div
                  key={size}
                  className="maker-outline"
                  style={{
                    width: (size * foundationCm) / 20,
                    height: (size * foundationCm) / 20,
                  }}
                >
                  {size}x{size}
                </div>
              ))}
              {blueprint.components.map((component) => (
                <BlueprintComponentView
                  key={component.id}
                  component={component}
                  stackCount={countStacked(blueprint.components, component)}
                />
              ))}
              <BlueprintComponentView component={draft} previewOutline={preview.outline} stackCount={1} />
            </div>
          </div>
        </div>
      </div>
    </PanelSurface>
  )
})

function BlueprintComponentView(props: {
  component: BlueprintComponent
  stackCount: number
  previewOutline?: 'normal' | 'yellow' | 'red'
}) {
  const scale = 0.05
  const component = props.component
  return (
    <div
      className={`bp-component type-${component.type} ${
        props.previewOutline ? `preview-${props.previewOutline}` : ''
      }`}
      style={{
        left: component.xCm * scale,
        top: component.yCm * scale,
        width: Math.max(18, component.widthCm * scale),
        height: Math.max(14, component.heightCm * scale),
      }}
      data-testid={`component-${component.type}`}
    >
      <span className="component-icon">
        <ComponentGlyph type={component.type} />
      </span>
      <span className="component-label">{component.label}</span>
      {component.direction ? (
        <span className={`direction direction-${component.direction}`}>
          <ArrowRight size={12} />
        </span>
      ) : null}
      <span className="port-marker port-a" />
      <span className="port-marker port-b" />
      {props.stackCount > 1 ? (
        <span className="stack-badge" data-testid="stack-count-badge">
          x{props.stackCount}
        </span>
      ) : null}
    </div>
  )
}

function FloatingStatsWindow(props: {
  statWindow: StatisticWindow
  onFocus: () => void
  onChange: (next: Partial<StatisticWindow>) => void
  onClose: () => void
}) {
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number } | undefined>(
    undefined,
  )
  const resizeRef = useRef<{
    startX: number
    startY: number
    width: number
    height: number
  } | undefined>(undefined)

  function onPointerMove(event: PointerEvent) {
    if (dragRef.current) {
      props.onChange({
        x: dragRef.current.x + event.clientX - dragRef.current.startX,
        y: dragRef.current.y + event.clientY - dragRef.current.startY,
      })
    }
    if (resizeRef.current) {
      props.onChange({
        width: Math.max(280, resizeRef.current.width + event.clientX - resizeRef.current.startX),
        height: Math.max(220, resizeRef.current.height + event.clientY - resizeRef.current.startY),
      })
    }
  }

  function onPointerUp() {
    dragRef.current = undefined
    resizeRef.current = undefined
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }

  function bindWindowPointerEvents() {
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  return (
    <section
      className="floating-stats"
      style={{
        left: props.statWindow.x,
        top: props.statWindow.y,
        width: props.statWindow.width,
        height: props.statWindow.height,
        zIndex: props.statWindow.zIndex,
      }}
      role="dialog"
      aria-label={props.statWindow.title}
      data-testid={`stats-window-${props.statWindow.sourcePanelId}`}
      onPointerDown={props.onFocus}
    >
      <header
        onPointerDown={(event: ReactPointerEvent) => {
          props.onFocus()
          dragRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            x: props.statWindow.x,
            y: props.statWindow.y,
          }
          bindWindowPointerEvents()
        }}
      >
        <strong>{props.statWindow.title}</strong>
        <button type="button" onClick={props.onClose} aria-label={`Close ${props.statWindow.title}`}>
          <X size={15} />
        </button>
      </header>
      <div className="stats-content">{props.statWindow.content}</div>
      <div
        className="resize-handle"
        onPointerDown={(event: ReactPointerEvent) => {
          props.onFocus()
          resizeRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            width: props.statWindow.width,
            height: props.statWindow.height,
          }
          bindWindowPointerEvents()
        }}
      />
    </section>
  )
}

function renderStatistics(panelId: string, title: string, project: ProjectState): ReactNode {
  if (panelId === 'planner') {
    const stats = plannerStats(project)
    return (
      <StatBlock title={title}>
        <StatLine label="Power" value={`${stats.powerMw} MW`} />
        <StatLine label="Fractional" value={String(stats.fractionalMachines)} />
        <StatLine label="Rounded" value={String(stats.roundedMachines)} />
        <StatLine label="Rounding impact" value={String(stats.roundingImpact)} />
        <KeyValueRecord title="Inputs" values={stats.inputs} />
        <KeyValueRecord title="Outputs" values={stats.outputs} />
        <KeyValueRecord title="Raw demand" values={stats.rawDemand} />
      </StatBlock>
    )
  }

  if (panelId === 'floor-plan') {
    const stats = floorStats(project)
    return (
      <StatBlock title={title}>
        <StatLine label="Floors" value={String(stats.floorCount)} />
        <StatLine label="Tile groups" value={String(stats.tileGroups)} />
        <StatLine label="Adjacency warnings" value={String(stats.adjacencyWarnings)} />
        <StatLine label="Order warnings" value={String(stats.orderWarnings)} />
        <KeyValueRecord title="Floor area" values={stats.squareAreaByFloor} />
      </StatBlock>
    )
  }

  const blueprintId = panelId.startsWith('blueprint-editor-')
    ? panelId.replace('blueprint-editor-', '')
    : project.selectedBlueprintId
  const blueprint = project.blueprints.find((candidate) => candidate.id === blueprintId)
  if (blueprint) {
    const stats = blueprintStats(project, blueprint)
    return (
      <StatBlock title={blueprint.name}>
        <StatLine label="Footprint" value={stats.footprint} />
        <StatLine label="Export eligible" value={stats.exportEligible ? 'Yes' : 'No'} />
        <StatLine label="Stacked logistics" value={String(stats.stackedLogistics)} />
        <StatLine label="Throughput warnings" value={String(stats.throughputWarnings)} />
        <KeyValueRecord title="Object counts" values={stats.objectCounts} />
        <StatLine label="Machine clocks" value={stats.machineClocks.join(', ') || 'None'} />
      </StatBlock>
    )
  }

  return (
    <StatBlock title={title}>
      <StatLine label="Blueprints" value={String(project.blueprints.length)} />
      <StatLine label="Validation issues" value={String(project.validation.issues.length)} />
      <StatLine label="Planner nodes" value={String(project.plannerNodes.length)} />
    </StatBlock>
  )
}

function StatBlock(props: { title: string; children: ReactNode }) {
  return (
    <section className="stat-block">
      <h3>{props.title}</h3>
      {props.children}
    </section>
  )
}

function StatLine(props: { label: string; value: string }) {
  return (
    <div className="stat-line">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  )
}

function KeyValueRecord(props: { title: string; values: Record<string, number> }) {
  const entries = Object.entries(props.values)
  return (
    <div className="record-block">
      <strong>{props.title}</strong>
      {entries.length === 0 ? <span>None</span> : null}
      {entries.map(([key, value]) => (
        <StatLine key={key} label={key} value={String(Math.round(value * 10) / 10)} />
      ))}
    </div>
  )
}

function SelectSetting<T extends string>(props: {
  label: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
}) {
  return (
    <label>
      {props.label}
      <select value={props.value} onChange={(event) => props.onChange(event.target.value as T)}>
        {props.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function ComponentGlyph({ type }: { type: ComponentType }) {
  if (type === 'machine') return <Package size={15} />
  if (type === 'belt') return <ArrowRight size={15} />
  if (type === 'splitter') return <Box size={15} />
  if (type === 'merger') return <Layers size={15} />
  if (type === 'pipeline') return <Wrench size={15} />
  if (type === 'power-pole' || type === 'wire') return <Zap size={15} />
  return <Box size={15} />
}

function countStacked(components: BlueprintComponent[], component: BlueprintComponent): number {
  if (component.type !== 'belt' && component.type !== 'pipeline') return 1
  return components.filter(
    (candidate) =>
      candidate.type === component.type &&
      candidate.xCm === component.xCm &&
      candidate.yCm === component.yCm &&
      candidate.widthCm === component.widthCm &&
      candidate.heightCm === component.heightCm,
  ).length
}

function createIconCode(name: string): string {
  const words = name.match(/[A-Za-z0-9]+/g) ?? [name]
  return words
    .slice(0, 2)
    .map((word) => word.at(0)?.toUpperCase() ?? '')
    .join('')
    .padEnd(2, '?')
}

function formatRate(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export { App }
export default App
