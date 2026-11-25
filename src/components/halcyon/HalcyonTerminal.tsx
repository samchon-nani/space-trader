/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

// HALCYON-OS terminal — ported from the "Space Terminal" Claude Design project.
// One engine (SpaceTraders client + offline simulator) drives three layouts:
// tmux (/terminal), sidebar (/terminal/sidebar) and desktop (/terminal/desktop).

import React from 'react';
import { TmuxLayout, SidebarLayout, DesktopLayout, BootOverlay } from './layouts';
import { cleanCallsign, FACTIONS } from '@/lib/gameRules';

export type Layout = 'tmux' | 'sidebar' | 'desktop';

// Signed-in requests go through our server. Only the public status check goes straight to the game.
const BASE = '/api/st', STATUS_URL = 'https://api.spacetraders.io/v2/', OLD_KEY = 'halcyon-st-token';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const THEMES: Record<string, Record<string, string>> = {
  amber:    { bg:'#0c0804', panel:'#110b05', fg:'#ffb347', dim:'#a07848', hi:'#ffe2b8', line:'#5a3f1f', alert:'#ff5c38', acc:'#fff1a8', glow:'rgba(255,170,60,.45)', font:"var(--font-vt323), 'VT323', monospace", fs:'19px' },
  phosphor: { bg:'#030a05', panel:'#06100a', fg:'#4dff88', dim:'#36a05a', hi:'#c8ffdb', line:'#17552e', alert:'#ff5f56', acc:'#e8ff6a', glow:'rgba(60,255,130,.4)', font:"var(--font-share-tech), 'Share Tech Mono', monospace", fs:'14px' },
  ice:      { bg:'#05080f', panel:'#081020', fg:'#8ccfff', dim:'#5f84aa', hi:'#eef7ff', line:'#1f3a5c', alert:'#ff6b81', acc:'#ffcf6b', glow:'rgba(120,200,255,.32)', font:"var(--font-plex-mono), 'IBM Plex Mono', monospace", fs:'13px' },
};
const GLYPH: Record<string, string> = { PLANET:'O', GAS_GIANT:'@', MOON:'o', ORBITAL_STATION:'#', JUMP_GATE:'%', ASTEROID_FIELD:'*', ASTEROID:'*', ENGINEERED_ASTEROID:'*', ASTEROID_BASE:'&', NEBULA:'~', DEBRIS_FIELD:':', GRAVITY_WELL:'0', ARTIFICIAL_GRAVITY_WELL:'0', FUEL_STATION:'F' };
const code = (s?: string) => s ? (s.split('-').slice(2).join('-') || s) : '—';
const fmtT = (s: number) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s/3600), m = Math.floor(s%3600/60), x = s%60, p = (n: number) => String(n).padStart(2,'0'); return h ? `${h}:${p(m)}:${p(x)}` : `${p(m)}:${p(x)}`; };
const bar = (n: number, max: number, w = 14) => { const f = max > 0 ? Math.round(Math.min(1, n/max) * w) : 0; return '[' + '█'.repeat(f) + '·'.repeat(w - f) + ']'; };
const cr = (n: any) => '₡' + Number(n || 0).toLocaleString('en-US');
const hash = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const KC: Record<string, string> = { cmd:'var(--dim)', sys:'var(--dim)', ai:'var(--hi)', err:'var(--alert)', ok:'var(--fg)' };

// Desktop layout: default window geometry and the app list.
const defaultWins = (W: number, H: number) => { const x0 = 116, D = Math.max(720, W - x0 - 22), Hh = Math.max(480, H - 16), t1 = Math.round(Hh * 0.58);
  const r = (x: number, y: number, w: number, h: number, open: boolean) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), open, z: 1 });
  return { chart: r(x0, 10, D * .5, t1, true), ship: r(x0 + D * .5 + 12, 10, D * .25, t1, true), nav: r(x0 + D * .75 + 24, 10, D * .25 - 24, t1, true), helm: r(x0, t1 + 24, D * .5, Hh - t1 - 30, true), comms: r(x0 + D * .5 + 12, t1 + 24, D * .5 - 12, Hh - t1 - 30, true),
    exchange: r(x0 + 80, 40, Math.min(640, D * .55), Math.min(540, Hh - 60), false), contracts: r(x0 + 160, 70, 480, Math.min(540, Hh - 90), false), profile: r(x0 + 240, 100, 440, 380, false) } as Record<string, any>; };
export const WD: [string, string, string][] = [['chart', '✦', 'STAR CHART'], ['nav', '⌖', 'NAV INDEX'], ['ship', '▲', 'SHIP'], ['helm', '◎', 'HELM'], ['exchange', '₡', 'EXCHANGE'], ['contracts', '§', 'CONTRACTS'], ['profile', '@', 'PROFILE'], ['comms', '≡', 'COMMS']];

type Props = { layout: Layout; theme?: string; scanlines?: boolean; sound?: boolean; typeSpeed?: number };

export default class HalcyonTerminal extends React.Component<Props, any> {
  state: any = { phase:'boot', boot:[], log:[], tokenIn:'', inviteIn:'', canCreate:false, hasSession:false, resetAt:null, callIn:'', factionIn:'COSMIC', loginTab:'resume', loginErr:'', busy:false,
    agent:null, ships:[], shipSel:null, contracts:[], waypoints:{}, system:null, selWp:null, markets:{}, mktLoading:null, tab:'scan', mod:'tracker',
    wins: defaultWins(typeof window === 'undefined' ? 1440 : window.innerWidth, (typeof window === 'undefined' ? 900 : window.innerHeight) - 110), focus:'chart', startOpen:false,
    now:Date.now(), mute:false, mapCols:60, mapRows:18, reqs:0, theme:null };
  rootRef = React.createRef<HTMLDivElement>(); mapRef = React.createRef<HTMLDivElement>(); probeRef = React.createRef<HTMLSpanElement>(); conRef = React.createRef<HTMLDivElement>();
  _id = 0; _last = 0; _arr: Record<string, number> = {}; _tc = 0; _z = 10;
  _tick: any; _clk: any; _ro: ResizeObserver | null = null; _roEl: Element | null = null; _kd: any; _mm: any; _mu: any;
  _appliedTheme?: string; _lastMeasure?: number; _scrolled?: string; _endLog?: number; _endBoot?: number; _aiTyping?: number;
  _ac?: AudioContext; _cmds: any[] = []; _drag: any = null; _mk?: string; _mrows: any[] = [];
  demo = false; _mock: any;
  _session = 0; // goes up on logout, so work left over from an old session stops

  componentDidMount() {
    this.applyTheme();
    this._tick = setInterval(() => this.tick(), 30);
    this._clk = setInterval(() => this.clock(), 1000);
    if (document.fonts) document.fonts.ready.then(() => this.measure());
    this._kd = (e: KeyboardEvent) => this.onKey(e); window.addEventListener('keydown', this._kd);
    this._mm = (e: MouseEvent) => this.onMove(e); this._mu = () => { this._drag = null; };
    window.addEventListener('mousemove', this._mm); window.addEventListener('mouseup', this._mu);
    this.bootSeq();
  }
  componentWillUnmount() {
    clearInterval(this._tick); clearInterval(this._clk); this._ro?.disconnect();
    window.removeEventListener('keydown', this._kd); window.removeEventListener('mousemove', this._mm); window.removeEventListener('mouseup', this._mu);
  }
  componentDidUpdate(pp: Props, ps: any) {
    if (pp.theme !== this.props.theme || ps.theme !== this.state.theme || pp.layout !== this.props.layout) { this.applyTheme(); setTimeout(() => this.measure(), 80); }
    if (pp.layout !== this.props.layout) this._scrolled = undefined; // new comms element: re-pin it to the bottom
    if (ps.log !== this.state.log && this.conRef.current) { const c = this.conRef.current; c.scrollTop = c.scrollHeight; }
  }
  themeKey() { return this.state.theme || this.props.theme || 'amber'; }
  applyTheme() { const t = THEMES[this.themeKey()] || THEMES.amber, el = this.rootRef.current; if (!el) return; this._appliedTheme = this.themeKey(); Object.keys(t).forEach(k => el.style.setProperty('--' + k, t[k])); document.body.style.background = t.bg; }
  measure() {
    const m = this.mapRef.current, p = this.probeRef.current;
    // The map element is swapped when the layout route changes; keep observing the live one.
    if (m && m !== this._roEl && window.ResizeObserver) { this._ro?.disconnect(); this._ro = new ResizeObserver(() => this.measure()); this._ro.observe(m); this._roEl = m; }
    if (!m || !p || !m.clientWidth) return;
    const r = p.getBoundingClientRect(), cw = r.width / 20, lh = r.height; if (!cw || !lh) return;
    const cols = Math.max(20, Math.floor(m.clientWidth / cw) - 1), rows = Math.max(6, Math.floor(m.clientHeight / lh) - 1);
    if (cols !== this.state.mapCols || rows !== this.state.mapRows) this.setState({ mapCols: cols, mapRows: rows });
  }

  // ---- audio
  blip(f = 880, d = .05, type: OscillatorType = 'square', g = .04) {
    if (this.state.mute || this.props.sound === false) return;
    if (!this._ac && !((navigator as any).userActivation && (navigator as any).userActivation.hasBeenActive)) return;
    try { const C = this._ac || (this._ac = new (window.AudioContext || (window as any).webkitAudioContext)()); if (C.state === 'suspended') { C.resume().catch(() => {}); return; }
      const o = C.createOscillator(), gn = C.createGain(); o.type = type; o.frequency.value = f;
      gn.gain.setValueAtTime(g, C.currentTime); gn.gain.exponentialRampToValueAtTime(.0001, C.currentTime + d);
      o.connect(gn); gn.connect(C.destination); o.start(); o.stop(C.currentTime + d + .02); } catch {}
  }
  click() { this.blip(1250, .03, 'square', .03); }
  chime() { this.blip(660, .14, 'sine', .06); setTimeout(() => this.blip(990, .22, 'sine', .06), 130); }
  errTone() { this.blip(140, .28, 'sawtooth', .05); }

  // ---- typewriter
  tick() {
    const t = Date.now();
    if (t - (this._lastMeasure || 0) > 400) { this._lastMeasure = t; this.measure(); }
    if (this.themeKey() !== this._appliedTheme) { this.applyTheme(); setTimeout(() => this.measure(), 80); if (document.fonts) document.fonts.ready.then(() => this.measure()); }
    const c = this.conRef.current, n = this.state.log.length ? this.state.log[this.state.log.length - 1].id + ':' + (t < (this._endLog || 0) + 60 ? Math.floor(t / 90) : 'x') : '';
    if (c && n !== this._scrolled) { this._scrolled = n; c.scrollTop = c.scrollHeight; }
    if (t < (this._endLog || 0) + 40 || t < (this._endBoot || 0) + 40) {
      this.setState({ f: t });
      if (++this._tc % 3 === 0 && (t < (this._endBoot || 0) || (this._aiTyping || 0) > t)) this.blip(1500 + Math.random() * 500, .012, 'square', .015);
    }
  }
  entry(kind: string, text: string, endKey: '_endLog' | '_endBoot') {
    const sp = this.props.typeSpeed ?? 3, cps = sp >= 12 ? 1e6 : (kind === 'ai' ? sp * 45 : sp * 180);
    const t0 = Math.max(Date.now(), this[endKey] || 0), dur = Math.max(1, text.length / cps * 1000);
    this[endKey] = t0 + dur; if (kind === 'ai') this._aiTyping = t0 + dur;
    return { id: ++this._id, kind, text, t0, dur };
  }
  say(kind: string, text: string) { if (text.endsWith('session closed')) return; const e = this.entry(kind, text, '_endLog'); this.setState((s: any) => ({ log: [...s.log.slice(-200), e] })); }
  bootSay(text: string, kind = 'sys') { const e = this.entry(kind, text, '_endBoot'); this.setState((s: any) => ({ boot: [...s.boot, e] })); }

  async bootSeq() {
    const L = (t: string, k?: string) => this.bootSay(t, k);
    L('HALCYON-OS 4.2.1  ::  DEEP-RANGE MERCANTILE TERMINAL', 'ai');
    L('(c) Halcyon Shipwrights Combine — licensed to independent haulers');
    await sleep(500);
    L('power-on self test ................ ok'); L('core memory 65536K ................ ok'); L('reactor telemetry ................. nominal'); L('hull integrity .................... 100%');
    await sleep(500);
    L('opening subspace relay → api.spacetraders.io/v2');
    try {
      const r = await fetch(STATUS_URL); const j = await r.json();
      L('relay handshake ................... ok', 'ok');
      L(`server status: ${j.status || 'unknown'}`);
      if (j.stats) L(`universe: ${(j.stats.agents ?? '?').toLocaleString()} agents · ${(j.stats.ships ?? '?').toLocaleString()} ships · ${(j.stats.systems ?? '?').toLocaleString()} systems`);
      if (j.serverResets && j.serverResets.next) this.setState({ resetAt: j.serverResets.next });
      if (j.serverResets && j.serverResets.next) L(`next universe reset: ${new Date(j.serverResets.next).toUTCString()}`);
    } catch (e: any) { L('relay handshake ................... FAILED', 'err'); L('  ' + e.message, 'err'); }
    await sleep(700);
    try { localStorage.removeItem(OLD_KEY); } catch {} // older versions kept the token in the browser
    let session = { active: false, canCreate: false };
    try { session = await (await fetch('/api/session')).json(); } catch {}
    L(session.active ? 'VESTA: Welcome back, Captain. Your session is still open.' : 'VESTA: Good to have you aboard, Captain. Pick how you want to play.', 'ai');
    this.setState({ phase: 'login', hasSession: session.active, canCreate: session.canCreate });
  }

  // ---- API
  async api(method: string, path: string, body?: any, o: any = {}): Promise<any> {
    const session = this._session, w = Math.max(0, this._last + 520 - Date.now()); this._last = Date.now() + w; if (w) await sleep(w);
    const current = () => { if (session !== this._session) throw new Error('session closed'); };
    current();
    if (!o.quiet) this.say('cmd', `> ${method} ${path}`);
    if (this.demo) { await sleep(160); current(); this.setState((s: any) => ({ reqs: s.reqs + 1 })); return this.mockApi(method, path, body); }
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    let r: Response; try { r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); } catch (e: any) { throw new Error('relay unreachable — ' + e.message); }
    this.setState((s: any) => ({ reqs: s.reqs + 1 }));
    let j: any = null; try { j = await r.json(); } catch {}
    current();
    if (r.status === 429 && !o.retried) { const ra = (j && j.error && j.error.data && j.error.data.retryAfter) || 1; await sleep(ra * 1000 + 150); current(); return this.api(method, path, body, { ...o, retried: true, quiet: true }); }
    if (!r.ok) throw new Error((j && j.error && j.error.message) || `HTTP ${r.status}`);
    return j;
  }
  async run(fn: () => Promise<void>) {
    if (this.state.busy) return; this.click(); this.setState({ busy: true });
    try { await fn(); } catch (e: any) { this.errTone(); this.say('err', '!! ' + e.message); } finally { this.setState({ busy: false }); }
  }
  cur(): any { return this.state.ships.find((s: any) => s.symbol === this.state.shipSel); }
  updShip(sym: string, patch: any) { this.setState((s: any) => ({ ships: s.ships.map((x: any) => x.symbol === sym ? { ...x, ...patch } : x) })); }
  hasTrait(w: any, t: string) { return !!(w && w.traits && w.traits.some((x: any) => x.symbol === t)); }
  tn(t?: string) { return (t || '').replace(/_/g, ' ').toLowerCase(); }
  needs() { const n = new Set<string>(); this.state.contracts.forEach((c: any) => { if (c.accepted && !c.fulfilled) (c.terms.deliver || []).forEach((t: any) => { if (t.unitsFulfilled < t.unitsRequired) n.add(t.tradeSymbol); }); }); return n; }
  async ensure(st: string) {
    const s = this.cur(); if (!s) throw new Error('no ship selected'); if (s.nav.status === st) return;
    if (s.nav.status === 'IN_TRANSIT') throw new Error(`${s.symbol} is in transit`);
    const j = await this.api('POST', `/my/ships/${s.symbol}/${st === 'DOCKED' ? 'dock' : 'orbit'}`);
    this.updShip(s.symbol, { nav: j.data.nav }); s.nav = j.data.nav;
    this.say('sys', st === 'DOCKED' ? '  docking clamps engaged' : '  clamps released — holding orbit');
  }

  async loadAll() {
    const a = await this.api('GET', '/my/agent'), sh = await this.api('GET', '/my/ships?limit=20'), c = await this.api('GET', '/my/contracts?limit=20');
    const ships = sh.data, first = ships[0];
    this.setState({ agent: a.data, ships, contracts: c.data, shipSel: first && first.symbol, selWp: first && first.nav.waypointSymbol });
    if (!first) return;
    await this.loadSystem(first.nav.systemSymbol);
    const W = this.state.waypoints;
    this.say('ai', `VESTA: Treasury holds ${cr(a.data.credits)}. ${ships.length} hull${ships.length > 1 ? 's' : ''} in the fleet. ${first.symbol} is ${this.tn(first.nav.status)} at ${code(first.nav.waypointSymbol)}.`);
    const off = c.data.find((x: any) => !x.accepted), act = c.data.find((x: any) => x.accepted && !x.fulfilled);
    const ts = (x: any) => (x.terms.deliver || []).map((t: any) => `${t.unitsRequired - t.unitsFulfilled} ${t.tradeSymbol} to ${code(t.destinationSymbol)}`).join(', ');
    if (act) this.say('ai', `VESTA: Standing orders — deliver ${ts(act)}.`);
    else if (off) this.say('ai', `VESTA: ${off.factionSymbol} left a contract on the desk: ${ts(off)}. Pays ${cr(off.terms.payment.onAccepted + off.terms.payment.onFulfilled)}. See CONTRACTS.`);
    const vals: any[] = Object.values(W);
    const rock = vals.find(w => w.type === 'ENGINEERED_ASTEROID') || vals.find(w => /ASTEROID/.test(w.type) && w.type !== 'ASTEROID_BASE');
    if (rock) this.say('ai', `VESTA: Nearest minable rock is ${code(rock.symbol)}. Click it on the chart, [3] to fly, [4] to mine, then [6] sells at any market.`);
    const lw = W[first.nav.waypointSymbol]; if (this.hasTrait(lw, 'MARKETPLACE')) this.loadMarket(lw.symbol, true);
  }
  async loadSystem(sys: string) {
    this.say('sys', `  scanning system ${sys} …`);
    let page = 1, all: any[] = [];
    for (;;) { const j = await this.api('GET', `/systems/${sys}/waypoints?limit=20&page=${page}`, null, { quiet: true }); all = all.concat(j.data); if (all.length >= j.meta.total || page >= 8 || !j.data.length) break; page++; }
    const map: Record<string, any> = {}; all.forEach(w => map[w.symbol] = w);
    this.setState({ waypoints: map, system: sys });
    this.say('sys', `  ${all.length} waypoints charted`);
  }
  async loadMarket(wp: string, quiet?: boolean) {
    const sys = wp.split('-').slice(0, 2).join('-'); this.setState({ mktLoading: wp });
    try { const j = await this.api('GET', `/systems/${sys}/waypoints/${wp}/market`, null, { quiet });
      this.setState((s: any) => ({ markets: { ...s.markets, [wp]: { ...j.data, _t: Date.now() } } })); return j.data;
    } catch (e: any) { this.say('err', '!! market: ' + e.message); } finally { this.setState({ mktLoading: null }); }
  }
  async arrive(sym: string) {
    try { const j = await this.api('GET', `/my/ships/${sym}`, null, { quiet: true }); this.updShip(sym, j.data);
      if (j.data.nav.status === 'IN_TRANSIT') return;
      const wp = j.data.nav.waypointSymbol, w = this.state.waypoints[wp]; this.chime();
      this.say('ai', `VESTA: ${sym} has arrived at ${code(wp)}${w ? ' — ' + this.tn(w.type) : ''}.${this.hasTrait(w, 'MARKETPLACE') ? ' Marketplace on the beacon.' : ''}`);
      if (this.hasTrait(w, 'MARKETPLACE')) this.loadMarket(wp, true);
    } catch (e: any) { this.say('err', '!! ' + e.message); } finally { setTimeout(() => { delete this._arr[sym]; }, 3000); }
  }
  clock() {
    const now = Date.now(); this.setState({ now });
    this.state.ships.forEach((s: any) => { if (s.nav.status === 'IN_TRANSIT' && new Date(s.nav.route.arrival).getTime() + 1200 <= now && !this._arr[s.symbol]) { this._arr[s.symbol] = 1; this.arrive(s.symbol); } });
  }
  onKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return; // leave browser shortcuts alone
    if (this.state.phase !== 'cockpit' || /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) return;
    const c = this._cmds.find(c => c.key === e.key); if (c && c.enabled) c.onClick();
  }

  // ---- layout-specific navigation
  pickMarket() { const W = this.state.waypoints, s = this.cur(); let k = this.state.selWp; if (!k || !this.hasTrait(W[k], 'MARKETPLACE')) k = s && this.hasTrait(W[s.nav.waypointSymbol], 'MARKETPLACE') ? s.nav.waypointSymbol : ((Object.values(W) as any[]).find(w => this.hasTrait(w, 'MARKETPLACE')) || {}).symbol; if (k) this.selectWp(k); }
  goScan() { const l = this.props.layout; if (l === 'desktop') this.openWin('nav'); else this.setState(l === 'sidebar' ? { mod: 'map', tab: 'scan' } : { tab: 'scan' }); }
  goMarket() { const l = this.props.layout; if (l === 'desktop') { this.openWin('exchange'); this.pickMarket(); } else if (l === 'sidebar') this.setMod('exchange'); else { this.click(); this.setState({ tab: 'mkt' }); } }
  setMod(id: string) { this.click(); this.setState({ mod: id }); if (id === 'exchange') this.pickMarket(); }
  focusWin(id: string) { if (this.state.focus === id && this.state.wins[id].z === this._z) return; const z = ++this._z; this.setState((s: any) => ({ focus: id, wins: { ...s.wins, [id]: { ...s.wins[id], z } } })); }
  openWin(id: string) { this.click(); const z = ++this._z; this.setState((s: any) => ({ focus: id, wins: { ...s.wins, [id]: { ...s.wins[id], open: true, z } } })); }
  closeWin(id: string) { this.click(); this.setState((s: any) => ({ wins: { ...s.wins, [id]: { ...s.wins[id], open: false } } })); }
  startDrag(id: string, mode: string, e: React.MouseEvent) { const w = this.state.wins[id]; this._drag = { id, mode, sx: e.clientX, sy: e.clientY, ox: w.x, oy: w.y, ow: w.w, oh: w.h }; if ((e.target as HTMLElement).tagName !== 'BUTTON') e.preventDefault(); this.focusWin(id); }
  onMove(e: MouseEvent) { const d = this._drag; if (!d) return; const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    this.setState((s: any) => { const w = { ...s.wins[d.id] }; if (d.mode === 'move') { w.x = Math.max(-w.w + 100, d.ox + dx); w.y = Math.max(0, d.oy + dy); } else { w.w = Math.max(280, d.ow + dx); w.h = Math.max(150, d.oh + dy); } return { wins: { ...s.wins, [d.id]: w } }; }); }

  // ---- actions
  selectWp = (sym: string) => { this.click(); this.setState({ selWp: sym }); const w = this.state.waypoints[sym], m = this.state.markets[sym];
    if (this.hasTrait(w, 'MARKETPLACE') && (!m || Date.now() - m._t > 60000)) this.loadMarket(sym, true); };
  doOrbit = () => this.run(async () => { await this.ensure('IN_ORBIT'); this.say('ai', `VESTA: Holding orbit over ${code(this.cur().nav.waypointSymbol)}. Engines warm.`); });
  doDock = () => this.run(async () => { await this.ensure('DOCKED'); this.say('ai', `VESTA: Docked at ${code(this.cur().nav.waypointSymbol)}. Station services available.`); });
  doNav = () => this.run(async () => {
    const s = this.cur(), d = this.state.selWp; if (!d || d === s.nav.waypointSymbol) throw new Error('select a different waypoint on the chart first');
    await this.ensure('IN_ORBIT');
    const j = await this.api('POST', `/my/ships/${s.symbol}/navigate`, { waypointSymbol: d });
    this.updShip(s.symbol, { nav: j.data.nav, fuel: j.data.fuel });
    const secs = (new Date(j.data.nav.route.arrival).getTime() - Date.now()) / 1000; this.blip(180, .5, 'triangle', .06);
    this.say('ai', `VESTA: Course laid in for ${code(d)}. Burn time ${fmtT(secs)}, ${j.data.fuel.consumed ? j.data.fuel.consumed.amount : 0} fuel spent. Sit back, Captain.`);
  });
  doExtract = () => this.run(async () => {
    const s = this.cur(); await this.ensure('IN_ORBIT');
    const j = await this.api('POST', `/my/ships/${s.symbol}/extract`);
    this.updShip(s.symbol, { cargo: j.data.cargo, cooldown: j.data.cooldown }); const y = j.data.extraction.yield; this.blip(520, .2, 'sawtooth', .03);
    this.say('ai', `VESTA: Laser cycle complete. +${y.units} ${y.symbol}. Hold ${j.data.cargo.units}/${j.data.cargo.capacity}. Capacitors recharge in ${j.data.cooldown.remainingSeconds}s.`);
  });
  doRefuel = () => this.run(async () => {
    const s = this.cur(); await this.ensure('DOCKED');
    const j = await this.api('POST', `/my/ships/${s.symbol}/refuel`);
    this.updShip(s.symbol, { fuel: j.data.fuel }); this.setState({ agent: j.data.agent });
    this.say('ai', `VESTA: Tanks topped off — ${j.data.transaction.units} units for ${cr(j.data.transaction.totalPrice)}.`);
  });
  async sellItem(s: any, sym: string, units: number, m: any) {
    const g = m && m.tradeGoods && m.tradeGoods.find((g: any) => g.symbol === sym); let left = units, total = 0;
    while (left > 0) { const u = g ? Math.min(left, g.tradeVolume) : left;
      const j = await this.api('POST', `/my/ships/${s.symbol}/sell`, { symbol: sym, units: u });
      total += j.data.transaction.totalPrice; left -= u; this.updShip(s.symbol, { cargo: j.data.cargo }); s.cargo = j.data.cargo; this.setState({ agent: j.data.agent }); }
    return total;
  }
  doSellAll = () => this.run(async () => {
    const s = this.cur(); await this.ensure('DOCKED'); const wp = s.nav.waypointSymbol;
    let m = this.state.markets[wp]; if (!m || !m.tradeGoods) m = await this.loadMarket(wp, true);
    const need = this.needs(); let total = 0;
    for (const it of s.cargo.inventory.slice()) {
      if (need.has(it.symbol)) { this.say('sys', `  holding ${it.symbol} for contract`); continue; }
      if (!(m && m.tradeGoods && m.tradeGoods.find((g: any) => g.symbol === it.symbol))) continue;
      total += await this.sellItem(s, it.symbol, it.units, m);
    }
    if (total) { this.chime(); this.say('ai', `VESTA: Sold the lot for ${cr(total)}. Pleasure doing business.`); } else this.say('ai', 'VESTA: Nothing in the hold this market wants.');
    this.loadMarket(wp, true);
  });
  doSellOne = (sym: string) => this.run(async () => {
    const s = this.cur(); await this.ensure('DOCKED'); const it = s.cargo.inventory.find((i: any) => i.symbol === sym); if (!it) throw new Error('not in hold');
    const total = await this.sellItem(s, sym, it.units, this.state.markets[s.nav.waypointSymbol]); this.chime();
    this.say('ai', `VESTA: ${it.units} ${sym} sold for ${cr(total)}.`); this.loadMarket(s.nav.waypointSymbol, true);
  });
  doBuy = (sym: string) => this.run(async () => {
    const s = this.cur(); await this.ensure('DOCKED'); const m = this.state.markets[s.nav.waypointSymbol];
    const g = m && m.tradeGoods && m.tradeGoods.find((g: any) => g.symbol === sym); const room = s.cargo.capacity - s.cargo.units;
    const units = Math.min(room, g ? g.tradeVolume : room); if (units <= 0) throw new Error('hold is full');
    const j = await this.api('POST', `/my/ships/${s.symbol}/purchase`, { symbol: sym, units });
    this.updShip(s.symbol, { cargo: j.data.cargo }); this.setState({ agent: j.data.agent });
    this.say('ai', `VESTA: Loaded ${units} ${sym} for ${cr(j.data.transaction.totalPrice)}.`); this.loadMarket(s.nav.waypointSymbol, true);
  });
  setContract(c: any) { this.setState((s: any) => ({ contracts: s.contracts.map((x: any) => x.id === c.id ? c : x) })); }
  doAccept = (id: string) => this.run(async () => { const j = await this.api('POST', `/my/contracts/${id}/accept`); this.setContract(j.data.contract); this.setState({ agent: j.data.agent }); this.chime(); this.say('ai', `VESTA: Contract signed. Advance of ${cr(j.data.contract.terms.payment.onAccepted)} received.`); });
  doDeliver = (id: string, trade: string, rem: number) => this.run(async () => {
    const s = this.cur(); await this.ensure('DOCKED'); const it = s.cargo.inventory.find((i: any) => i.symbol === trade); if (!it) throw new Error(`no ${trade} aboard`);
    const j = await this.api('POST', `/my/contracts/${id}/deliver`, { shipSymbol: s.symbol, tradeSymbol: trade, units: Math.min(it.units, rem) });
    this.setContract(j.data.contract); this.updShip(s.symbol, { cargo: j.data.cargo });
    const t = j.data.contract.terms.deliver.find((t: any) => t.tradeSymbol === trade); this.say('ai', `VESTA: Delivered. ${t.unitsFulfilled}/${t.unitsRequired} ${trade} on the books.`);
  });
  doFulfill = (id: string) => this.run(async () => { const j = await this.api('POST', `/my/contracts/${id}/fulfill`); this.setContract(j.data.contract); this.setState({ agent: j.data.agent }); this.chime(); this.say('ai', `VESTA: Contract fulfilled. ${cr(j.data.contract.terms.payment.onFulfilled)} wired to the treasury.`); });
  doNegotiate = () => this.run(async () => { const s = this.cur(); await this.ensure('DOCKED'); const j = await this.api('POST', `/my/ships/${s.symbol}/negotiate/contract`); this.setState((st: any) => ({ contracts: [...st.contracts, j.data.contract] })); this.say('ai', 'VESTA: New terms on the table.'); });
  doRefresh = () => this.run(async () => {
    const a = await this.api('GET', '/my/agent'), sh = await this.api('GET', '/my/ships?limit=20'), c = await this.api('GET', '/my/contracts?limit=20');
    this.setState({ agent: a.data, ships: sh.data, contracts: c.data }); this.say('sys', '  telemetry refreshed');
  });
  async runLogin(fn: () => Promise<void>) { this.click(); this.setState({ busy: true, loginErr: '' }); try { await fn(); } catch (e: any) { this.errTone(); this.setState({ loginErr: e.message }); } finally { this.setState({ busy: false }); } }
  enter() { this.setState({ phase: 'cockpit' }); this.chime(); this.say('sys', 'HALCYON-OS :: helm unlocked'); this.loadAll().catch(e => { this.errTone(); this.say('err', '!! ' + e.message); }); }
  async signIn(body: any) {
    const r = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error((j && j.error && j.error.message) || 'sign in failed');
    this.demo = false; this.setState({ tokenIn: '', inviteIn: '', hasSession: true }); return j.data.agent;
  }
  doLogin = () => this.runLogin(async () => {
    const t = this.state.tokenIn.trim(); if (!t) throw new Error('agent token required');
    await this.signIn({ mode: 'token', token: t }); this.enter();
  });
  doContinue = () => this.runLogin(async () => {
    this.demo = false;
    try { await this.api('GET', '/my/agent', null, { quiet: true }); } catch (e) { this.setState({ hasSession: false }); throw e; }
    this.enter();
  });
  doRegister = () => this.runLogin(async () => {
    const symbol = cleanCallsign(this.state.callIn); if (!symbol) throw new Error('callsign must be 3–14 letters, numbers, dashes or underscores');
    const agent = await this.signIn({ mode: 'create', symbol, faction: this.state.factionIn, invite: this.state.inviteIn });
    this.enter(); this.say('ai', `VESTA: Charter granted. Welcome to the ${this.state.factionIn} sphere, ${agent.symbol}.`);
  });
  logout = () => { this.click(); this._session++; this._arr = {}; if (!this.demo) { fetch('/api/session', { method: 'DELETE' }).catch(() => {}); this.setState({ hasSession: false }); } this.demo = false;
    this.setState({ phase: 'login', agent: null, ships: [], contracts: [], waypoints: {}, markets: {}, selWp: null, shipSel: null, system: null, log: [], tokenIn: '', loginErr: '' });
    this.bootSay('VESTA: Session sealed. Standing by.', 'ai'); };

  // ---- offline simulator
  buildDemo() {
    const S = 'X1-HV7', wp = (c: string, type: string, x: number, y: number, traits: string[], orbits?: string) => ({ symbol: S + '-' + c, systemSymbol: S, type, x, y, orbitals: [] as any[], orbits: orbits ? S + '-' + orbits : undefined, traits: traits.map(t => ({ symbol: t, name: t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, m => m.toUpperCase()) })) });
    const list = [wp('A1', 'PLANET', 12, -8, ['MARKETPLACE', 'SHIPYARD', 'TEMPERATE']), wp('A2', 'MOON', 12, -8, ['MARKETPLACE', 'OUTPOST'], 'A1'), wp('A3', 'ORBITAL_STATION', 12, -8, ['MARKETPLACE', 'FUEL'], 'A1'),
      wp('B7', 'GAS_GIANT', -44, 22, ['MARKETPLACE', 'STRONG_GRAVITY']), wp('B8', 'ORBITAL_STATION', -44, 22, ['MARKETPLACE'], 'B7'), wp('C3', 'ENGINEERED_ASTEROID', 30, 18, ['COMMON_METAL_DEPOSITS', 'STRIPPED']),
      wp('D9', 'ASTEROID', 58, -34, ['MINERAL_DEPOSITS']), wp('D10', 'ASTEROID', 66, -28, ['PRECIOUS_METAL_DEPOSITS', 'UNSTABLE_COMPOSITION']), wp('E2', 'PLANET', -20, -52, ['MARKETPLACE', 'OCEAN', 'SHIPYARD']),
      wp('F5', 'JUMP_GATE', 80, 40, []), wp('G1', 'ASTEROID_BASE', -70, -18, ['MARKETPLACE', 'PIRATE_BASE']), wp('H2', 'PLANET', 44, 52, ['MARKETPLACE', 'INDUSTRIAL']), wp('H3', 'MOON', 44, 52, ['BARREN'], 'H2'),
      wp('J4', 'FUEL_STATION', -6, 34, ['MARKETPLACE', 'FUEL']), wp('K8', 'NEBULA', -62, 60, [])];
    const W: Record<string, any> = {}; list.forEach(w => W[w.symbol] = w); list.forEach(w => { if (w.orbits) W[w.orbits].orbitals.push({ symbol: w.symbol }); });
    const G = (s: string, t: string, b: number, sl: number, sup?: string) => ({ symbol: s, type: t, tradeVolume: 20, supply: sup || 'MODERATE', purchasePrice: b, sellPrice: sl });
    const M: Record<string, any[]> = { 'A1': [G('IRON_ORE', 'IMPORT', 52, 48), G('COPPER_ORE', 'IMPORT', 61, 57), G('FOOD', 'EXPORT', 38, 30, 'HIGH'), G('FUEL', 'EXCHANGE', 72, 66)], 'A2': [G('QUARTZ_SAND', 'IMPORT', 30, 27), G('MEDICINE', 'EXPORT', 210, 190)],
      'A3': [G('FUEL', 'EXCHANGE', 70, 64), G('ALUMINUM_ORE', 'IMPORT', 66, 62)], 'B7': [G('HYDROCARBON', 'EXPORT', 44, 38, 'ABUNDANT'), G('FUEL', 'EXCHANGE', 75, 69)], 'B8': [G('IRON_ORE', 'IMPORT', 58, 55, 'SCARCE'), G('ELECTRONICS', 'EXPORT', 320, 290)],
      'E2': [G('ALUMINUM_ORE', 'IMPORT', 71, 68, 'LIMITED'), G('COPPER_ORE', 'IMPORT', 66, 63), G('FOOD', 'IMPORT', 46, 42)], 'G1': [G('PRECIOUS_STONES', 'IMPORT', 140, 132), G('FUEL', 'EXCHANGE', 95, 88)],
      'H2': [G('IRON_ORE', 'IMPORT', 55, 51), G('MACHINERY', 'EXPORT', 260, 240), G('FUEL', 'EXCHANGE', 74, 68)], 'J4': [G('FUEL', 'EXCHANGE', 62, 58, 'ABUNDANT')] };
    const markets: Record<string, any[]> = {}; Object.entries(M).forEach(([k, g]) => markets[S + '-' + k] = g);
    const ship = (sym: string, role: string, frame: string, at: string, status: string, fuel: number, cap: number, inv: any[]) => ({ symbol: sym, registration: { role }, frame: { name: frame }, nav: { systemSymbol: S, waypointSymbol: S + '-' + at, status, flightMode: 'CRUISE', route: { origin: { symbol: S + '-' + at, x: W[S + '-' + at].x, y: W[S + '-' + at].y }, destination: { symbol: S + '-' + at, x: W[S + '-' + at].x, y: W[S + '-' + at].y }, departureTime: new Date().toISOString(), arrival: new Date().toISOString() } }, fuel: { current: fuel, capacity: fuel }, cargo: { capacity: cap, units: inv.reduce((a, i) => a + i.units, 0), inventory: inv }, cooldown: { remainingSeconds: 0, expiration: null } });
    const dl = new Date(Date.now() + 6 * 864e5).toISOString();
    this._mock = { W, markets, agent: { accountId: 'demo-sim', symbol: 'HALCYON', headquarters: S + '-A1', credits: 175000, startingFaction: 'COSMIC', shipCount: 2 },
      ships: [ship('HALCYON-1', 'COMMAND', 'Frigate', 'A1', 'DOCKED', 400, 40, [{ symbol: 'QUARTZ_SAND', name: 'Quartz Sand', units: 6 }]), ship('HALCYON-2', 'SATELLITE', 'Probe', 'H2', 'IN_ORBIT', 0, 0, [])],
      contracts: [{ id: 'demo-ct-7f3a91', factionSymbol: 'COSMIC', type: 'PROCUREMENT', accepted: false, fulfilled: false, terms: { deadline: dl, payment: { onAccepted: 12400, onFulfilled: 68200 }, deliver: [{ tradeSymbol: 'IRON_ORE', destinationSymbol: S + '-H2', unitsRequired: 30, unitsFulfilled: 0 }] } }] };
  }
  mockApi(method: string, path: string, body: any): any {
    const m = this._mock, P = path.split('?')[0].split('/').filter(Boolean), ok = (d: any) => ({ data: d }), fail = (msg: string): never => { throw new Error(msg); };
    const sh = (sym: string) => m.ships.find((s: any) => s.symbol === sym) || fail('ship not found'), now = Date.now(), cl = (o: any) => JSON.parse(JSON.stringify(o));
    const settle = (s: any) => { if (s.nav.status === 'IN_TRANSIT' && new Date(s.nav.route.arrival).getTime() <= now) { s.nav.status = 'IN_ORBIT'; s.nav.waypointSymbol = s.nav.route.destination.symbol; } };
    const recount = (s: any) => { s.cargo.inventory = s.cargo.inventory.filter((i: any) => i.units > 0); s.cargo.units = s.cargo.inventory.reduce((a: number, i: any) => a + i.units, 0); };
    const add = (s: any, sym: string, u: number) => { const it = s.cargo.inventory.find((i: any) => i.symbol === sym); if (it) it.units += u; else s.cargo.inventory.push({ symbol: sym, name: sym, units: u }); recount(s); };
    m.ships.forEach(settle);
    if (P[0] === 'my' && P[1] === 'agent') return ok(cl(m.agent));
    if (P[0] === 'my' && P[1] === 'contracts') {
      if (!P[2]) return ok(cl(m.contracts));
      const c = m.contracts.find((c: any) => c.id === P[2]) || fail('contract not found');
      if (P[3] === 'accept') { if (c.accepted) fail('contract already accepted'); c.accepted = true; m.agent.credits += c.terms.payment.onAccepted; return ok({ contract: cl(c), agent: cl(m.agent) }); }
      if (P[3] === 'deliver') { const s = sh(body.shipSymbol); if (s.nav.status !== 'DOCKED') fail('ship must be docked'); const t = c.terms.deliver.find((t: any) => t.tradeSymbol === body.tradeSymbol); if (!t || s.nav.waypointSymbol !== t.destinationSymbol) fail('wrong destination for delivery');
        const u = Math.min(body.units, t.unitsRequired - t.unitsFulfilled); add(s, body.tradeSymbol, -u); t.unitsFulfilled += u; return ok({ contract: cl(c), cargo: cl(s.cargo) }); }
      if (P[3] === 'fulfill') { if (!c.terms.deliver.every((t: any) => t.unitsFulfilled >= t.unitsRequired)) fail('terms not met'); c.fulfilled = true; m.agent.credits += c.terms.payment.onFulfilled; return ok({ contract: cl(c), agent: cl(m.agent) }); }
    }
    if (P[0] === 'my' && P[1] === 'ships') {
      if (!P[2]) return { data: cl(m.ships), meta: { total: m.ships.length } };
      const s = sh(P[2]), a = P[3];
      if (!a) return ok(cl(s));
      if (s.nav.status === 'IN_TRANSIT') fail('ship is in transit');
      const here = s.nav.waypointSymbol, goods = m.markets[here];
      if (a === 'orbit') { s.nav.status = 'IN_ORBIT'; return ok({ nav: cl(s.nav) }); }
      if (a === 'dock') { s.nav.status = 'DOCKED'; return ok({ nav: cl(s.nav) }); }
      if (a === 'navigate') { const d = m.W[body.waypointSymbol] || fail('unknown waypoint'), o = m.W[here]; if (s.nav.status !== 'IN_ORBIT') fail('ship must be in orbit');
        const dist = Math.round(Math.hypot(d.x - o.x, d.y - o.y)), f = s.fuel.capacity ? Math.max(1, dist) : 0; if (f > s.fuel.current) fail('not enough fuel');
        s.fuel.current -= f; s.nav.status = 'IN_TRANSIT'; s.nav.route = { origin: { symbol: o.symbol, x: o.x, y: o.y }, destination: { symbol: d.symbol, x: d.x, y: d.y }, departureTime: new Date(now).toISOString(), arrival: new Date(now + Math.max(6, dist * .35) * 1000).toISOString() };
        return ok({ nav: cl(s.nav), fuel: { ...cl(s.fuel), consumed: { amount: f } } }); }
      if (a === 'extract') { const w = m.W[here]; if (!/ASTEROID/.test(w.type) || w.type === 'ASTEROID_BASE') fail('no minable deposits here'); if (s.nav.status !== 'IN_ORBIT') fail('ship must be in orbit');
        if (s.cooldown.expiration && new Date(s.cooldown.expiration).getTime() > now) fail('laser cooling down'); const pool = ['IRON_ORE', 'IRON_ORE', 'COPPER_ORE', 'ALUMINUM_ORE', 'QUARTZ_SAND'], sym = pool[Math.floor(Math.random() * pool.length)];
        const u = Math.min(3 + Math.floor(Math.random() * 6), s.cargo.capacity - s.cargo.units); if (u <= 0) fail('cargo hold full'); add(s, sym, u); s.cooldown = { remainingSeconds: 15, expiration: new Date(now + 15000).toISOString() };
        return ok({ extraction: { yield: { symbol: sym, units: u } }, cargo: cl(s.cargo), cooldown: cl(s.cooldown) }); }
      if (a === 'refuel') { const g = goods && goods.find((g: any) => g.symbol === 'FUEL'); if (!g) fail('no fuel sold here'); if (s.nav.status !== 'DOCKED') fail('ship must be docked'); const u = s.fuel.capacity - s.fuel.current, price = Math.ceil(u / 100) * g.purchasePrice;
        s.fuel.current = s.fuel.capacity; m.agent.credits -= price; return ok({ agent: cl(m.agent), fuel: cl(s.fuel), transaction: { units: u, totalPrice: price } }); }
      if (a === 'sell' || a === 'purchase') { if (s.nav.status !== 'DOCKED') fail('ship must be docked'); const g = goods && goods.find((g: any) => g.symbol === body.symbol); if (!g) fail(body.symbol + ' is not traded here');
        if (a === 'sell') { const it = s.cargo.inventory.find((i: any) => i.symbol === body.symbol); if (!it || it.units < body.units) fail('not enough units aboard'); add(s, body.symbol, -body.units); const t = body.units * g.sellPrice; m.agent.credits += t; g.sellPrice = Math.max(5, g.sellPrice - 1);
          return ok({ agent: cl(m.agent), cargo: cl(s.cargo), transaction: { units: body.units, pricePerUnit: g.sellPrice, totalPrice: t } }); }
        const t = body.units * g.purchasePrice; if (t > m.agent.credits) fail('insufficient credits'); if (s.cargo.units + body.units > s.cargo.capacity) fail('cargo hold full'); add(s, body.symbol, body.units); m.agent.credits -= t; g.purchasePrice += 1;
        return ok({ agent: cl(m.agent), cargo: cl(s.cargo), transaction: { units: body.units, totalPrice: t } }); }
      if (a === 'negotiate') { if (s.nav.status !== 'DOCKED') fail('ship must be docked'); const tr = ['COPPER_ORE', 'ALUMINUM_ORE', 'IRON_ORE'][Math.floor(Math.random() * 3)], dst = ['A1', 'E2', 'B8'][Math.floor(Math.random() * 3)];
        const c = { id: 'demo-ct-' + Math.random().toString(16).slice(2, 8), factionSymbol: 'COSMIC', type: 'PROCUREMENT', accepted: false, fulfilled: false, terms: { deadline: new Date(now + 5 * 864e5).toISOString(), payment: { onAccepted: 8000 + Math.round(Math.random() * 6000), onFulfilled: 40000 + Math.round(Math.random() * 30000) }, deliver: [{ tradeSymbol: tr, destinationSymbol: 'X1-HV7-' + dst, unitsRequired: 20 + Math.floor(Math.random() * 30), unitsFulfilled: 0 }] } };
        m.contracts.push(c); return ok({ contract: cl(c) }); }
    }
    if (P[0] === 'systems') {
      if (P[2] === 'waypoints' && !P[3]) { const all = Object.values(m.W); return { data: cl(all), meta: { total: all.length } }; }
      if (P[4] === 'market') { const g = m.markets[P[3]] || fail('no marketplace at this waypoint'), present = m.ships.some((s: any) => s.nav.status !== 'IN_TRANSIT' && s.nav.waypointSymbol === P[3]), pick = (t: string) => g.filter((x: any) => x.type === t).map((x: any) => ({ symbol: x.symbol }));
        return ok({ symbol: P[3], exports: pick('EXPORT'), imports: pick('IMPORT'), exchange: pick('EXCHANGE'), tradeGoods: present ? cl(g) : undefined }); }
    }
    fail('simulator: ' + method + ' ' + path + ' not modelled');
  }
  doDemo = () => { this.click(); this.demo = true; this.buildDemo(); this.setState({ loginErr: '' }); this.enter(); this.say('ai', 'VESTA: Simulator engaged — nothing here touches the live universe. Have a look around, Captain.'); };

  // ---- star chart
  buildMap(ship: any, transit: boolean, p: number) {
    const S = this.state, W = S.waypoints, cols = S.mapCols, rows = S.mapRows, all: any[] = Object.values(W), top = all.filter(w => !w.orbits);
    if (!top.length) return [];
    const key = [cols, rows, all.length, S.selWp, ship && ship.symbol, ship && ship.nav.waypointSymbol, ship && ship.nav.status, Math.floor(p * 80)].join('|');
    if (this._mk === key) return this._mrows;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; top.forEach(w => { x0 = Math.min(x0, w.x); x1 = Math.max(x1, w.x); y0 = Math.min(y0, w.y); y1 = Math.max(y1, w.y); });
    const sx = Math.max(1, x1 - x0), sy = Math.max(1, y1 - y0), usable = cols - 7;
    const P = (x: number, y: number) => [Math.round((x - x0) / sx * (usable - 2)) + 1, Math.round((y - y0) / sy * (rows - 1))];
    const g: any[][] = []; for (let r = 0; r < rows; r++) { const row = []; for (let c = 0; c < cols; c++) { const h = hash(r + 7, c + 3); row.push(h < .028 ? { ch: h < .005 ? '+' : '.', k: 's' } : { ch: ' ', k: 'e' }); } g.push(row); }
    const parent = (sym: string) => { const w = W[sym]; return w && w.orbits ? (W[w.orbits] || w) : w; };
    const here = ship && !transit ? parent(ship.nav.waypointSymbol) : null, selP = S.selWp ? parent(S.selWp) : null;
    if (transit) {
      const o = ship.nav.route.origin, d = ship.nav.route.destination; let [c0, r0] = P(o.x, o.y); const [c1, r1] = P(d.x, d.y);
      const dx = Math.abs(c1 - c0), dy = -Math.abs(r1 - r0), stx = c0 < c1 ? 1 : -1, sty = r0 < r1 ? 1 : -1; let err = dx + dy;
      for (let n = 0; n < 400; n++) { if (g[r0] && g[r0][c0] && (g[r0][c0].k === 'e' || g[r0][c0].k === 's')) g[r0][c0] = { ch: '·', k: 'r' }; if (c0 === c1 && r0 === r1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; c0 += stx; } if (e2 <= dx) { err += dx; r0 += sty; } }
    }
    top.forEach(w => { const [c, r] = P(w.x, w.y); if (!g[r] || !g[r][c] || g[r][c].k === 'w') return; g[r][c] = { ch: GLYPH[w.type] || '?', k: 'w', wp: w.symbol }; });
    top.forEach(w => { const [c, r] = P(w.x, w.y); if (!g[r] || !g[r][c] || g[r][c].wp !== w.symbol) return;
      const n = (w.orbitals || []).length, lab = code(w.symbol) + (n ? '+' + n : '');
      for (let i = 1; i <= lab.length + 1; i++) { const cell = g[r][c + i]; if (!cell || cell.k === 'w' || cell.k === 'l') return; }
      for (let i = 0; i < lab.length; i++) g[r][c + 2 + i] = { ch: lab[i], k: 'l', wp: w.symbol }; });
    if (transit) { const o = ship.nav.route.origin, d = ship.nav.route.destination, [c, r] = P(o.x + (d.x - o.x) * p, o.y + (d.y - o.y) * p); if (g[r] && g[r][c] && g[r][c].k !== 'w') g[r][c] = { ch: '◆', k: 'ship' }; }
    const out = g.map((row, ri) => { const segs: any[] = []; let cu: any = null;
      row.forEach(cell => { const st = cell.wp ? (selP && cell.wp === selP.symbol ? 'sel' : here && cell.wp === here.symbol ? 'here' : 'n') : ''; const k = cell.k + '|' + (cell.wp || '') + '|' + st;
        if (cu && cu._k === k) cu.text += cell.ch; else { cu = { _k: k, text: cell.ch, wp: cell.wp, k: cell.k, st }; segs.push(cu); } });
      return { id: ri, segs: segs.map(s => {
        let color = 'inherit', bg = 'transparent';
        if (s.k === 's') color = 'var(--line)'; else if (s.k === 'r' || s.k === 'ship') color = 'var(--acc)';
        else if (s.wp) { if (s.st === 'sel') { color = 'var(--bg)'; bg = s.k === 'w' ? 'var(--fg)' : 'var(--hi)'; } else if (s.st === 'here') color = 'var(--acc)'; else color = s.k === 'w' ? 'var(--fg)' : 'var(--dim)'; }
        const wp = s.wp; return { text: s.text, color, bg, cursor: wp ? 'pointer' : 'default', onClick: wp ? () => this.selectWp(wp) : undefined };
      }) }; });
    this._mk = key; this._mrows = out; return out;
  }

  renderVals() {
    const S = this.state, now = S.now, W = S.waypoints, ship = this.cur();
    const loc = ship && ship.nav.waypointSymbol, transit = !!ship && ship.nav.status === 'IN_TRANSIT', locWp = W[loc];
    let p = 0; if (transit) { const d = new Date(ship.nav.route.departureTime).getTime(), a = new Date(ship.nav.route.arrival).getTime(); p = Math.min(1, Math.max(0, (now - d) / Math.max(1, a - d))); }
    const cdLeft = ship && ship.cooldown && ship.cooldown.expiration ? Math.max(0, (new Date(ship.cooldown.expiration).getTime() - now) / 1000) : 0;
    const atMarket = !!ship && !transit && this.hasTrait(locWp, 'MARKETPLACE');
    const isRock = !!locWp && /ASTEROID/.test(locWp.type) && locWp.type !== 'ASTEROID_BASE';
    const cargoFull = !!ship && ship.cargo.units >= ship.cargo.capacity, ok = !!ship && !S.busy;
    const navOk = ok && !transit && !!S.selWp && S.selWp !== loc;
    const cmds = [
      { key: '1', label: 'ORBIT', enabled: ok && ship.nav.status === 'DOCKED', onClick: this.doOrbit },
      { key: '2', label: 'DOCK', enabled: ok && ship.nav.status === 'IN_ORBIT', onClick: this.doDock },
      { key: '3', label: navOk ? `NAVIGATE → ${code(S.selWp)}` : 'NAVIGATE', enabled: navOk, onClick: this.doNav },
      { key: '4', label: cdLeft > 0 ? `EXTRACT ${Math.ceil(cdLeft)}s` : 'EXTRACT', enabled: ok && !transit && isRock && cdLeft <= 0 && !cargoFull, onClick: this.doExtract },
      { key: '5', label: 'REFUEL', enabled: ok && atMarket && ship.fuel.capacity > 0 && ship.fuel.current < ship.fuel.capacity, onClick: this.doRefuel },
      { key: '6', label: 'SELL CARGO', enabled: ok && atMarket && ship.cargo.units > 0, onClick: this.doSellAll },
      { key: '7', label: 'REFRESH', enabled: ok, onClick: this.doRefresh },
    ].map(c => ({ ...c, disabled: !c.enabled }));
    this._cmds = cmds;

    const fleet = S.ships.map((s: any) => { const sel = s.symbol === S.shipSel; return { sym: s.symbol, role: s.registration.role, st: s.nav.status === 'IN_TRANSIT' ? 'TRANSIT' : s.nav.status === 'IN_ORBIT' ? 'ORBIT' : 'DOCKED', mark: sel ? '▸' : ' ', border: sel ? 'var(--fg)' : 'var(--line)',
      loc: s.nav.status === 'IN_TRANSIT' ? '→ ' + code(s.nav.route.destination.symbol) + ' · ETA ' + fmtT((new Date(s.nav.route.arrival).getTime() - now) / 1000) : '@ ' + code(s.nav.waypointSymbol),
      fuelBar: s.fuel.capacity ? bar(s.fuel.current, s.fuel.capacity, 8) : '[ n/a  ]', cargoTxt: s.cargo.units + '/' + s.cargo.capacity, color: sel ? 'var(--hi)' : 'var(--fg)',
      onClick: () => { this.click(); this.setState({ shipSel: s.symbol, selWp: s.nav.waypointSymbol }); } }; });

    const mkt = S.markets[loc];
    const inv = ship ? ship.cargo.inventory.map((i: any) => ({ symbol: i.symbol, units: i.units, canSell: atMarket && (!mkt || !mkt.tradeGoods || mkt.tradeGoods.some((g: any) => g.symbol === i.symbol)), disabled: S.busy, onSell: () => this.doSellOne(i.symbol) })) : [];

    const from = ship ? (transit ? ship.nav.route.destination : locWp) : null;
    const dist = (w: any) => from && w ? Math.round(Math.hypot(w.x - from.x, w.y - from.y)) : null;
    const sel = W[S.selWp], sd = dist(sel);
    const wd = sel ? { sym: sel.symbol, type: this.tn(sel.type), coords: `(${sel.x}, ${sel.y})`, dist: sd == null ? '—' : sel.symbol === loc ? 'you are here' : `${sd} u`,
      fuel: sd == null || sel.symbol === loc ? '—' : `~${Math.max(1, sd)} fuel · cruise`, parent: sel.orbits ? code(sel.orbits) : '—',
      traits: (sel.traits || []).map((t: any) => t.name).join(' · ') || 'no survey data', hasMarket: this.hasTrait(sel, 'MARKETPLACE') }
      : { sym: '', type: '', coords: '', dist: '', fuel: '', parent: '', traits: '', hasMarket: false };
    const wdOrbitals = sel ? (sel.orbitals || []).map((o: any) => ({ c: code(o.symbol), onClick: () => this.selectWp(o.symbol) })) : [];
    const idx = (Object.values(W) as any[]).map(w => ({ w, d: dist(w) })).sort((a, b) => (a.d ?? 0) - (b.d ?? 0)).map(({ w, d }) => {
      const s = w.symbol === S.selWp, h = w.symbol === loc;
      return { key: w.symbol, c: (w.orbits ? ' └' : '') + code(w.symbol), type: this.tn(w.type), d: d == null ? '' : String(d), flags: (this.hasTrait(w, 'MARKETPLACE') ? 'M' : '') + (this.hasTrait(w, 'SHIPYARD') ? 'S' : '') + (h ? '◆' : ''),
        color: s ? 'var(--bg)' : h ? 'var(--acc)' : 'var(--fg)', bg: s ? 'var(--fg)' : 'transparent', onClick: () => this.selectWp(w.symbol) };
    });

    const mwp = S.selWp || loc, mw = W[mwp], m = S.markets[mwp], mHas = this.hasTrait(mw, 'MARKETPLACE');
    const hereM = !!ship && !transit && loc === mwp, loading = S.mktLoading === mwp && !m;
    const goods = m && m.tradeGoods ? m.tradeGoods.map((g: any) => { const held = ship ? ((ship.cargo.inventory.find((i: any) => i.symbol === g.symbol) || {}).units || 0) : 0;
      return { sym: g.symbol, kind: g.type === 'EXPORT' ? 'exp' : g.type === 'IMPORT' ? 'imp' : 'exch', supply: (g.supply || '').toLowerCase(), vol: g.tradeVolume, buy: cr(g.purchasePrice), sell: cr(g.sellPrice), held: held ? `×${held}` : '',
        noBuy: !(hereM && !cargoFull && !S.busy), noSell: !(hereM && held > 0 && !S.busy), onBuy: () => this.doBuy(g.symbol), onSell: () => this.doSellOne(g.symbol) }; }) : [];
    const names = (a: any[]) => (a || []).map(x => x.symbol).join(', ') || '—';
    const mktHint = !mHas || !m ? '' : m.tradeGoods ? (hereM ? 'B buys a full trade lot · S sells what you hold. Auto-docks.' : 'Live quotes from a ship on site — fly here to trade.') : 'Prices hidden — park a ship here to read live quotes.';

    const cons = S.contracts.map((c: any) => { const del = c.terms.deliver || [];
      const allDone = del.every((t: any) => t.unitsFulfilled >= t.unitsRequired);
      return { key: c.id, id: c.id.slice(-6).toUpperCase(), type: c.type, fac: c.factionSymbol, status: c.fulfilled ? 'FULFILLED' : c.accepted ? 'ACCEPTED' : 'OFFERED',
        stColor: c.fulfilled ? 'var(--dim)' : c.accepted ? 'var(--acc)' : 'var(--fg)', deadline: `due ${new Date(c.terms.deadline).toUTCString().slice(5, 22)}`,
        pay: `${cr(c.terms.payment.onAccepted)} + ${cr(c.terms.payment.onFulfilled)}`, canAccept: !c.accepted && !S.busy, canFulfill: c.accepted && !c.fulfilled && allDone && !S.busy,
        onAccept: () => this.doAccept(c.id), onFulfill: () => this.doFulfill(c.id),
        terms: del.map((t: any) => { const held = ship ? ((ship.cargo.inventory.find((i: any) => i.symbol === t.tradeSymbol) || {}).units || 0) : 0;
          return { key: t.tradeSymbol + t.destinationSymbol, txt: t.tradeSymbol, dest: code(t.destinationSymbol), bar: bar(t.unitsFulfilled, t.unitsRequired, 10), prog: `${t.unitsFulfilled}/${t.unitsRequired}`,
            canDeliver: c.accepted && !c.fulfilled && !!ship && !transit && loc === t.destinationSymbol && held > 0 && t.unitsFulfilled < t.unitsRequired && !S.busy,
            onDeliver: () => this.doDeliver(c.id, t.tradeSymbol, t.unitsRequired - t.unitsFulfilled), onGo: () => { this.selectWp(t.destinationSymbol); this.goScan(); } }; }) };
    });

    const tabs = [['scan', 'SCAN'], ['mkt', 'MARKET'], ['con', `CONTRACTS${S.contracts.length ? ' ' + S.contracts.length : ''}`]].map(([id, label]) => ({ id, label, bg: S.tab === id ? 'var(--fg)' : 'transparent', fg: S.tab === id ? 'var(--bg)' : 'var(--fg)',
      onClick: () => { this.click(); this.setState({ tab: id }); if (id === 'mkt') { const k = S.selWp || loc; if (k && this.hasTrait(W[k], 'MARKETPLACE') && !S.markets[k]) this.loadMarket(k, true); } } }));

    const mapRows = this.buildMap(ship, transit, p);
    const tn = Date.now();
    const lines = (arr: any[]) => arr.filter(e => tn >= e.t0).map(e => ({ id: e.id, text: e.text.slice(0, Math.ceil(Math.min(1, (tn - e.t0) / e.dur) * e.text.length)), color: KC[e.kind] || 'var(--fg)' }));
    const tk = this.themeKey(), themes = Object.keys(THEMES);
    const activeCons = S.contracts.filter((c: any) => c.accepted && !c.fulfilled).length;
    const la = S.log.slice().reverse().find((e: any) => e.kind === 'ai' || e.kind === 'err');
    const toastShow = !!la && tn - la.t0 < la.dur + 6000 && tn >= la.t0 && !(S.wins.comms.open && S.focus === 'comms');

    return {
      layout: this.props.layout,
      mapRef: this.mapRef, probeRef: this.probeRef, conRef: this.conRef,
      agentSym: S.agent ? S.agent.symbol : '—', credits: S.agent ? cr(S.agent.credits) : '—', hq: S.agent ? code(S.agent.headquarters) : '—', system: S.system || '—',
      clock: new Date(now).toISOString().slice(11, 19), themeName: tk.toUpperCase(), sndLabel: S.mute ? 'OFF' : 'ON', loggedIn: S.phase === 'cockpit',
      cycleTheme: () => { this.click(); this.setState({ theme: themes[(themes.indexOf(tk) + 1) % themes.length] }); },
      toggleMute: () => this.setState({ mute: !S.mute }, () => this.click()), logout: this.logout,
      fleet, fleetEmpty: !fleet.length, hasShip: !!ship,
      sShip: ship ? ship.symbol : '', sFrame: ship ? ship.frame.name : '', sRole: ship ? ship.registration.role.toLowerCase() : '',
      sStatus: !ship ? '' : transit ? `IN TRANSIT → ${code(ship.nav.route.destination.symbol)}` : `${ship.nav.status === 'DOCKED' ? 'DOCKED' : 'ORBITING'} @ ${code(loc)}`,
      sSub: !ship ? '' : transit ? `ETA ${fmtT((new Date(ship.nav.route.arrival).getTime() - now) / 1000)} · from ${code(ship.nav.route.origin.symbol)}` : (locWp ? this.tn(locWp.type) : ''),
      sTransit: transit, sTrBar: transit ? `${bar(p, 1, 18)} ${Math.round(p * 100)}%` : '',
      sFuelBar: ship ? (ship.fuel.capacity ? bar(ship.fuel.current, ship.fuel.capacity, 10) : '[ no tank ]') : '', sFuelTxt: ship && ship.fuel.capacity ? `${ship.fuel.current}/${ship.fuel.capacity}` : '',
      sCargoBar: ship ? bar(ship.cargo.units, ship.cargo.capacity, 10) : '', sCargoTxt: ship ? `${ship.cargo.units}/${ship.cargo.capacity}` : '',
      sCd: cdLeft > 0 ? `recharging ${Math.ceil(cdLeft)}s` : 'ready', sMode: ship ? ship.nav.flightMode : '',
      inv, invEmpty: !!ship && !inv.length,
      mapRows, mapEmpty: !mapRows.length, logLines: lines(S.log), bootLines: lines(S.boot),
      tabs, tab: S.tab,
      hasSel: !!sel, wd, wdOrbitals, idx, doNav: this.doNav, navDisabled: !navOk,
      openMarket: () => this.goMarket(),
      mktTitle: mwp ? `EXCHANGE · ${code(mwp)}` : 'EXCHANGE', mktNone: !!mwp && !mHas, mktLoading: loading, goods,
      mktList: !!m && !m.tradeGoods, mExports: m ? names(m.exports) : '', mImports: m ? names(m.imports) : '', mExchange: m ? names(m.exchange) : '',
      mktHint, mktCanScan: mHas && !loading, scanMarket: () => { this.click(); this.loadMarket(mwp); },
      mktPick: (Object.values(W) as any[]).filter(w => this.hasTrait(w, 'MARKETPLACE')).map(w => ({ key: w.symbol, c: code(w.symbol), bg: w.symbol === mwp ? 'var(--fg)' : 'transparent', fg: w.symbol === mwp ? 'var(--bg)' : 'var(--fg)', onClick: () => this.selectWp(w.symbol) })),
      cons, doNegotiate: this.doNegotiate, noNegotiate: !ok || transit,
      cmds, busy: S.busy, reqs: S.reqs, scanlines: this.props.scanlines !== false,
      phase: S.phase,
      // profile
      agentFaction: S.agent ? S.agent.startingFaction : '—', agentShips: S.ships.length + ' hull' + (S.ships.length === 1 ? '' : 's'), agentAcct: S.agent && S.agent.accountId ? S.agent.accountId : '—', hqFull: S.agent ? S.agent.headquarters : '—', agentInitial: S.agent ? S.agent.symbol[0] : '?',
      conSummary: activeCons + ' active · ' + S.contracts.filter((c: any) => !c.accepted).length + ' offered · ' + S.contracts.filter((c: any) => c.fulfilled).length + ' done',
      // sidebar
      mod: S.mod,
      mods: [['tracker', '▲', 'SHIP TRACKER', S.ships.length ? S.ships.length + ' hull' + (S.ships.length > 1 ? 's' : '') + ' · ' + (transit ? 'in transit' : code(loc)) : 'offline'], ['map', '✦', 'STAR MAP', S.system || 'no chart'], ['personal', '@', 'PERSONAL', S.agent ? cr(S.agent.credits) : '—'], ['exchange', '₡', 'EXCHANGE', Object.keys(S.markets).length + ' markets quoted'], ['contracts', '§', 'CONTRACTS', activeCons + ' active']]
        .map(([id, glyph, label, sub]) => { const a = S.mod === id; return { id, glyph, label, sub, bg: a ? 'var(--fg)' : 'transparent', fg: a ? 'var(--bg)' : 'var(--fg)', border: a ? 'var(--fg)' : 'var(--line)', onClick: () => this.setMod(id) }; }),
      modTitle: ({ tracker: 'SHIP TRACKER', map: 'STAR MAP — ' + (S.system || '—'), personal: 'PERSONAL FILE', exchange: 'COMMODITY EXCHANGE', contracts: 'CONTRACTS' } as Record<string, string>)[S.mod],
      // desktop
      win: Object.fromEntries(WD.map(([id]) => { const w = S.wins[id], fo = S.focus === id; return [id, { left: w.x, top: w.y, width: w.w, height: w.h, z: w.z, display: w.open ? 'flex' : 'none', border: fo ? 'var(--fg)' : 'var(--line)', tbg: fo ? 'var(--fg)' : 'var(--line)', tfg: fo ? 'var(--bg)' : 'var(--hi)',
        focus: () => this.focusWin(id), drag: (e: React.MouseEvent) => this.startDrag(id, 'move', e), resize: (e: React.MouseEvent) => { e.stopPropagation(); this.startDrag(id, 'size', e); }, close: (e: React.MouseEvent) => { e.stopPropagation(); this.closeWin(id); } }]; })),
      deskIcons: WD.map(([id, glyph, label]) => { const go = () => id === 'exchange' ? this.goMarket() : this.openWin(id); return { id, glyph, label, ring: S.wins[id].open ? 'var(--fg)' : 'var(--line)', onClick: go, onStart: () => { this.setState({ startOpen: false }); go(); } }; }),
      startOpen: !!S.startOpen, toggleStart: () => { this.click(); this.setState({ startOpen: !S.startOpen }); },
      taskItems: WD.filter(([id]) => S.wins[id].open).map(([id, g, l]) => ({ id, label: g + ' ' + l, bg: S.focus === id ? 'var(--fg)' : 'transparent', fg: S.focus === id ? 'var(--bg)' : 'var(--fg)', onClick: () => this.focusWin(id) })),
      toastShow, toastText: la ? la.text.replace(/^VESTA: /, '') : '', toastColor: la && la.kind === 'err' ? 'var(--alert)' : 'var(--fg)',
      openComms: () => this.openWin('comms'),
      // login overlay
      loginTab: S.loginTab,
      tabResume: () => { this.click(); this.setState({ loginTab: 'resume', loginErr: '' }); }, tabRegister: () => { this.click(); this.setState({ loginTab: 'register', loginErr: '' }); },
      tokenIn: S.tokenIn, inviteIn: S.inviteIn, canCreate: S.canCreate, hasSession: S.hasSession, doContinue: this.doContinue,
      resetText: S.resetAt ? new Date(S.resetAt).toLocaleString([], { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '', isDemo: this.demo, callIn: S.callIn, factionIn: S.factionIn, factions: FACTIONS,
      onTokenIn: (e: any) => this.setState({ tokenIn: e.target.value }), onInviteIn: (e: any) => this.setState({ inviteIn: e.target.value }),
      onCallIn: (e: any) => this.setState({ callIn: e.target.value.toUpperCase().slice(0, 14) }), onFactionIn: (e: any) => this.setState({ factionIn: e.target.value }),
      onLoginKey: (e: any) => { if (e.key === 'Enter') this.doLogin(); }, doLogin: this.doLogin, doRegister: this.doRegister, doDemo: this.doDemo,
      loginErr: S.loginErr,
    };
  }

  render() {
    const v = this.renderVals();
    const L = this.props.layout === 'desktop' ? DesktopLayout : this.props.layout === 'sidebar' ? SidebarLayout : TmuxLayout;
    return (
      <div ref={this.rootRef} className={`hc-root hc-${this.props.layout}`} data-screen-label="Cockpit">
        <L v={v} />
        {v.scanlines && <div className="hc-crt"><div className="hc-vignette" /></div>}
        {v.phase !== 'cockpit' && <BootOverlay v={v} />}
      </div>
    );
  }
}
