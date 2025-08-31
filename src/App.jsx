import { NavLink, Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getDB, addRoll, listRolls } from './db'
import './App.css'

/* ===== Tabs ===== */
function TabBar() {
  const linkClass = ({ isActive }) => `tab${isActive ? ' active' : ''}`
  return (
    <div className="tabs">
      <NavLink to="/" end className={linkClass}>Sheet</NavLink>
      <NavLink to="/dice" className={linkClass}>Dice</NavLink>
      <NavLink to="/messages" className={linkClass}>Messages</NavLink>
      <NavLink to="/map" className={linkClass}>Map</NavLink>
      <NavLink to="/dm" className={linkClass}>DM Tools</NavLink>
      <NavLink to="/log" className={linkClass}>Log</NavLink>
    </div>
  )
}
/* ===== HUD ===== */
function HudHeader(){
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString())
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="hud">
      <span className="pill"><span className="lamp" /> STATUS: ONLINE</span>
      <span className="brand">CYBERNETIC SYSTEMS</span>
      <span className="pill">TERMINAL</span>
      <div className="spacer" />
      <span className="pill">DATA: {clock}</span>
    </div>
  )
}

/* ===== Sheet ===== */
function SheetView() {
  const [char,setChar] = useState(null)
  useEffect(() => {
    (async () => {
      const db = await getDB()
      const res = db.exec(`SELECT id,name,system,role_class,level,stats_json,derived_json FROM characters LIMIT 1`)
      if(res[0]?.values?.[0]){
        const [id,name,system,role_class,level,stats,derived] = res[0].values[0]
        setChar({id,name,system,role_class,level,stats:JSON.parse(stats),derived:JSON.parse(derived||'{}')})
      }
    })()
  },[])
  if(!char) return <div className="wrap"><div className="panel">Loading character…</div></div>

  return (
    <div className="wrap">
      <div className="panel">
        <h2>{char.name} <span className="chip">{char.system}</span></h2>
        <p>Role: <span className="glow">{char.role_class ?? '—'}</span> &nbsp;•&nbsp; Level: {char.level}</p>

        <h3 style={{marginTop:12}}>Stats</h3>
        <div className="stats">
          {Object.entries(char.stats).map(([k,v]) => (
            <div className="stat" key={k}>
              <div className="k">{k}</div>
              <div className="v">{String(v)}</div>
            </div>
          ))}
        </div>

        <h3 style={{marginTop:12}}>Derived</h3>
        <div className="derived">
          {/* HP */}
          {(() => {
            const d = char.derived || {}
            const hpMax = d.hp_max ?? d.max_hp ?? d.hpMax ?? d.hp?.max ?? null
            const hpNow = d.hp_current ?? d.current_hp ?? d.hpNow ?? d.hp?.current ?? null
            if (hpMax != null && hpNow != null) {
              const pct = Math.max(0, Math.min(100, Math.round((Number(hpNow)/Number(hpMax))*100)))
              return (
                <div className="tile" key="hp">
                  <div className="k">HP</div>
                  <div className="v">{hpNow} / {hpMax}</div>
                  <div className="meter"><div className="meter-fill" style={{width:`${pct}%`}}/></div>
                </div>
              )
            }
            return null
          })()}

          {/* Armor */}
          {(() => {
            const d = char.derived || {}
            const armorHead = d.armor_head ?? d.head_armor ?? d.armor?.head
            const armorBody = d.armor_body ?? d.body_armor ?? d.armor?.body
            const armor = d.armor ?? d.sp ?? d.armor_sp
            if (armorHead != null || armorBody != null || armor != null) {
              return (
                <div className="tile" key="armor">
                  <div className="k">Armor</div>
                  <div className="v">
                    {armor != null ? `SP ${armor}` :
                      `${armorHead != null ? `Head SP ${armorHead}` : ''}${(armorHead!=null && armorBody!=null)?' • ':''}${armorBody != null ? `Body SP ${armorBody}` : ''}`}
                  </div>
                </div>
              )
            }
            return null
          })()}

          {/* Initiative as object: {expression, last} */}
          {(() => {
            const ini = char.derived?.initiative
            if (ini && typeof ini === 'object') {
              return (
                <div className="tile" key="initiative">
                  <div className="k">Initiative</div>
                  <div className="v">{ini.last ?? '—'}</div>
                  {ini.expression && <div className="subtle" style={{marginTop:4}}>{ini.expression}</div>}
                </div>
              )
            }
            return null
          })()}

          {/* Simple numeric/text fields */}
          {['move','speed','reflex','humanity','emp','luck'].map(key => {
            const val =
              (char.derived?.[key] ?? null) ??
              (char.derived?.[key.toUpperCase()] ?? null)
            return (val != null) ? (
              <div className="tile" key={key}>
                <div className="k">{key.charAt(0).toUpperCase()+key.slice(1)}</div>
                <div className="v">{String(val)}</div>
              </div>
            ) : null
          })}

          {/* Fallback for anything else */}
          {Object.entries(char.derived || {})
            .filter(([k]) => ![
              'hp','hp_max','max_hp','hpMax','hp_current','current_hp','hpNow',
              'armor','armor_head','armor_body','head_armor','body_armor','sp','armor_sp',
              'initiative','move','speed','reflex','humanity','emp','luck',
              'HP','Armor','Initiative','Move','Speed','Reflex','Humanity','EMP','Luck'
            ].includes(k))
            .map(([k,v]) => (
              <div className="tile" key={`extra-${k}`}>
                <div className="k">{k}</div>
                <div className="v">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

/* ===== Dice ===== */
function DiceBoard() {
  const [expr, setExpr] = useState('')
  const [history, setHistory] = useState([])
  const [status, setStatus] = useState('')

  // load existing rolls on mount
  useEffect(() => {
    (async () => {
      try {
        const rows = await listRolls({})
        setHistory(rows)
      } catch (e) {
        console.error('[Dice] listRolls error:', e)
        setStatus('Failed to load roll history (see console)')
      }
    })()
  }, [])

  // auto-hide toast after 1.5s
  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(''), 1500)
    return () => clearTimeout(t)
  }, [status])

  const doRoll = async () => {
    const m = expr.trim().match(/^(\d+)\s*d\s*(\d+)$/i) // NdM like 1d10, 2d6
    if (!m) { setStatus('Enter NdM like "1d10" or "2d6"'); return }
    const n = +m[1], sides = +m[2]
    let total = 0, faces = []
    for (let i = 0; i < n; i++) {
      const r = 1 + Math.floor(Math.random() * sides)
      faces.push(r); total += r
    }

    try {
      await addRoll({ expr, faces, total })
    } catch (e) {
      console.error('[Dice] addRoll ERROR:', e)
      setStatus('DB error while adding roll (see console)')
      return
    }

    try {
      const rows = await listRolls({})
      setHistory(rows)
      setExpr('')
      setStatus(`Rolled ${expr} → ${total}`)
    } catch (e) {
      console.error('[Dice] listRolls ERROR:', e)
      setStatus('DB error while listing rolls (see console)')
    }
  }

  const onSubmit = async (e) => { e.preventDefault(); await doRoll() }

  return (
    <div className="wrap">
      <div className="panel">
        <h2>Dice</h2>

        {status && <div className={`toast ${status.startsWith('DB error') ? 'err' : 'ok'}`}>{status}</div>}

        <form onSubmit={onSubmit} className="row">
          <input
            type="text"
            value={expr}
            onChange={e => setExpr(e.target.value)}
            placeholder='e.g., 1d10 or 2d6'
          />
          <button type="submit">Roll</button>
          <button
            type="button"
            className="secondary"
            onClick={async () => setHistory(await listRolls({}))}
          >
            Refresh
          </button>
        </form>
        <ul>
          {history.map((h, i) =>
            <li key={i}>{h.created ?? ''} — <span className="glow">{h.expr}</span>: {h.total} {JSON.stringify(h.faces)}</li>
          )}
        </ul>
      </div>
    </div>
  )
}

/* ===== Messages ===== */
function Messages(){ return <div className="wrap"><div className="panel">Messages placeholder (canvas coming later)</div></div> }

/* ===== Map & DM stubs ===== */
function MapBoard(){ return <div className="wrap"><div className="panel">Map placeholder (canvas coming later)</div></div> }
function DMPanel(){ return <div className="wrap"><div className="panel">DM tools placeholder</div></div> }

/* ===== Log (merged narration + rolls) ===== */
function LogView() {
  const [entries, setEntries] = useState([])

  useEffect(() => {
    (async () => {
      const db = await getDB()

      const logRes = db.exec(`SELECT body, created_at FROM logs`)
      const logs = (logRes[0]?.values ?? []).map(([body, created_at]) => ({
        kind: 'log', created_at: created_at || '', text: body
      }))

      const rolls = (await listRolls({ limit: 100 })).map(r => ({
        kind: 'roll', created_at: r.created || '', text: `🎲 ${r.expr} → ${r.total} ${JSON.stringify(r.faces)}`
      }))

      const merged = [...logs, ...rolls].sort((a,b)=> String(b.created_at).localeCompare(String(a.created_at)))
      setEntries(merged)
    })()
  }, [])

  return (
  <div className="wrap">
    <div className="panel">
      <h2>Session Log</h2>
      <ul className="log-list">
        {entries.map((e,i)=>(
          <li key={i} className={`log-item ${e.kind === 'roll' ? 'roll' : 'note'}`}>
            <span className="ts">{e.created_at || ''}</span>
            <span className={`badge ${e.kind === 'roll' ? 'roll' : 'note'}`}>
              {e.kind === 'roll' ? 'ROLL' : 'NOTE'}
            </span>
            <span style={{marginLeft:8}}>{e.text}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
)

}

/* ===== App ===== */
export default function App(){
  return (
    <div className="app">
      <HudHeader />
      <TabBar/>
      <Routes>
        <Route path="/" element={<SheetView/>} />
        <Route path="/dice" element={<DiceBoard/>} />
        <Route path="/messages" element={<Messages/>} />
        <Route path="/map" element={<MapBoard/>} />
        <Route path="/dm" element={<DMPanel/>} />
        <Route path="/log" element={<LogView/>} />
      </Routes>
    </div>
  )
}

