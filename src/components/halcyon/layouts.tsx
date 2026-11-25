/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React from 'react';
import Link from 'next/link';

type V = { v: any };

const LAYOUTS = [
  ['tmux', '/terminal'],
  ['sidebar', '/terminal/sidebar'],
  ['desktop', '/terminal/desktop'],
] as const;

const Cursor = () => <span className="hc-cursor">█</span>;

export function Panel({ title, style, bodyGap, children }: { title: React.ReactNode; style?: React.CSSProperties; bodyGap?: number; children: React.ReactNode }) {
  return (
    <div className="hc-panel" style={{ gap: bodyGap, ...style }}>
      <div className="hc-panel-title">┤ {title} ├</div>
      {children}
    </div>
  );
}

function TopBar({ v }: V) {
  return (
    <div className="hc-topbar">
      <Link href="/" className="hc-acc" style={{ color: 'var(--hi)', letterSpacing: '.14em', textDecoration: 'none' }} title="Back to Space Trader">◢ HALCYON-OS</Link>
      <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span className="hc-dim">LAYOUT</span>
        {LAYOUTS.map(([id, href]) => (
          <Link key={id} href={href} className={`hc-layout-link ${v.layout === id ? 'on' : 'hc-acc'}`}>{id}</Link>
        ))}
      </span>
      <span style={{ display: 'flex', gap: 6 }}><span className="hc-dim">AGENT</span><span>{v.agentSym}</span></span>
      <span style={{ display: 'flex', gap: 6 }}><span className="hc-dim">TREASURY</span><span className="hc-accent">{v.credits}</span></span>
      <span style={{ display: 'flex', gap: 6 }}><span className="hc-dim">HQ</span><span>{v.hq}</span></span>
      <span style={{ display: 'flex', gap: 6 }}><span className="hc-dim">SYSTEM</span><span>{v.system}</span></span>
      <span style={{ flex: 1 }} />
      <span className="hc-dim">{v.clock} UTC</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={v.cycleTheme} className="hc-fill" style={{ border: '1px solid var(--line)', padding: '1px 8px' }}>[ CRT {v.themeName} ]</button>
        <button onClick={v.toggleMute} className="hc-fill" style={{ border: '1px solid var(--line)', padding: '1px 8px' }}>[ SND {v.sndLabel} ]</button>
        {v.loggedIn && !v.isDemo && <span style={{ color: 'var(--alert)' }} title="Agents and progress are erased at the weekly reset">* RESETS WEEKLY</span>}
        {v.loggedIn && v.isDemo && <span className="hc-accent">SIMULATOR</span>}
        {v.loggedIn && <button onClick={v.logout} className="hc-alert" style={{ border: '1px solid var(--line)', padding: '1px 8px', color: 'var(--alert)' }}>[ EJECT ]</button>}
      </div>
    </div>
  );
}

function FleetList({ v }: V) {
  return (
    <>
      {v.fleet.map((f: any) => (
        <div key={f.sym} onClick={f.onClick} className="hc-acc" style={{ display: 'grid', gridTemplateColumns: '1ch minmax(0,1fr) auto', gap: 8, cursor: 'pointer', color: f.color }}>
          <span>{f.mark}</span>
          <span className="hc-ell">{f.sym} <span className="hc-dim">{f.role}</span></span>
          <span className="hc-dim">{f.st}</span>
        </div>
      ))}
      {v.fleetEmpty && <div className="hc-dim">no hulls registered</div>}
    </>
  );
}

function FleetCards({ v }: V) {
  return v.fleet.map((f: any) => (
    <div key={f.sym} onClick={f.onClick} className="hc-bord" style={{ border: `1px solid ${f.border}`, padding: '8px 10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span className="hc-hi">{f.mark} {f.sym}</span><span className="hc-accent">{f.st}</span></div>
      <div className="hc-dim">{f.role} · {f.loc}</div>
      <div style={{ whiteSpace: 'pre', overflow: 'hidden' }}>FUEL {f.fuelBar}  HOLD {f.cargoTxt}</div>
    </div>
  ));
}

function ShipDetail({ v }: V) {
  if (!v.hasShip) return <div className="hc-dim">awaiting helm authentication…</div>;
  return (
    <>
      <div className="hc-col" style={{ gap: 2 }}>
        <div className="hc-hi" style={{ fontSize: '1.15em' }}>{v.sShip}</div>
        <div className="hc-dim">{v.sFrame} · {v.sRole}</div>
      </div>
      <div className="hc-col" style={{ gap: 2 }}>
        <div className="hc-accent">{v.sStatus}</div>
        <div className="hc-dim">{v.sSub}</div>
        {v.sTransit && <div style={{ whiteSpace: 'pre' }}>{v.sTrBar}</div>}
      </div>
      <div className="hc-kv" style={{ whiteSpace: 'pre' }}>
        <span className="hc-dim">FUEL</span><span style={{ overflow: 'hidden' }}>{v.sFuelBar} {v.sFuelTxt}</span>
        <span className="hc-dim">HOLD</span><span style={{ overflow: 'hidden' }}>{v.sCargoBar} {v.sCargoTxt}</span>
        <span className="hc-dim">LASER</span><span>{v.sCd}</span>
        <span className="hc-dim">MODE</span><span>{v.sMode}</span>
      </div>
      <div className="hc-col" style={{ gap: 3 }}>
        <div className="hc-rule">CARGO MANIFEST</div>
        {v.inv.map((it: any) => (
          <div key={it.symbol} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="hc-ell" style={{ flex: 1, minWidth: 0 }}>{it.symbol}</span>
            <span className="hc-accent">×{it.units}</span>
            {it.canSell && <button onClick={it.onSell} disabled={it.disabled} className="hc-btn-sm hc-fill">SELL</button>}
          </div>
        ))}
        {v.invEmpty && <div className="hc-dim">hold empty</div>}
      </div>
    </>
  );
}

function StarMap({ v }: V) {
  return (
    <div ref={v.mapRef} style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <span ref={v.probeRef} style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'pre', lineHeight: 1.15 }}>00000000000000000000</span>
      <div style={{ position: 'absolute', inset: 0, lineHeight: 1.15, userSelect: 'none', display: 'flex', flexDirection: 'column' }}>
        {v.mapRows.map((row: any) => (
          <div key={row.id} style={{ whiteSpace: 'pre', flex: 'none' }}>
            {row.segs.map((seg: any, i: number) => (
              <span key={i} onClick={seg.onClick} style={{ color: seg.color, background: seg.bg, cursor: seg.cursor }}>{seg.text}</span>
            ))}
          </div>
        ))}
      </div>
      {v.mapEmpty && <div className="hc-dim" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>· · · awaiting astrogation data · · ·</div>}
    </div>
  );
}

function Legend() {
  return (
    <div className="hc-dim" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', borderTop: '1px dashed var(--line)', paddingTop: 5 }}>
      <span>O planet</span><span>@ gas giant</span><span># station</span><span>* asteroid</span><span>% jump gate</span><span className="hc-accent">◆ you / here</span><span>+n orbitals</span>
    </div>
  );
}

function WaypointScan({ v }: V) {
  const wd = v.wd;
  return (
    <>
      {v.hasSel && (
        <div className="hc-card" style={{ gap: 4 }}>
          <div className="hc-hi" style={{ fontSize: '1.15em' }}>{wd.sym}</div>
          <div className="hc-kv" style={{ gap: '2px 10px' }}>
            <span className="hc-dim">TYPE</span><span>{wd.type}</span>
            <span className="hc-dim">COORD</span><span>{wd.coords}</span>
            <span className="hc-dim">RANGE</span><span>{wd.dist}</span>
            <span className="hc-dim">BURN</span><span>{wd.fuel}</span>
            <span className="hc-dim">ORBITS</span><span>{wd.parent}</span>
          </div>
          <div className="hc-dim" style={{ textWrap: 'pretty' }}>{wd.traits}</div>
          {v.wdOrbitals.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span className="hc-dim">ORBITALS</span>
              {v.wdOrbitals.map((o: any) => <button key={o.c} onClick={o.onClick} className="hc-btn-sm hc-fill">{o.c}</button>)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <button onClick={v.doNav} disabled={v.navDisabled} className="hc-btn-fg hc-fill">» SET COURSE</button>
            {wd.hasMarket && <button onClick={v.openMarket} className="hc-btn hc-fill">MARKET</button>}
          </div>
        </div>
      )}
      <div className="hc-col" style={{ gap: 1 }}>
        <div className="hc-rule" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 6ch 5ch', gap: 8 }}><span>NAV INDEX</span><span style={{ textAlign: 'right' }}>RANGE</span><span>TAGS</span></div>
        {v.idx.map((w: any) => (
          <div key={w.key} onClick={w.onClick} className={`hc-acc ${w.bg === 'transparent' ? '' : 'hc-selected'}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 6ch 5ch', gap: 8, cursor: 'pointer', color: w.color, background: w.bg }}>
            <span className="hc-ell">{w.c} <span className="hc-dim">{w.type}</span></span>
            <span style={{ textAlign: 'right' }}>{w.d}</span>
            <span className="hc-accent">{w.flags}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Market({ v, picker }: V & { picker?: boolean }) {
  const cols = 'minmax(0,1fr) 7ch 7ch auto';
  return (
    <>
      {picker && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span className="hc-dim">MARKETS</span>
          {v.mktPick.map((k: any) => <button key={k.key} onClick={k.onClick} style={{ border: '1px solid var(--line)', padding: '0 8px', background: k.bg, color: k.fg, textShadow: 'none' }}>{k.c}</button>)}
        </div>
      )}
      <div className="hc-hi">{v.mktTitle}</div>
      {v.mktNone && <div className="hc-dim">No marketplace on this beacon. Pick a waypoint tagged M in the nav index.</div>}
      {v.mktLoading && <div className="hc-dim">querying exchange…</div>}
      {v.goods.length > 0 && (
        <div className="hc-col" style={{ gap: 2 }}>
          <div className="hc-rule" style={{ display: 'grid', gridTemplateColumns: cols, gap: 8 }}><span>GOOD</span><span style={{ textAlign: 'right' }}>BUY</span><span style={{ textAlign: 'right' }}>SELL</span><span /></div>
          {v.goods.map((g: any) => (
            <div key={g.sym} style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center', padding: '2px 0', borderBottom: '1px solid var(--line)' }}>
              <span className="hc-col" style={{ minWidth: 0 }}>
                <span className="hc-ell">{g.sym} <span className="hc-accent">{g.held}</span></span>
                <span className="hc-dim">{g.kind} · {g.supply} · vol {g.vol}</span>
              </span>
              <span style={{ textAlign: 'right' }}>{g.buy}</span>
              <span style={{ textAlign: 'right' }}>{g.sell}</span>
              <span style={{ display: 'flex', gap: 4 }}>
                <button onClick={g.onBuy} disabled={g.noBuy} className="hc-fill" style={{ border: '1px solid var(--line)', padding: '0 5px' }}>B</button>
                <button onClick={g.onSell} disabled={g.noSell} className="hc-fill" style={{ border: '1px solid var(--line)', padding: '0 5px' }}>S</button>
              </span>
            </div>
          ))}
        </div>
      )}
      {v.mktList && (
        <div className="hc-kv" style={{ gap: '4px 10px' }}>
          <span className="hc-dim">EXPORTS</span><span>{v.mExports}</span>
          <span className="hc-dim">IMPORTS</span><span>{v.mImports}</span>
          <span className="hc-dim">EXCHANGE</span><span>{v.mExchange}</span>
        </div>
      )}
      {v.mktHint && <div className="hc-dim" style={{ textWrap: 'pretty' }}>{v.mktHint}</div>}
      {v.mktCanScan && <div><button onClick={v.scanMarket} className="hc-btn hc-fill">↻ RESCAN EXCHANGE</button></div>}
    </>
  );
}

function Contracts({ v }: V) {
  return (
    <>
      {v.cons.map((c: any) => (
        <div key={c.key} className="hc-card" style={{ gap: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span className="hc-hi">#{c.id} {c.type}</span><span style={{ color: c.stColor }}>{c.status}</span></div>
          <div className="hc-dim">{c.fac} · {c.deadline}</div>
          <div><span className="hc-dim">PAY </span><span className="hc-accent">{c.pay}</span></div>
          {c.terms.map((t: any) => (
            <div key={t.key} className="hc-col" style={{ gap: 3, paddingLeft: 8, borderLeft: '1px solid var(--line)' }}>
              <div>{t.txt} → <button onClick={t.onGo} style={{ border: 'none', padding: 0, color: 'var(--hi)', textDecoration: 'underline' }}>{t.dest}</button></div>
              <div style={{ whiteSpace: 'pre', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>{t.bar} {t.prog}</span>
                {t.canDeliver && <button onClick={t.onDeliver} className="hc-fill" style={{ border: '1px solid var(--fg)', padding: '0 6px' }}>DELIVER</button>}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            {c.canAccept && <button onClick={c.onAccept} className="hc-btn-fg hc-fill">ACCEPT</button>}
            {c.canFulfill && <button onClick={c.onFulfill} className="hc-acc-fill" style={{ border: '1px solid var(--acc)', color: 'var(--acc)', padding: '1px 10px' }}>FULFILL</button>}
          </div>
        </div>
      ))}
      {!v.cons.length && <div className="hc-dim">No contracts on file.</div>}
      <div><button onClick={v.doNegotiate} disabled={v.noNegotiate} className="hc-btn hc-fill">⌁ NEGOTIATE NEW CONTRACT</button></div>
      <div className="hc-dim" style={{ textWrap: 'pretty' }}>Negotiation needs a docked ship at a faction outpost.</div>
    </>
  );
}

function Profile({ v }: V) {
  return (
    <div className="hc-col" style={{ gap: 16 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div className="hc-hi" style={{ width: 84, height: 84, border: '1px solid var(--fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.6em', flex: 'none' }}>{v.agentInitial}</div>
        <div className="hc-col" style={{ gap: 2, minWidth: 0 }}><div className="hc-hi" style={{ fontSize: '1.3em' }}>{v.agentSym}</div><div className="hc-dim">licensed hauler · {v.agentFaction}</div></div>
      </div>
      <div className="hc-kv" style={{ gap: '6px 14px' }}>
        <span className="hc-dim">TREASURY</span><span className="hc-accent" style={{ fontSize: '1.2em' }}>{v.credits}</span>
        <span className="hc-dim">HEADQUARTERS</span><span>{v.hqFull}</span>
        <span className="hc-dim">FLEET</span><span>{v.agentShips}</span>
        <span className="hc-dim">CONTRACTS</span><span>{v.conSummary}</span>
        <span className="hc-dim">ACCOUNT</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.agentAcct}</span>
        <span className="hc-dim">SESSION</span><span>{v.reqs} relay requests</span>
      </div>
    </div>
  );
}

function CommsLog({ v, gap = 2, style }: V & { gap?: number; style?: React.CSSProperties }) {
  return (
    <div ref={v.conRef} style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap, ...style }}>
      {v.logLines.map((l: any) => <div key={l.id} style={{ whiteSpace: 'pre-wrap', color: l.color }}>{l.text}</div>)}
      <div style={{ display: 'flex', gap: 8 }}><span className="hc-dim">vesta@halcyon:~$</span><Cursor /></div>
    </div>
  );
}

function CmdBar({ v }: V) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      {v.cmds.map((c: any) => (
        <button key={c.key} onClick={c.onClick} disabled={c.disabled} className="hc-fill" style={{ border: '1px solid var(--fg)', padding: '3px 12px', display: 'flex', gap: 8 }}>
          <span className="hc-dim">{c.key}</span><span>{c.label}</span>
        </button>
      ))}
      <span style={{ flex: 1 }} />
      {v.busy && <span className="hc-accent">▓▒░ transmitting…</span>}
    </div>
  );
}

// ---------------------------------------------------------------- tmux

export function TmuxLayout({ v }: V) {
  return (
    <>
      <TopBar v={v} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(230px,0.9fr) minmax(0,2.2fr) minmax(290px,1.2fr)', gap: 14, minHeight: 0 }}>
        <div className="hc-col" style={{ gap: 16, minHeight: 0 }}>
          <Panel title="0:FLEET" style={{ maxHeight: '34%' }}>
            <div style={{ overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2 }}><FleetList v={v} /></div>
          </Panel>
          <Panel title="1:SHIP" style={{ flex: 1 }}>
            <div className="hc-scroll"><ShipDetail v={v} /></div>
          </Panel>
        </div>
        <div style={{ display: 'grid', gridTemplateRows: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 16, minHeight: 0 }}>
          <Panel title={<>2:ASTROGATION — {v.system}</>} bodyGap={6} style={{ paddingBottom: 8 }}>
            <StarMap v={v} />
            <Legend />
          </Panel>
          <Panel title="3:COMMS · VESTA" style={{ paddingBottom: 8 }}>
            <CommsLog v={v} />
          </Panel>
        </div>
        <Panel title="4:OPS" bodyGap={10}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {v.tabs.map((t: any) => <button key={t.id} onClick={t.onClick} style={{ border: '1px solid var(--line)', padding: '1px 10px', background: t.bg, color: t.fg, textShadow: 'none' }}>{t.label}</button>)}
          </div>
          <div className="hc-scroll">
            {v.tab === 'scan' && <WaypointScan v={v} />}
            {v.tab === 'mkt' && <Market v={v} />}
            {v.tab === 'con' && <Contracts v={v} />}
          </div>
        </Panel>
      </div>
      <CmdBar v={v} />
      <div className="hc-statusbar">
        <span>[halcyon] 0:fleet 1:ship 2:astro 3:comms 4:ops*</span>
        <span>api.spacetraders.io/v2 · req {v.reqs} · keys 1–7</span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- sidebar

export function SidebarLayout({ v }: V) {
  return (
    <>
      <TopBar v={v} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,200px) minmax(0,1.5fr) minmax(280px,1fr)', gap: 16, minHeight: 0 }}>
        <div className="hc-col" style={{ gap: 8, minHeight: 0, overflow: 'auto', paddingTop: 4 }}>
          <div className="hc-dim" style={{ letterSpacing: '.14em', paddingBottom: 4 }}>MODULES</div>
          {v.mods.map((m: any) => (
            <button key={m.id} onClick={m.onClick} className="hc-bord" style={{ display: 'grid', gridTemplateColumns: '2.4ch minmax(0,1fr)', gap: '0 8px', alignItems: 'center', textAlign: 'left', border: `1px solid ${m.border}`, padding: '8px 10px', background: m.bg, color: m.fg }}>
              <span style={{ fontSize: '1.4em', lineHeight: 1, gridRow: 'span 2' }}>{m.glyph}</span>
              <span style={{ letterSpacing: '.06em' }}>{m.label}</span>
              <span className="hc-ell" style={{ opacity: .7 }}>{m.sub}</span>
            </button>
          ))}
        </div>
        <div className="hc-col" style={{ gap: 14, minHeight: 0 }}>
          <Panel title="TERMINAL · VESTA ship intelligence" bodyGap={10} style={{ flex: 1, padding: '16px 12px 10px', borderColor: 'var(--fg)' }}>
            <CommsLog v={v} gap={5} style={{ fontSize: '1.1em', padding: '4px 6px' }} />
          </Panel>
          <CmdBar v={v} />
        </div>
        <Panel title={v.modTitle} bodyGap={10} style={{ padding: '16px 12px 10px' }}>
          {v.mod === 'tracker' && (
            <div className="hc-scroll">
              <FleetCards v={v} />
              <div className="hc-col" style={{ borderTop: '1px dashed var(--line)', paddingTop: 12, gap: 10 }}><ShipDetail v={v} /></div>
            </div>
          )}
          {/* map stays mounted (hidden) so the chart keeps its measured size */}
          <div style={{ display: v.mod === 'map' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', gap: 10 }}>
            <div className="hc-col" style={{ flex: 'none', height: 300, gap: 6 }}><StarMap v={v} /><Legend /></div>
            <div className="hc-scroll"><WaypointScan v={v} /></div>
          </div>
          {v.mod === 'personal' && <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}><Profile v={v} /></div>}
          {v.mod === 'exchange' && <div className="hc-scroll"><Market v={v} picker /></div>}
          {v.mod === 'contracts' && <div className="hc-scroll"><Contracts v={v} /></div>}
        </Panel>
      </div>
      <div className="hc-statusbar">
        <span>[halcyon] terminal* │ modules</span>
        <span>api.spacetraders.io/v2 · req {v.reqs} · keys 1–7</span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- desktop

function Win({ v, id, title, children, bodyStyle }: V & { id: string; title: React.ReactNode; children: React.ReactNode; bodyStyle?: React.CSSProperties }) {
  const w = v.win[id];
  return (
    <div onMouseDown={w.focus} className="hc-win" style={{ left: w.left, top: w.top, width: w.width, height: w.height, zIndex: w.z, display: w.display, border: `1px solid ${w.border}` }}>
      <div onMouseDown={w.drag} className="hc-win-bar" style={{ background: w.tbg, color: w.tfg }}>
        <span className="hc-ell" style={{ flex: 1, letterSpacing: '.08em' }}>{title}</span>
        <button onClick={w.close} style={{ border: '1px solid currentColor', padding: '0 6px', lineHeight: 1.1 }}>×</button>
      </div>
      <div className="hc-win-body" style={bodyStyle}>{children}</div>
      <div onMouseDown={w.resize} className="hc-win-grip" />
    </div>
  );
}

export function DesktopLayout({ v }: V) {
  return (
    <>
      <TopBar v={v} />
      <div className="hc-desk">
        <div style={{ position: 'absolute', left: 10, top: 12, bottom: 10, width: 96, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {v.deskIcons.map((d: any) => (
            <button key={d.id} onClick={d.onClick} className="hc-acc" style={{ border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: 2, width: 92, flex: 'none' }}>
              <span style={{ width: 38, height: 38, border: `1px solid ${d.ring}`, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5em' }}>{d.glyph}</span>
              <span style={{ fontSize: '.82em', letterSpacing: '.04em', textAlign: 'center', background: 'var(--bg)', padding: '0 3px' }}>{d.label}</span>
            </button>
          ))}
        </div>

        <Win v={v} id="chart" title={<>✦ STAR CHART — {v.system}</>} bodyStyle={{ overflow: 'hidden', gap: 6 }}>
          <StarMap v={v} />
          <Legend />
        </Win>
        <Win v={v} id="nav" title="⌖ NAV INDEX"><WaypointScan v={v} /></Win>
        <Win v={v} id="ship" title="▲ SHIP">
          <div className="hc-col" style={{ gap: 2, paddingBottom: 8, borderBottom: '1px dashed var(--line)' }}><FleetList v={v} /></div>
          <ShipDetail v={v} />
        </Win>
        <Win v={v} id="helm" title="◎ HELM CONTROL">
          <div className="hc-col" style={{ gap: 2 }}><div className="hc-accent">{v.sStatus}</div><div className="hc-dim">{v.sSub}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(128px,1fr))', gap: 8 }}>
            {v.cmds.map((c: any) => (
              <button key={c.key} onClick={c.onClick} disabled={c.disabled} className="hc-fill" style={{ border: '1px solid var(--fg)', padding: '10px 10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textAlign: 'left' }}>
                <span style={{ opacity: .6 }}>[{c.key}]</span><span>{c.label}</span>
              </button>
            ))}
          </div>
        </Win>
        <Win v={v} id="comms" title="≡ COMMS · VESTA" bodyStyle={{ overflow: 'hidden' }}><CommsLog v={v} gap={3} /></Win>
        <Win v={v} id="exchange" title="₡ COMMODITY EXCHANGE"><Market v={v} picker /></Win>
        <Win v={v} id="contracts" title="§ CONTRACTS"><Contracts v={v} /></Win>
        <Win v={v} id="profile" title="@ PERSONAL FILE"><Profile v={v} /></Win>

        {v.startOpen && (
          <div style={{ position: 'absolute', left: 14, bottom: 6, zIndex: 9500, width: 240, border: '1px solid var(--fg)', background: 'var(--bg)', boxShadow: '0 12px 30px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', padding: 6 }}>
            <div className="hc-dim" style={{ letterSpacing: '.12em', padding: '4px 8px 6px', borderBottom: '1px dashed var(--line)', marginBottom: 4 }}>APPLICATIONS</div>
            {v.deskIcons.map((d: any) => (
              <button key={d.id} onClick={d.onStart} className="hc-fill" style={{ display: 'flex', gap: 10, alignItems: 'center', border: 'none', padding: '5px 8px', textAlign: 'left' }}>
                <span style={{ width: '2ch', textAlign: 'center' }}>{d.glyph}</span><span>{d.label}</span>
              </button>
            ))}
          </div>
        )}
        {v.toastShow && (
          <div onClick={v.openComms} style={{ position: 'absolute', right: 18, bottom: 16, zIndex: 9000, maxWidth: 420, border: `1px solid ${v.toastColor}`, background: 'var(--bg)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer', boxShadow: '0 12px 30px rgba(0,0,0,.6)' }}>
            <span className="hc-dim" style={{ letterSpacing: '.1em' }}>INCOMING · VESTA</span>
            <span style={{ color: v.toastColor, textWrap: 'pretty' }}>{v.toastText}</span>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden', marginBottom: -2 }}>
        <button onClick={v.toggleStart} style={{ border: 'none', background: 'var(--fg)', color: 'var(--bg)', textShadow: 'none', padding: '1px 10px', letterSpacing: '.12em', whiteSpace: 'nowrap' }}>◢ HALCYON ▴</button>
        {v.taskItems.map((t: any) => <button key={t.id} onClick={t.onClick} style={{ border: '1px solid var(--line)', padding: '1px 10px', background: t.bg, color: t.fg, textShadow: 'none', whiteSpace: 'nowrap' }}>{t.label}</button>)}
        <span style={{ flex: 1 }} />
        {v.busy && <span className="hc-accent" style={{ whiteSpace: 'nowrap' }}>▓▒░ transmitting…</span>}
        <span className="hc-dim" style={{ whiteSpace: 'nowrap' }}>req {v.reqs}</span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- boot / login overlay

export function BootOverlay({ v }: V) {
  const tabBtn = (on: boolean): React.CSSProperties => ({ border: '1px solid var(--line)', padding: '1px 10px', textShadow: 'none', background: on ? 'var(--fg)' : 'transparent', color: on ? 'var(--bg)' : 'var(--fg)' });
  return (
    <div data-screen-label="Boot" className="hc-boot" style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'color-mix(in srgb, var(--bg) 72%, transparent)', backdropFilter: 'blur(2px)', padding: '32px 40px', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 2, background: 'var(--bg)', border: '1px solid var(--line)', padding: '22px 26px', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
        {v.bootLines.map((l: any) => <div key={l.id} style={{ whiteSpace: 'pre-wrap', color: l.color }}>{l.text}</div>)}
        {v.phase === 'boot' && <div><Cursor /></div>}
        {v.phase === 'login' && (
          <div style={{ position: 'relative', marginTop: 22, border: '1px solid var(--fg)', padding: '20px 18px 16px', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--panel)' }}>
            <div className="hc-panel-title">┤ HOW TO PLAY ├</div>
            <div className="hc-col" style={{ gap: 6 }}>
              <div className="hc-hi">You are a space trader: fly ships, mine, buy and sell goods, and finish contracts for credits.</div>
              <div><span className="hc-accent">1.</span> New here? Choose LAUNCH SIMULATOR. No login is needed and nothing can break.</div>
              <div><span className="hc-accent">2.</span> To play live, use CREATE AGENT with an invite code, or USE TOKEN with your own agent token.</div>
              <div><span className="hc-accent">3.</span> Open CONTRACTS and accept one to see which goods to deliver.</div>
              <div><span className="hc-accent">4.</span> Click a place on the star chart, then choose SET COURSE to fly there.</div>
              <div><span className="hc-accent">5.</span> Use the command buttons or keys 1-7 to act. Mine at an asteroid, then sell at a place tagged M.</div>
              <div><span className="hc-accent">6.</span> LAYOUT and CRT at the top change the look. EJECT signs you out.</div>
            </div>
            <div role="note" style={{ border: '1px solid var(--alert)', color: 'var(--alert)', padding: '8px 10px' }}>
              * WARNING: live tokens reset every week. All agents and progress are erased, and you will have to restart with a new token.{v.resetText && ` Next reset: ${v.resetText} (your time).`}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={v.doDemo} className="hc-hifill" style={{ background: 'var(--fg)', color: 'var(--bg)', textShadow: 'none', border: '1px solid var(--fg)', padding: '3px 14px' }}>▶ LAUNCH SIMULATOR</button>
              {v.hasSession && <button onClick={v.doContinue} disabled={v.busy} className="hc-btn-fg hc-fill">CONTINUE LIVE SESSION</button>}
            </div>
            <div className="hc-rule">LIVE LOGIN</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={v.tabResume} style={tabBtn(v.loginTab === 'resume')}>USE TOKEN</button>
              <button onClick={v.tabRegister} style={tabBtn(v.loginTab === 'register')}>CREATE AGENT</button>
            </div>
            {v.loginTab === 'resume' && (
              <>
                <label className="hc-col" style={{ gap: 4 }}><span className="hc-dim">AGENT TOKEN</span>
                  <input type="password" value={v.tokenIn} onChange={v.onTokenIn} onKeyDown={v.onLoginKey} placeholder="eyJhbGciOi…" className="hc-input" />
                </label>
                <button onClick={v.doLogin} disabled={v.busy} className="hc-fill" style={{ alignSelf: 'flex-start', border: '1px solid var(--fg)', padding: '3px 14px' }}>[ ENTER ] TAKE THE HELM</button>
              </>
            )}
            {v.loginTab === 'register' && (
              <>
                {!v.canCreate && <div className="hc-accent">Creating agents is turned off right now. Use the simulator or your own token.</div>}
                <label className="hc-col" style={{ gap: 4 }}><span className="hc-dim">INVITE CODE</span>
                  <input type="password" autoComplete="off" value={v.inviteIn} onChange={v.onInviteIn} className="hc-input" />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
                  <label className="hc-col" style={{ gap: 4 }}><span className="hc-dim">CALLSIGN (3–14)</span>
                    <input value={v.callIn} onChange={v.onCallIn} placeholder="HALCYON-01" className="hc-input" style={{ textTransform: 'uppercase' }} />
                  </label>
                  <label className="hc-col" style={{ gap: 4 }}><span className="hc-dim">FACTION</span>
                    <select value={v.factionIn} onChange={v.onFactionIn} className="hc-input" style={{ background: 'var(--bg)' }}>
                      {v.factions.map((f: string) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </label>
                </div>
                <button onClick={v.doRegister} disabled={v.busy || !v.canCreate} className="hc-fill" style={{ alignSelf: 'flex-start', border: '1px solid var(--fg)', padding: '3px 14px' }}>[ ENTER ] FILE CHARTER</button>
              </>
            )}
            {v.loginErr && <div style={{ color: 'var(--alert)', whiteSpace: 'pre-wrap' }}>!! {v.loginErr}</div>}
            <div className="hc-dim" style={{ textWrap: 'pretty' }}>Your agent token is kept in a protected cookie and used by this site&apos;s server. Uses the public <a href="https://spacetraders.io" target="_blank" rel="noreferrer">SpaceTraders</a> API. This is an unofficial fan-made client.</div>
          </div>
        )}
      </div>
    </div>
  );
}
