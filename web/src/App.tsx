import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { ScenarioResult, Variant } from './scenario'
import { workerRun } from './workerRun'
import './styles.css'
import './overrides.css'

const variants: { id: Variant; label: string; branch: string; description: string }[] = [
  { id: 'base', label: 'Base', branch: 'main', description: 'Global price only' },
  { id: 'pricing', label: 'Change A', branch: 'tenant-prices', description: 'Adds tenant prices' },
  { id: 'cache', label: 'Change B', branch: 'sku-cache', description: 'Adds SKU cache' },
  { id: 'combined', label: 'Combined', branch: 'merge', description: 'Clean text merge' },
]

const evidenceTabs = ['counterexample', 'repair', 'bob'] as const
type EvidenceTab = typeof evidenceTabs[number]

function StatePill({ status }: { status?: 'pass' | 'fail' }) {
  if (!status) return <span className="pill neutral"><i /> Not run</span>
  return <span className={`pill ${status}`}><i />{status === 'pass' ? 'Pass' : 'Witness found'}</span>
}

function Check({ name, status, detail }: { name: string; status: 'pass' | 'fail'; detail: string }) {
  return <li className={status}><span>{status === 'pass' ? '✓' : '×'}</span><div><strong>{name}</strong><small>{detail}</small></div></li>
}

export default function App() {
  const [results, setResults] = useState<Partial<Record<Variant, ScenarioResult>>>({})
  const [active, setActive] = useState<EvidenceTab>('counterexample')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<{ action: 'comparison' | 'repair'; message: string } | null>(null)
  const flowRef = useRef<HTMLElement>(null)
  const baseRef = useRef<HTMLDivElement>(null)
  const changeARef = useRef<HTMLDivElement>(null)
  const changeBRef = useRef<HTMLDivElement>(null)
  const combinedRef = useRef<HTMLDivElement>(null)
  const [branchPath, setBranchPath] = useState('')
  const combined = results.combined
  const repaired = results.repaired
  const complete = variants.every(({ id }) => results[id])
  const witness = combined?.probe.status === 'fail'

  const runComparison = async () => {
    const batch = new AbortController()
    setRunning(true); setError(null)
    setResults((current) => ({ repaired: current.repaired }))
    try {
      const output = await Promise.all(variants.map(({ id }) => workerRun(id, batch.signal)))
      setResults(Object.fromEntries(output.map((result) => [result.variant, result])))
      requestAnimationFrame(() => document.getElementById('laboratory')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (error) { setError({ action: 'comparison', message: error instanceof Error ? error.message : 'The browser could not complete the comparison. Please try again.' }) }
    finally { batch.abort(); setRunning(false) }
  }

  const verifyRepair = async () => {
    setRunning(true); setError(null)
    setResults((current) => ({ ...current, repaired: undefined }))
    try {
      const repair = await workerRun('repaired')
      setResults((current) => ({ ...current, repaired: repair }))
    }
    catch (error) { setError({ action: 'repair', message: error instanceof Error ? error.message : 'The repair worker did not complete. Please try again.' }) }
    finally { setRunning(false) }
  }

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: EvidenceTab) => {
    const index = evidenceTabs.indexOf(tab)
    const nextIndex = event.key === 'ArrowRight' ? (index + 1) % evidenceTabs.length
      : event.key === 'ArrowLeft' ? (index - 1 + evidenceTabs.length) % evidenceTabs.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? evidenceTabs.length - 1 : -1
    if (nextIndex < 0) return
    event.preventDefault()
    const nextTab = evidenceTabs[nextIndex]
    setActive(nextTab)
    document.getElementById(`tab-${nextTab}`)?.focus()
  }

  const trace = useMemo(() => combined?.trace ?? [], [combined])

  useLayoutEffect(() => {
    const flow = flowRef.current
    const nodes = [baseRef.current, changeARef.current, changeBRef.current, combinedRef.current]
    if (!flow || nodes.some((node) => !node)) return

    const updateLines = () => {
      const origin = flow.getBoundingClientRect()
      const point = (node: HTMLDivElement, side: 'left' | 'right') => {
        const rect = node.getBoundingClientRect()
        return `${Math.round((side === 'left' ? rect.left : rect.right) - origin.left)} ${Math.round(rect.top + rect.height / 2 - origin.top)}`
      }
      const [base, changeA, changeB, combined] = nodes as HTMLDivElement[]
      setBranchPath(`M${point(base, 'right')} L${point(changeA, 'left')} M${point(base, 'right')} L${point(changeB, 'left')} M${point(changeA, 'right')} L${point(combined, 'left')} M${point(changeB, 'right')} L${point(combined, 'left')}`)
    }

    const observer = new ResizeObserver(updateLines)
    observer.observe(flow)
    nodes.forEach((node) => observer.observe(node as HTMLDivElement))
    window.addEventListener('resize', updateLines)
    updateLines()
    return () => { observer.disconnect(); window.removeEventListener('resize', updateLines) }
  }, [])

  return <main>
    <header className="site-header">
      <a className="wordmark" href="#top" aria-label="MergeWitness home"><span className="mark">⌁</span>Merge<span>Witness</span></a>
      <nav aria-label="Primary navigation"><a href="#laboratory">Laboratory</a><a href="#evidence">Evidence</a><a href="#evidence" onClick={() => setActive('bob')}>How Bob helps</a></nav>
      <a className="source-link" href="https://github.com/lawliet8886/MergeWitness" target="_blank" rel="noreferrer">View source ↗</a>
    </header>

    <section className="hero" id="top">
      <div><p className="kicker">Interaction test laboratory</p><h1>Two green changes.<br /><em>One broken price.</em></h1><p className="lede">Recorded Node tests pass across four Git snapshots. This browser reruns the same interaction sequence and exposes the customer boundary failure.</p></div>
      <div className="hero-actions"><button className="primary" onClick={runComparison} disabled={running}>{running ? 'Running fresh workers…' : complete ? 'Run comparison again' : 'Run comparison'} <span>→</span></button>{error?.action === 'comparison' && <p className="action-error" role="alert">{error.message}</p>}<p>Runs locally in fresh browser workers<br />with synthetic fixture data.</p></div>
    </section>

    <section className="flow" aria-label="Branch flow" ref={flowRef}>
      <svg className="branch-lines" aria-hidden="true"><path d={branchPath} /></svg>
      <div className="node base-node" ref={baseRef}><b>Base</b><small>main</small></div>
      <div className="node a-node" ref={changeARef}><b>Change A</b><small>tenant-prices</small></div><div className="node b-node" ref={changeBRef}><b>Change B</b><small>sku-cache</small></div>
      <div className="node combined-node" ref={combinedRef}><b>Combined</b><small>clean merge</small></div>
    </section>

    <section id="laboratory" className="lab-section">
      <div className="section-heading"><div><p className="kicker">1 · Compare snapshots</p><h2>Browser behavior remains plausible.</h2></div><p>Original <code>node --test</code> results are recorded in the <a className="report-link" href="https://github.com/lawliet8886/MergeWitness/blob/main/reports/tenant-cache-evaluation.public.json" target="_blank" rel="noreferrer">public CLI report ↗</a>.</p></div>
      {complete && <div className={`comparison-summary ${witness ? 'witness' : ''}`} role="status" aria-live="polite"><strong>{witness ? 'Interaction witness found' : 'Comparison complete'}</strong><span>{witness ? `Base and both changes pass separately. Combined returns $${combined?.probe.observed} to Beta; expected $${combined?.probe.expected}.` : 'The tested interaction did not expose a customer boundary failure in this run.'}</span><a href="#evidence" onClick={() => setActive('counterexample')}>Inspect the sequence ↓</a></div>}
      <div className="snapshot-grid">
        {variants.map(({ id, label, branch, description }) => {
          const result = results[id]
          const probe = result?.probe.status
          return <article className={`snapshot ${id} ${probe === 'fail' ? 'danger' : ''}`} key={id}>
            <div className="snapshot-top"><div><p>{label}</p><code>{branch}</code></div><StatePill status={probe} /></div>
            <h3>{description}</h3>
            <div className="checks">{result ? result.behaviorChecks.map((item) => <Check key={item.name} {...item} />) : <div className="empty-checks">Run the comparison to execute this snapshot.</div>}</div>
            <div className="invariant"><span>New invariant</span>{result ? <strong className={probe}>{probe === 'pass' ? '✓ independent' : '× contaminated'}</strong> : <strong>Awaiting run</strong>}</div>
          </article>
        })}
      </div>
    </section>

    <section id="evidence" className="evidence-section">
      <div className="section-heading"><div><p className="kicker">2 · Explain the witness</p><h2>A customer boundary leaks through the cache.</h2></div>{witness && <StatePill status="fail" />}</div>
      <div className="tabbar" role="tablist" aria-label="Evidence views"><button id="tab-counterexample" role="tab" aria-controls="panel-counterexample" aria-selected={active === 'counterexample'} tabIndex={active === 'counterexample' ? 0 : -1} className={active === 'counterexample' ? 'active' : ''} onKeyDown={(event) => handleTabKeyDown(event, 'counterexample')} onClick={() => setActive('counterexample')}>Counterexample</button><button id="tab-repair" role="tab" aria-controls="panel-repair" aria-selected={active === 'repair'} tabIndex={active === 'repair' ? 0 : -1} className={active === 'repair' ? 'active' : ''} onKeyDown={(event) => handleTabKeyDown(event, 'repair')} onClick={() => setActive('repair')}>Verified Bob repair</button><button id="tab-bob" role="tab" aria-controls="panel-bob" aria-selected={active === 'bob'} tabIndex={active === 'bob' ? 0 : -1} className={active === 'bob' ? 'active' : ''} onKeyDown={(event) => handleTabKeyDown(event, 'bob')} onClick={() => setActive('bob')}>Bob session evidence</button></div>
      <div id="panel-counterexample" role="tabpanel" aria-labelledby="tab-counterexample" tabIndex={0} hidden={active !== 'counterexample'} className="evidence-panel counterexample">
        <div className="sequence"><p className="eyebrow">Frozen probe · same sequence in every snapshot</p><div className="request"><span>01</span><div><b>Alpha requests notebook</b><small>Expected $90 · receives $90</small></div><strong>$90</strong></div><div className="arrow">↓ then</div><div className="request beta"><span>02</span><div><b>Beta requests notebook</b><small>Expected $100 · {combined ? `receives $${combined.probe.observed}` : 'awaiting run'}</small></div><strong>{combined ? `$${combined.probe.observed}` : '—'}</strong></div></div>
        <div className="outcome"><p className="eyebrow">Observed report</p>{combined ? <><div className={`outcome-value ${combined.probe.status}`}><span>Expected</span><b>${combined.probe.expected}</b><span>Observed</span><b>${combined.probe.observed}</b></div><p>{combined.probe.detail}</p><code>cache[sku] → returns Alpha’s entry</code></> : <p className="muted">No result is asserted until you run the comparison.</p>}</div>
      </div>
      <div id="panel-repair" role="tabpanel" aria-labelledby="tab-repair" tabIndex={0} hidden={active !== 'repair'} className="evidence-panel repair-panel"><div><p className="eyebrow">Bob-authored candidate · independently verified</p><h3>Scope every cache entry by tenant, then product.</h3><pre><code>{`const tenantCache = cache.get(tenant) ?? new Map()\ntenantCache.set(sku, price)`}</code></pre><p>The verified candidate changes only <code>src/catalog.js</code> and uses nested Maps, avoiding flat-key collisions.</p></div><div className="repair-action"><p className="eyebrow">Fresh browser check of candidate commit 17ed2d8</p><StatePill status={repaired?.probe.status} />{repaired ? <ul className="feature-list">{repaired.features.map((item) => <Check key={item.name} {...item} />)}</ul> : <p className="muted">Run the candidate in a fresh browser worker.</p>}<a className="report-link" href="https://github.com/lawliet8886/MergeWitness/blob/main/reports/tenant-cache-repair.public.json" target="_blank" rel="noreferrer">Open independent repair report ↗</a><button className="primary" onClick={verifyRepair} disabled={running}>{running ? 'Checking…' : repaired ? 'Run candidate again' : 'Run verified candidate'} <span>→</span></button>{error?.action === 'repair' && <p className="action-error" role="alert">{error.message}</p>}</div></div>
      <div id="panel-bob" role="tabpanel" aria-labelledby="tab-bob" tabIndex={0} hidden={active !== 'bob'} className="evidence-panel bob-panel">
        <div>
          <p className="eyebrow">Required hackathon evidence</p>
          <h3>Bob produced probes for two synthetic scenarios and a repair for the tenant-cache case.</h3>
          <p>In tenant cache, Bob authored the original probe, feature checks, and repair candidate. The independent report records a passing frozen probe, Node suite, and tenant-pricing and cache checks. Browser execution is displayed separately. Later shared-fresh and Proxy audit derivatives are independent review artifacts.</p>
          <p><a className="report-link" href="https://github.com/lawliet8886/MergeWitness/blob/main/reports/tenant-cache-repair.public.json" target="_blank" rel="noreferrer">Tenant-cache repair report ↗</a> · <a className="report-link" href="https://github.com/lawliet8886/MergeWitness/blob/main/bob_sessions/01-tenant-cache-probe-summary.png" target="_blank" rel="noreferrer">Probe session screenshot ↗</a> · <a className="report-link" href="https://github.com/lawliet8886/MergeWitness/blob/main/bob_sessions/02-tenant-cache-repair-summary.png" target="_blank" rel="noreferrer">Repair session screenshot ↗</a></p>
          <p>In the second synthetic priority-cursor scenario, Bob authored a probe and feature checks. Base and both changes pass 3/3; their clean combination fails 3/3. This is a finding, with no repair claimed.</p>
          <p><a className="report-link" href="https://github.com/lawliet8886/MergeWitness/blob/main/reports/priority-cursor-evaluation.public.json" target="_blank" rel="noreferrer">Priority-cursor evaluation report ↗</a> · <a className="report-link" href="https://github.com/lawliet8886/MergeWitness/blob/main/bob_sessions/03-priority-cursor-probe-summary.png" target="_blank" rel="noreferrer">Third Bob session screenshot ↗</a></p>
        </div>
        <div className="pending-card complete"><span>✓</span><b>Three Bob sessions captured</b><small>Two tenant-cache sessions and one priority-cursor probe.</small></div>
      </div>
    </section>

    <section className="method"><p className="kicker">3 · Read the outcome correctly</p><div><h2>One witness is evidence of a defect. A passing probe is only evidence about this run.</h2><p>MergeWitness reports a concrete sequence, its expected value, the observed value, and the exact probe. It does not label a merge “safe” merely because one probe passes.</p></div></section>
    <footer><span>MergeWitness · Signal Foundry</span><span>Synthetic catalog fixture · browser execution</span></footer>
  </main>
}
