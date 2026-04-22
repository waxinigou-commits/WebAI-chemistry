import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Html, OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import type { Mesh, Group } from 'three'
import './App.css'

type ObjectType = 'lamp' | 'tube'

type Vec2 = { x: number; z: number }

const INITIAL_STATE = {
  lamp: { x: -1.45, z: 0.45 },
  tube: { x: 1.15, z: -0.2 },
  flameOn: true,
  selected: 'lamp' as ObjectType,
}

const BOUNDS = {
  lamp: { minX: -2.7, maxX: 2.55, minZ: -1.15, maxZ: 1.05 },
  tube: { minX: -2.35, maxX: 2.25, minZ: -1.3, maxZ: 1.15 },
}

const HEAT_ZONE = {
  offsetX: 0.18,
  offsetZ: -0.08,
  radiusX: 0.82,
  radiusZ: 0.58,
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getHeatProbe(tube: Vec2) {
  return {
    x: tube.x - 0.46,
    z: tube.z + 0.12,
  }
}

function getHeatZoneCenter(lamp: Vec2) {
  return {
    x: lamp.x + HEAT_ZONE.offsetX,
    z: lamp.z + HEAT_ZONE.offsetZ,
  }
}

function isTubeHeating(lamp: Vec2, tube: Vec2, flameOn: boolean) {
  if (!flameOn) return false
  const probe = getHeatProbe(tube)
  const center = getHeatZoneCenter(lamp)

  return (
    Math.abs(probe.x - center.x) <= HEAT_ZONE.radiusX &&
    Math.abs(probe.z - center.z) <= HEAT_ZONE.radiusZ
  )
}

function App() {
  const [lamp, setLamp] = useState<Vec2>(INITIAL_STATE.lamp)
  const [tube, setTube] = useState<Vec2>(INITIAL_STATE.tube)
  const [selected, setSelected] = useState<ObjectType>(INITIAL_STATE.selected)
  const [flameOn, setFlameOn] = useState(INITIAL_STATE.flameOn)
  const [dragging, setDragging] = useState<ObjectType | null>(null)
  const [flameVersion, setFlameVersion] = useState(0)

  const heating = useMemo(() => isTubeHeating(lamp, tube, flameOn), [lamp, tube, flameOn])
  const heatProbe = useMemo(() => getHeatProbe(tube), [tube])
  const heatZoneCenter = useMemo(() => getHeatZoneCenter(lamp), [lamp])

  const toggleFlame = () => {
    setFlameOn((value) => !value)
  }

  useEffect(() => {
    setFlameVersion((value) => value + 1)
  }, [flameOn])

  const resetScene = () => {
    setLamp(INITIAL_STATE.lamp)
    setTube(INITIAL_STATE.tube)
    setFlameOn(INITIAL_STATE.flameOn)
    setSelected(INITIAL_STATE.selected)
    setDragging(null)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-badge">🧪</div>
          <div>
            <strong>WebAI Chemistry Lab · 真 3D 原型</strong>
            <p>方案：最小实验台模型迁移到 React Three Fiber。测试目标：拖动、热区、状态、布局全部自动验收。</p>
          </div>
        </div>
        <div className="toolbar">
          <button className="ghost-btn" id="toggle-flame" onClick={toggleFlame}>
            {flameOn ? '熄灭火焰' : '点燃火焰'}
          </button>
          <button className="primary-btn" id="reset-scene" onClick={resetScene}>
            重置位置
          </button>
        </div>
      </header>

      <main className="main-layout">
        <section className="scene-panel">
          <div className="test-controls" aria-label="test-controls">
            <div id="flame-flag" data-flame-on={flameOn ? 'true' : 'false'} style={{ display: 'none' }} />
            <button id="move-lamp-test" className="ghost-btn test-btn" onClick={() => {
              setSelected('lamp')
              setLamp({ x: 0.05, z: 0.2 })
            }}>
              测试移动酒精灯
            </button>
            <button id="move-tube-heat-test" className="ghost-btn test-btn" onClick={() => {
              setSelected('tube')
              setTube({ x: 0.1, z: 0.2 })
            }}>
              测试移动试管到热区
            </button>
            <button id="move-tube-outside-heat-test" className="ghost-btn test-btn" onClick={() => {
              setSelected('tube')
              setTube({ x: 1.8, z: -0.95 })
            }}>
              测试移出热区
            </button>
            <button id="select-tube-test" className="ghost-btn test-btn" onClick={() => setSelected('tube')}>
              测试选中试管
            </button>
            <button id="select-lamp-test" className="ghost-btn test-btn" onClick={() => setSelected('lamp')}>
              测试选中酒精灯
            </button>
            <button id="toggle-flame-test" className="ghost-btn test-btn" onClick={toggleFlame}>
              测试切换火焰
            </button>
            <button id="set-flame-off-test" className="ghost-btn test-btn" onClick={() => {
              setFlameOn(false)
              setDragging(null)
            }}>
              测试直接关火
            </button>
            <button id="set-flame-on-test" className="ghost-btn test-btn" onClick={() => {
              setFlameOn(true)
              setDragging(null)
            }}>
              测试直接点火
            </button>
            <button id="reset-scene-test" className="ghost-btn test-btn" onClick={resetScene}>
              测试重置场景
            </button>
          </div>
          <div className="hud hud-left" id="hint-text">
            {heating
              ? '试管已进入火焰上方，热区判定成立。'
              : flameOn
                ? '拖动酒精灯和试管，验证热区与空间关系。'
                : '火焰已关闭，当前不应触发加热状态。'}
          </div>
          <div className="hud hud-right">测试方案：结构、交互、逻辑、响应式、视觉表达五类自动验收</div>

          <div className="canvas-wrap" data-testid="canvas-wrap">
            <Canvas shadows camera={{ position: [0, 4.6, 7.8], fov: 36 }}>
              <color attach="background" args={['#151b23']} />
              <fog attach="fog" args={['#151b23', 10, 18]} />
              <ambientLight intensity={1.8} />
              <directionalLight
                position={[3.8, 7.2, 4.5]}
                intensity={2.2}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
              />
              <pointLight position={[lamp.x, 1.8, lamp.z]} intensity={flameOn ? 11 : 0} color="#ffb25e" distance={5} />
              <Environment preset="warehouse" />

              <group position={[0, -0.35, 0]}>
                <LabBench />
                <HeatZone lamp={lamp} visible={flameOn} />
                <AlcoholLamp
                  position={lamp}
                  selected={selected === 'lamp'}
                  flameOn={flameOn}
                  dragging={dragging === 'lamp'}
                  onSelect={() => setSelected('lamp')}
                  onDragState={setDragging}
                  onMove={setLamp}
                />
                <TestTube
                  position={tube}
                  selected={selected === 'tube'}
                  heating={heating}
                  dragging={dragging === 'tube'}
                  onSelect={() => setSelected('tube')}
                  onDragState={setDragging}
                  onMove={setTube}
                />
              </group>

              <OrbitControls enabled={false} />
            </Canvas>
          </div>
        </section>

        <aside className="side-panel">
          <section className="card">
            <h2>实现方案</h2>
            <ul>
              <li>固定相机，不做自由漫游，聚焦实验台核心交互</li>
              <li>只实现实验台、酒精灯、试管、热区和状态面板</li>
              <li>拖动采用射线与台面平面交点，避免伪 3D 错位</li>
              <li>热区命中后试管升温发光，先验证感知，再扩展真实实验逻辑</li>
            </ul>
          </section>

          <section className="card">
            <h2>测试方案</h2>
            <ul>
              <li>结构测试：Canvas、按钮、状态字段必须存在</li>
              <li>交互测试：真实拖动 + 稳定测试锚点双通道验证</li>
              <li>逻辑测试：进入热区加热，关火后取消加热</li>
              <li>边界测试：重置后状态与位置恢复初始值</li>
              <li>布局测试：窄屏时侧栏下排，主场景仍可见</li>
            </ul>
          </section>

          <section className="status-grid">
            <StatusCard label="当前选中" value={selected === 'lamp' ? '酒精灯' : '试管'} id="status-selected" />
            <StatusCard label="酒精灯状态" value={flameOn ? '点燃中' : '已熄灭'} id="status-lamp" />
            <StatusCard label="试管状态" value={heating ? '加热中' : '未加热'} id="status-tube" />
            <StatusCard label="空间关系" value={heating ? '试管已进入火焰上方' : '试管未进入火焰上方'} id="status-relation" />
          </section>

          <section className="card report-card">
            <h2>当前子功能：状态面板一致性</h2>
            <p id="heat-debug">
              selected={selected} | flameOn={String(flameOn)} | heating={String(heating)} | probe=({heatProbe.x.toFixed(2)}, {heatProbe.z.toFixed(2)}) | center=({heatZoneCenter.x.toFixed(2)}, {heatZoneCenter.z.toFixed(2)})
            </p>
            <p id="flame-debug">
              flameOn={String(flameOn)} | button={flameOn ? '熄灭火焰' : '点燃火焰'} | version={flameVersion} | dragging={String(dragging)}
            </p>
            <p>本轮只验收状态面板。要求它始终和内部状态完全一致，不允许 selected 或 reset 后残留旧值。</p>
          </section>
        </aside>
      </main>
    </div>
  )
}

function StatusCard({ label, value, id }: { label: string; value: string; id: string }) {
  return (
    <div className="status-card">
      <span>{label}</span>
      <strong id={id}>{value}</strong>
    </div>
  )
}

function LabBench() {
  return (
    <group>
      <mesh receiveShadow position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[7.2, 4.4, 0.34]} />
        <meshStandardMaterial color="#3b4550" roughness={0.88} metalness={0.08} />
      </mesh>
      <mesh receiveShadow position={[0, -0.24, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6.8, 4]} />
        <meshStandardMaterial color="#2a3138" roughness={0.95} metalness={0.02} />
      </mesh>
      <gridHelper args={[6.2, 12, '#53606c', '#3a434b']} position={[0, -0.16, 0]} />
    </group>
  )
}

function HeatZone({ lamp, visible }: { lamp: Vec2; visible: boolean }) {
  return (
    <mesh
      position={[lamp.x + HEAT_ZONE.offsetX, 0.05, lamp.z + HEAT_ZONE.offsetZ]}
      rotation={[-Math.PI / 2, 0, 0]}
      visible={visible}
    >
      <ringGeometry args={[0.28, 0.75, 48]} />
      <meshBasicMaterial color="#ffbe73" transparent opacity={0.18} />
    </mesh>
  )
}

function AlcoholLamp({
  position,
  selected,
  flameOn,
  dragging,
  onSelect,
  onDragState,
  onMove,
}: {
  position: Vec2
  selected: boolean
  flameOn: boolean
  dragging: boolean
  onSelect: () => void
  onDragState: (value: ObjectType | null) => void
  onMove: (value: Vec2) => void
}) {
  const groupRef = useRef<Group>(null)
  const flameRef = useRef<Mesh>(null)

  useFrame(({ clock }) => {
    if (!flameRef.current) return
    const scaleY = flameOn ? 1 + Math.sin(clock.elapsedTime * 7) * 0.06 : 0.18
    flameRef.current.scale.y = scaleY
  })

  const bindDrag = useBenchDrag('lamp', position, onMove, onSelect, onDragState)

  return (
    <group ref={groupRef} {...bindDrag}>
      <mesh castShadow receiveShadow position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.42, 0.5, 0.18, 40]} />
        <meshStandardMaterial color={selected ? '#c58d2b' : '#935d1d'} emissive={selected ? '#4f3008' : '#241303'} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.25, 0.28, 0.54, 36]} />
        <meshPhysicalMaterial color="#d89a30" transparent opacity={0.88} roughness={0.36} transmission={0.15} />
      </mesh>
      <mesh castShadow position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.16, 20]} />
        <meshStandardMaterial color="#9f7a43" metalness={0.18} roughness={0.58} />
      </mesh>
      <mesh castShadow position={[0, 0.94, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.12, 12]} />
        <meshStandardMaterial color="#e2d4c0" />
      </mesh>
      <mesh ref={flameRef} position={[0, 1.2, 0]} castShadow visible={flameOn}>
        <coneGeometry args={[0.14, 0.44, 24]} />
        <meshStandardMaterial color="#ffb45e" emissive="#ff9c40" emissiveIntensity={2.3} transparent opacity={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <circleGeometry args={[dragging ? 0.65 : 0.58, 32]} />
        <meshBasicMaterial color={selected ? '#78ddff' : '#000000'} transparent opacity={selected ? 0.18 : 0.12} />
      </mesh>
      <Html position={[0, 1.55, 0]} center distanceFactor={10}>
        <div className={`object-tag ${selected ? 'active' : ''}`}>酒精灯</div>
      </Html>
    </group>
  )
}

function TestTube({
  position,
  selected,
  heating,
  dragging,
  onSelect,
  onDragState,
  onMove,
}: {
  position: Vec2
  selected: boolean
  heating: boolean
  dragging: boolean
  onSelect: () => void
  onDragState: (value: ObjectType | null) => void
  onMove: (value: Vec2) => void
}) {
  const bindDrag = useBenchDrag('tube', position, onMove, onSelect, onDragState)

  return (
    <group {...bindDrag} rotation={[0, 0.1, Math.PI / 8]}>
      <mesh castShadow receiveShadow>
        <capsuleGeometry args={[0.14, 1.28, 12, 28]} />
        <meshPhysicalMaterial
          color={heating ? '#ffcc8c' : '#d9eefb'}
          transparent
          opacity={0.64}
          roughness={0.14}
          metalness={0.02}
          transmission={0.74}
          emissive={heating ? '#ff9a4c' : '#0f2231'}
          emissiveIntensity={heating ? 0.6 : 0.12}
        />
      </mesh>
      <mesh position={[-0.16, -0.02, 0]} castShadow>
        <capsuleGeometry args={[0.08, 0.7, 8, 18]} />
        <meshStandardMaterial color={heating ? '#ffab65' : '#8f5f40'} emissive={heating ? '#ff8f4e' : '#29140a'} emissiveIntensity={heating ? 0.58 : 0.08} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.23, 0]} receiveShadow>
        <circleGeometry args={[dragging ? 0.8 : 0.72, 32]} />
        <meshBasicMaterial color={selected ? '#78ddff' : '#000000'} transparent opacity={selected ? 0.18 : 0.1} />
      </mesh>
      <Html position={[0.3, 1.05, 0]} center distanceFactor={10}>
        <div className={`object-tag ${selected ? 'active' : ''}`}>试管</div>
      </Html>
    </group>
  )
}

function useBenchDrag(
  name: ObjectType,
  current: Vec2,
  onMove: (value: Vec2) => void,
  onSelect: () => void,
  onDragState: (value: ObjectType | null) => void,
) {
  const dragPlaneY = name === 'lamp' ? 0 : 0.26

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    onSelect()
    onDragState(name)
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!(event.buttons & 1)) return
    event.stopPropagation()
    const point = event.point
    const next = {
      x: clamp(point.x, BOUNDS[name].minX, BOUNDS[name].maxX),
      z: clamp(point.z, BOUNDS[name].minZ, BOUNDS[name].maxZ),
    }
    if (Math.abs(next.x - current.x) > 0.0001 || Math.abs(next.z - current.z) > 0.0001) {
      onMove(next)
    }
  }

  const onPointerUp = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    onDragState(null)
    ;(event.target as Element).releasePointerCapture?.(event.pointerId)
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerMissed: () => onDragState(null),
    onPointerLeave: () => onDragState(null),
    onLostPointerCapture: () => onDragState(null),
    position: [current.x, dragPlaneY, current.z] as [number, number, number],
  }
}

export default App