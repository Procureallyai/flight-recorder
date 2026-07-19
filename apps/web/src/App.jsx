import { useState } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import * as Collapsible from "@radix-ui/react-collapsible";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  ArrowClockwise,
  CaretDown,
  CheckCircle,
  File,
  FileCode,
  Fingerprint,
  Flask,
  Info,
  LockKey,
  PencilSimpleLine,
  Record,
  Robot,
  SealCheck,
  ShieldCheck,
  ShieldWarning,
  Sparkle,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { Badge } from "./components/ui/badge.jsx";
import { Button } from "./components/ui/button.jsx";

const sessionSteps = [
  {
    id: "task",
    number: 1,
    title: "Task and acceptance criteria",
    actor: "Human request",
    time: "14:31:02",
    Icon: File,
    tone: "task",
    summary: "Implement a secure password-reset flow with expiring, single-use tokens.",
    criteria: [
      "Return the same public response for known and unknown accounts.",
      "Never place raw tokens or direct account identifiers in telemetry.",
      "Record a safe audit event and test expiry and consume-once behaviour.",
    ],
    evidence: ["ev_000001"],
  },
  {
    id: "initial",
    number: 2,
    title: "Initial Codex implementation",
    actor: "Codex",
    time: "14:31:47",
    Icon: Robot,
    tone: "codex",
    summary: "Implemented the first password-reset endpoint and focused tests.",
    files: ["src/password-reset.ts"],
    evidence: ["ev_000009"],
  },
  {
    id: "finding",
    number: 3,
    title: "GPT-5.6 security finding",
    actor: "Advisory review",
    time: "14:33:21",
    Icon: Sparkle,
    tone: "review",
    summary: "Account enumeration and raw token logging were supported by captured evidence.",
    findings: [
      "Known and unknown accounts returned different public responses.",
      "A raw reset token appeared in the initial log payload.",
    ],
    evidence: ["ev_000009", "ev_000015"],
  },
  {
    id: "remediation",
    number: 4,
    title: "Codex remediation",
    actor: "Codex",
    time: "14:34:02",
    Icon: PencilSimpleLine,
    tone: "codex",
    summary: "Standardised responses, removed sensitive telemetry, and added real expiry and consume-once behaviour.",
    files: ["src/password-reset.ts"],
    evidence: ["ev_000013"],
  },
  {
    id: "tests",
    number: 5,
    title: "Tests passed",
    actor: "Codex execution",
    time: "14:36:11",
    Icon: Flask,
    tone: "test",
    summary: "Expiry boundaries, repeated and concurrent redemption, neutral responses, and safe telemetry passed.",
    files: ["test/password-reset.test.ts"],
    evidence: ["ev_000015"],
  },
];

const coveredArtifacts = [
  { name: "src/password-reset.ts", size: "4.2 KB", mutable: true },
  { name: "test/password-reset.test.ts", size: "9.8 KB" },
  { name: "CODEX_TASK.md", size: "1.9 KB" },
  { name: "package.json", size: "0.2 KB" },
];

function StatusIcon({ invalid = false, size = 18 }) {
  const Icon = invalid ? XCircle : CheckCircle;
  return <Icon size={size} weight="fill" aria-hidden="true" />;
}

function EvidencePill({ children }) {
  return <code className="evidence-pill">{children}</code>;
}

function SessionStep({ step }) {
  const { Icon } = step;
  return (
    <div className="timeline-row">
      <div className="timeline-rail" aria-hidden="true">
        <span className="timeline-number">{step.number}</span>
        <span className="timeline-state"><CheckCircle weight="fill" /></span>
      </div>
      <Accordion.Item value={step.id} className="step-card">
        <Accordion.Header>
          <Accordion.Trigger className="step-trigger">
            <span className={`step-icon step-icon--${step.tone}`}><Icon weight="duotone" /></span>
            <span className="step-title-group">
              <span className="step-title">{step.title}</span>
              <span className="step-actor">{step.actor}</span>
            </span>
            <time className="step-time" dateTime={`2026-07-19T${step.time}+01:00`}>19 Jul 2026 · {step.time}</time>
            <CaretDown className="step-caret" aria-hidden="true" />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="step-content">
          <p>{step.summary}</p>
          {step.criteria && (
            <ul className="criteria-list">
              {step.criteria.map((criterion) => <li key={criterion}><CheckCircle weight="fill" />{criterion}</li>)}
            </ul>
          )}
          {step.findings && (
            <ul className="finding-list">
              {step.findings.map((finding) => <li key={finding}>{finding}</li>)}
            </ul>
          )}
          <div className="step-footer">
            {step.files?.map((file) => <span className="file-pill" key={file}><FileCode />{file}</span>)}
            {step.evidence.map((id) => <EvidencePill key={id}>{id}</EvidencePill>)}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </div>
  );
}

function VerificationBanner({ invalid, busy }) {
  const Icon = invalid ? ShieldWarning : ShieldCheck;
  return (
    <div className={`verification-banner ${invalid ? "verification-banner--invalid" : ""}`} role="status" aria-live="polite">
      <Icon size={48} weight="duotone" aria-hidden="true" />
      <div>
        <strong>{busy ? "VERIFYING" : invalid ? "INVALID" : "VERIFIED"}</strong>
        <p>{busy ? "Recomputing the covered evidence." : invalid ? "The passport no longer matches one covered artifact." : "The passport matches every covered artifact."}</p>
        <small>{invalid ? "In-memory change detected at 14:37:22" : "Verified at 14:36:45 on 19 July 2026"}</small>
      </div>
    </div>
  );
}

function Verifier({ invalid, busy, onVerify, onToggleTamper }) {
  const [proofOpen, setProofOpen] = useState(true);
  return (
    <aside className="verifier-panel" aria-labelledby="verifier-title">
      <div className="panel-heading">
        <div>
          <h2 id="verifier-title">Independent passport verifier</h2>
          <p>Checks the signed passport independently of the session replay.</p>
        </div>
        <Badge tone="neutral"><LockKey /> No login</Badge>
      </div>

      <VerificationBanner invalid={invalid} busy={busy} />

      <section className="artifact-section" aria-labelledby="artifacts-title">
        <div className="section-title-row">
          <h3 id="artifacts-title">Covered artifacts</h3>
          <span>{coveredArtifacts.length} files</span>
        </div>
        <ol className="artifact-list">
          {coveredArtifacts.map((artifact, index) => {
            const changed = invalid && artifact.mutable;
            return (
              <li key={artifact.name} className={changed ? "artifact-row artifact-row--invalid" : "artifact-row"}>
                <span className="artifact-index">{index + 1}</span>
                <FileCode aria-hidden="true" />
                <code>{artifact.name}</code>
                <span className="artifact-size">{artifact.size}</span>
                <span className="artifact-status" aria-label={changed ? "Hash mismatch" : "Hash matches"}><StatusIcon invalid={changed} /></span>
              </li>
            );
          })}
        </ol>
        {invalid && <p className="artifact-error"><WarningCircle weight="fill" /> `src/password-reset.ts` does not match the sealed passport.</p>}
      </section>

      <section className="integrity-section" aria-labelledby="integrity-title">
        <h3 id="integrity-title">Hash-linked evidence</h3>
        <p>Artifacts and observable events are anchored in one deterministic Merkle tree.</p>
        <div className="integrity-summary">
          <div><span>Merkle root</span><code>8f2a9c7e5d1b4a6f…9d3b7e0c</code></div>
          <div><span>Ed25519 signature</span><Badge tone={invalid ? "danger" : "success"}><StatusIcon invalid={invalid} size={14} />{invalid ? "Invalid" : "Valid"}</Badge></div>
        </div>
        <Collapsible.Root open={proofOpen} onOpenChange={setProofOpen}>
          <Collapsible.Trigger className="proof-trigger">
            <Fingerprint aria-hidden="true" />
            Proof details
            <CaretDown className="proof-caret" aria-hidden="true" />
          </Collapsible.Trigger>
          <Collapsible.Content className="proof-content">
            <dl>
              <div><dt>Event chain head</dt><dd><code>ac08d93e…51e0bc72</code></dd></div>
              <div><dt>Evidence leaves</dt><dd>23 observable records</dd></div>
              <div><dt>Signer public key</dt><dd><code>a94f3c2e…4c3d2e</code></dd></div>
              <div><dt>Timestamp type</dt><dd>Local recorded time</dd></div>
            </dl>
          </Collapsible.Content>
        </Collapsible.Root>
      </section>

      <div className="verifier-actions">
        <Button onClick={onVerify} disabled={busy} variant={invalid ? "danger" : "primary"}>
          {busy ? <ArrowClockwise className="spin" /> : invalid ? <ShieldWarning /> : <SealCheck />}
          {busy ? "Verifying passport" : invalid ? "Verify again" : "Verify passport"}
        </Button>
        <Tooltip.Provider delayDuration={200}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <Button onClick={onToggleTamper} variant="secondary">
                {invalid ? <ArrowClockwise /> : <PencilSimpleLine />}
                {invalid ? "Restore original artifact" : "Alter covered artifact in memory"}
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="tooltip-content" sideOffset={8}>
                {invalid ? "Return to the sealed artifact bytes." : "Creates a temporary browser-memory change only."}
                <Tooltip.Arrow className="tooltip-arrow" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
        <p className="action-note">This safe demonstration never changes a file on disk.</p>
      </div>

      <div className="limitations">
        <Info size={22} weight="fill" aria-hidden="true" />
        <p><strong>Limitations:</strong> Integrity verification does not prove correctness, signer identity, certified security, legal compliance, or trusted time.</p>
      </div>
    </aside>
  );
}

export function App() {
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);

  function verifyPassport() {
    setBusy(true);
    window.setTimeout(() => setBusy(false), 650);
  }

  return (
    <Tooltip.Provider>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand"><Record size={30} weight="duotone" /><strong>Flight Recorder</strong></div>
          <span className="view-name">Verification split view</span>
          <div className="topbar-meta">
            <Badge tone="neutral">Recorded judge demo</Badge>
            <time dateTime="2026-07-19">19 July 2026</time>
          </div>
        </header>

        <main className="split-layout">
          <section className="session-panel" aria-labelledby="session-title">
            <div className="session-heading">
              <div>
                <Badge tone="success"><Record weight="fill" /> Integration preview</Badge>
                <h1 id="session-title">Password-reset engineering session</h1>
                <p>Replay the request, implementation, GPT-5.6 review, remediation, and test evidence.</p>
              </div>
              <div className="session-meta">
                <span>Session</span>
                <code>sess_7c9f…a12e</code>
              </div>
            </div>

            <Accordion.Root type="multiple" defaultValue={["task", "finding", "remediation"]} className="timeline">
              {sessionSteps.map((step) => <SessionStep key={step.id} step={step} />)}
            </Accordion.Root>

            <footer className="session-footer">
              <span><CheckCircle weight="fill" /> Demonstration evidence is ready to record</span>
              <EvidencePill>Build Week checkpoint</EvidencePill>
            </footer>
          </section>

          <Verifier
            invalid={invalid}
            busy={busy}
            onVerify={verifyPassport}
            onToggleTamper={() => setInvalid((current) => !current)}
          />
        </main>
      </div>
    </Tooltip.Provider>
  );
}
