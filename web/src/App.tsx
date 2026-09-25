import { useMemo, useState } from 'react'
import type { ScenarioResult, Variant } from './scenario'
import './styles.css'
import './overrides.css'

const variants: { id: Variant; label: string; branch: string; description: string }[] = [
  { id: 'base', label: 'Base', branch: 'main', description: 'Global price only' },
  { id: 'pricing', label: 'Change A', branch: 'tenant-prices', description: 'Adds tenant prices' },
  { id: 'cache', label: 'Change B', branch: 'sku-cache', description: 'Adds SKU cache' },
  { id: 'combined', label: 'Combined', branch: 'merge', description: 'Clean text merge' },
]

const workerRun = (variant: Variant) => new Promise<ScenarioResult>((resolve, reject) => {
  const worker = new Worker(new URL('./scenario.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event) => { resolve(event.data as ScenarioResult); worker.terminate() }
  worker.onerror = (event) => { reject(event.error); worker.terminate() }
  worker.postMessage({ variant })
})

function StatePill({ status }: { status?: 'pass' | 'fail' }) {
  if (!status) return <span className="pill neutral"><i /> Not run</span>
  return <span className={`pill ${status}`}><i />{status === 'pass' ? 'Pass' : 'Witness found'}</span>
}

function Check({ name, status, detail }: { name: string; status: 'pass' | 'fail'; detail: string }) {
  return <li className={status}><span>{status === 'pass' ? '✓' : '×'}</span><div><strong>{name}</strong><small>{detail}</small></div></li>
}

export default function App() {
  const [results, setResults] = useState<Partial<Record<Variant, ScenarioResult>>>({})
  const [active, setActive] = useState<'counterexample' | 'repair' | 'bob'>('counterexample')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const combined = results.combined
  const repaired = results.repaired
  const complete = variants.every(({ id }) => results[id])
  const witness = combined?.probe.status === 'fail'

  const runComparison = async () => {
    setRunning(true); setError(null)
    try {
      const output = await Promise.all(variants.map(({ id }) => workerRun(id)))
      setResults(Object.fromEntries(output.map((result) => [result.variant, result])))
    } catch { setError('The browser could not start a fresh scenario worker. Please try again.') }
    finally { setRunning(false) }
  }

  const verifyRepair = async () => {
    setRunning(true); setError(null)
    try {
      const repair = await workerRun('repaired')
      setResults((current) => ({ ...current, repaired: repair }))
    }
    catch { setError('The repair worker did not complete. Please try again.') }
    finally { setRunning(false) }
  }

  const trace = useMemo(() => combined?.trace ?? [], [combined])

  return <main>
    <header className="site-header">
      <a className="wordmark" href="#top" aria-label="MergeWitness home"><span className="mark">⌁</span>Merge<span>Witness</span></a>
      <nav aria-label="Primary navigation"><a href="#laboratory">Laboratory</a><a href="#evidence">Evidence</a><a href="#how-bob-helps">How Bob helps</a></nav>
      <a className="source-link" href="https://github.com/lawliet8886/MergeWitness" target="_blank" rel="noreferrer">View source ↗</a>
    </header>

    <section className="hero" id="top">
      <div><p className="kicker">Interaction test laboratory</p><h1>Two green changes.<br /><em>One broken price.</em></h1><p className="lede">Recorded Node tests pass across four Git snapshots. This browser reruns the same interaction sequence and exposes the customer boundary failure.</p></div>
      <div className="hero-actions"><button className="primary" onClick={runComparison} disabled={running}>{running ? 'Running fresh workers…' : complete ? 'Run comparison again' : 'Run comparison'} <span>→</span></button><p>Runs locally in fresh browser workers<br />with synthetic fixture data.</p></div>
    </section>

    <section className="flow" aria-label="Branch flow">
      <svg className="branch-lines" viewBox="0 0 1000 166" preserveAspectRatio="none" aria-hidden="true"><path d="M160 83 L400 47 M160 83 L600 119 M520 47 L840 83 M720 119 L840 83" /></svg>
      <div className="node base-node"><b>Base</b><small>main</small></div>
      <div className="node a-node"><b>Change A</b><small>tenant-prices</small></div><div className="node b-node"><b>Change B</b><small>sku-cache</small></div>
      <div className="node combined-node"><b>Combined</b><small>clean merge</small></div>
    </section>

    <section id="laboratory" className="lab-section">
      <div className="section-heading"><div><p className="kicker">1 · Compare snapshots</p><h2>Browser behavior remains plausible.</h2></div><p>Original <code>node --test</code> results are recorded in the <a className="report-link" href="https://github.com/lawliet8886/MergeWitness/blob/main/reports/tenant-cache-evaluation.public.json" target="_blank" rel="noreferrer">public CLI report ↗</a>.</p></div>
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
      <div className="tabbar" role="tablist"><button className={active === 'counterexample' ? 'active' : ''} onClick={() => setActive('counterexample')}>Counterexample</button><button className={active === 'repair' ? 'active' : ''} onClick={() => setActive('repair')}>Verified Bob repair</button><button className={active === 'bob' ? 'active' : ''} onClick={() => setActive('bob')}>Bob session evidence</button></div>
      {active === 'counterexample' && <div className="evidence-panel counterexample">
        <div className="sequence"><p className="eyebrow">Frozen probe · same sequence in every snapshot</p><div className="request"><span>01</span><div><b>Alpha requests notebook</b><small>Expected $90 · receives $90</small></div><strong>$90</strong></div><div className="arrow">↓ then</div><div className="request beta"><span>02</span><div><b>Beta requests notebook</b><small>Expected $100 · {combined ? `receives $${combined.probe.observed}` : 'awaiting run'}</small></div><strong>{combined ? `$${combined.probe.observed}` : '—'}</strong></div></div>
        <div className="outcome"><p className="eyebrow">Observed report</p>{combined ? <><div className={`outcome-value ${combined.probe.status}`}><span>Expected</span><b>${combined.probe.expected}</b><span>Observed</span><b>${combined.probe.observed}</b></div><p>{combined.probe.detail}</p><code>cache[sku] → returns Alpha’s entry</code></> : <p className="muted">No result is asserted until you run the comparison.</p>}</div>
      </div>}
      {active === 'repair' && <div className="evidence-panel repair-panel"><div><p className="eyebrow">Bob-authored candidate · independently verified</p><h3>Scope every cache entry by tenant, then product.</h3><pre><code>{`const tenantCache = cache.get(tenant) ?? new Map()\ntenantCache.set(sku, price)`}</code></pre><p>The verified candidate changes only <code>src/catalog.js</code> and uses nested Maps, avoiding flat-key collisions.</p></div><div className="repair-action"><p className="eyebrow">Fresh browser check of candidate commit 17ed2d8</p><StatePill status={repaired?.probe.status} />{repaired ? <ul className="feature-list">{repaired.features.map((item) => <Check key={item.name} {...item} />)}</ul> : <p className="muted">Run the candidate in a fresh browser worker.</p>}<a className="report-link" href="https://github.com/lawliet8886/MergeWitness/blob/main/reports/tenant-cache-repair.public.json" target="_blank" rel="noreferrer">Open independent repair report ↗</a><button className="primary" onClick={verifyRepair} disabled={running}>{running ? 'Checking…' : repaired ? 'Run candidate again' : 'Run verified candidate'} <span>→</span></button></div></div>}
      {active === 'bob' && <div id="how-bob-helps" className="evidence-panel bob-panel"><div><p className="eyebrow">Required hackathon evidence</p><h3>Bob authored the original probe, original feature checks, and repair candidate used here.</h3><p>The independent report records a passing frozen probe, passing Node suite, and passing tenant-pricing and cache feature checks. Browser execution is displayed separately from that report. Later shared-fresh and Proxy audit derivatives are independent review artifacts, not Bob-authored work.</p><p><a className="report-link" href="https://github.com/lawliet8886/MergeWitness/blob/main/reports/tenant-cache-repair.public.json" target="_blank" rel="noreferrer">Open repair report ↗</a> · <a className="report-link" href="https://github.com/lawliet8886/MergeWitness/blob/main/bob_sessions/01-tenant-cache-probe-summary.png" target="_blank" rel="noreferrer">Open Bob consumption summary ↗</a></p></div><div className="pending-card complete"><span>✓</span><b>Session evidence captured</b><small>Consumption summary is stored in <code>bob_sessions/</code>.</small></div></div>}
    </section>

    <section className="method"><p className="kicker">3 · Read the outcome correctly</p><div><h2>One witness is evidence of a defect. A passing probe is only evidence about this run.</h2><p>MergeWitness reports a concrete sequence, its expected value, the observed value, and the exact probe. It does not label a merge “safe” merely because one probe passes.</p></div></section>
    {error && <p className="error" role="alert">{error}</p>}
    <footer><span>MergeWitness · Signal Foundry</span><span>Synthetic catalog fixture · browser execution</span></footer>
  </main>
}
