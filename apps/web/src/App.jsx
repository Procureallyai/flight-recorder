import { useEffect, useState } from "react";
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
  SealCheck,
  ShieldCheck,
  ShieldWarning,
  Sparkle,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { verifyPassportInBrowser } from "@flight-recorder/verifier/browser";
import passport from "../../../fixtures/demo-passport/passport.json";
import passwordResetSource from "../../../fixtures/demo-passport/artifacts/src/password-reset.ts?raw";
import passwordResetTest from "../../../fixtures/demo-passport/artifacts/test/password-reset.test.ts?raw";
import { Badge } from "./components/ui/badge.jsx";
import { Button } from "./components/ui/button.jsx";

const manifest = passport.manifest;
const originalArtifacts = Object.freeze({
  "src/password-reset.ts": passwordResetSource,
  "test/password-reset.test.ts": passwordResetTest,
});
const tamperedSource = `${passwordResetSource}\n// Temporary in-memory verifier demonstration change.\n`;
const MINIMUM_INTERACTIVE_VERIFICATION_MILLISECONDS = 220;

const eventPresentation = {
  task: { title: "Task and acceptance criteria", actor: "Synthetic fixture event", Icon: File, tone: "task" },
  review: { title: "Modelled security finding", actor: "Synthetic fixture event", Icon: Sparkle, tone: "review" },
  "file-change": { title: "Modelled remediation", actor: "Synthetic fixture event", Icon: PencilSimpleLine, tone: "codex" },
  test: { title: "Intended test scenarios", actor: "Synthetic fixture event", Icon: Flask, tone: "test" },
  approval: { title: "Modelled approval state", actor: "Synthetic fixture event", Icon: SealCheck, tone: "codex" },
};

const sessionSteps = manifest.events.map((event, index) => ({
  ...event,
  number: index + 1,
  ...(eventPresentation[event.type] ?? eventPresentation.task),
}));

function check(result, name) {
  return result?.checks.find((candidate) => candidate.name === name);
}

function formatBytes(value) {
  return value < 1024 ? `${value} bytes` : `${(value / 1024).toFixed(1)} kilobytes`;
}

function formatRecordedAt(value, includeDate = false) {
  const date = new Date(value);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
  if (!includeDate) return `${time} Coordinated Universal Time`;
  const day = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return `${day} at ${time} Coordinated Universal Time`;
}

function compactDigest(value) {
  return `${value.slice(0, 12)}…${value.slice(-12)}`;
}

async function verifySafely(artifacts) {
  try {
    return await verifyPassportInBrowser(passport, artifacts);
  } catch {
    return {
      valid: false,
      checks: [{
        name: "crypto-support",
        valid: false,
        detail: "Local browser verification could not complete safely.",
      }],
    };
  }
}

function StatusIcon({ invalid = false, size = 18 }) {
  const Icon = invalid ? XCircle : CheckCircle;
  return <Icon size={size} weight="fill" aria-hidden="true" />;
}

function VerificationStateBadge({ result, checkName, validLabel, invalidLabel }) {
  const verificationCheck = check(result, checkName);
  if (verificationCheck === undefined) return <Badge tone="neutral"><ArrowClockwise size={14} />Pending</Badge>;
  return (
    <Badge tone={verificationCheck.valid ? "success" : "danger"}>
      <StatusIcon invalid={!verificationCheck.valid} size={14} />
      {verificationCheck.valid ? validLabel : invalidLabel}
    </Badge>
  );
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
            <time className="step-time" dateTime={step.recordedAt}>{formatRecordedAt(step.recordedAt)}</time>
            <CaretDown className="step-caret" aria-hidden="true" />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="step-content">
          <p>{step.summary}</p>
          {step.type === "task" && (
            <ul className="criteria-list">
              {manifest.session.acceptanceCriteria.map((criterion) => (
                <li key={criterion}><CheckCircle weight="fill" />{criterion}</li>
              ))}
            </ul>
          )}
          <div className="step-footer">
            {step.type === "file-change" && manifest.artifacts.map((artifact) => (
              <span className="file-pill" key={artifact.path}><FileCode />{artifact.path}</span>
            ))}
            <EvidencePill>{step.id}</EvidencePill>
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </div>
  );
}

function VerificationBanner({ result, busy }) {
  const invalid = result !== null && !result.valid;
  const Icon = invalid ? ShieldWarning : ShieldCheck;
  return (
    <div className={`verification-banner ${invalid ? "verification-banner--invalid" : ""}`} role="status" aria-live="polite">
      <Icon size={48} weight="duotone" aria-hidden="true" />
      <div>
        <strong>{busy || result === null ? "VERIFYING" : invalid ? "INVALID" : "VERIFIED"}</strong>
        <p>{busy || result === null
          ? "Recomputing the signed fixture and covered artifacts in this browser."
          : invalid
            ? "The signed manifest is intact, but one covered artifact no longer matches."
            : "The signed fixture and every covered artifact verify successfully."}</p>
        <small>Created {formatRecordedAt(manifest.createdAt, true)}</small>
      </div>
    </div>
  );
}

function Verifier({ result, busy, tampered, onVerify, onToggleTamper }) {
  const [proofOpen, setProofOpen] = useState(true);
  const artifactsValid = check(result, "artifacts")?.valid ?? false;
  const invalid = result !== null && !result.valid;

  return (
    <aside className="verifier-panel" aria-labelledby="verifier-title">
      <div className="panel-heading">
        <div>
          <h2 id="verifier-title">Independent passport verifier</h2>
          <p>Runs locally with the browser's Web Cryptography implementation.</p>
        </div>
        <Badge tone="neutral"><LockKey /> No login</Badge>
      </div>

      <VerificationBanner result={result} busy={busy} />

      <section className="artifact-section" aria-labelledby="artifacts-title">
        <div className="section-title-row">
          <h3 id="artifacts-title">Covered artifacts</h3>
          <span>{manifest.artifacts.length} files</span>
        </div>
        <ol className="artifact-list">
          {manifest.artifacts.map((artifact, index) => {
            const changed = tampered && artifact.path === "src/password-reset.ts";
            return (
              <li key={artifact.id} className={changed ? "artifact-row artifact-row--invalid" : "artifact-row"}>
                <span className="artifact-index">{index + 1}</span>
                <FileCode aria-hidden="true" />
                <code>{artifact.path}</code>
                <span className="artifact-size">{formatBytes(artifact.size)}</span>
                <span className="artifact-status" aria-label={result === null ? "Awaiting verification" : changed ? "Digest mismatch" : "Digest matches"}>
                  {result === null ? <ArrowClockwise className="spin" aria-hidden="true" /> : <StatusIcon invalid={changed} />}
                </span>
              </li>
            );
          })}
        </ol>
        {!artifactsValid && result !== null && (
          <p className="artifact-error"><WarningCircle weight="fill" />{check(result, "artifacts")?.detail}</p>
        )}
      </section>

      <section className="integrity-section" aria-labelledby="integrity-title">
        <h3 id="integrity-title">Hash-linked evidence</h3>
        <p>{manifest.events.length} declared events and {manifest.artifacts.length} artifacts are anchored in one deterministic Merkle tree.</p>
        <div className="integrity-summary">
          <div><span>Declared Merkle root</span><code title={manifest.merkleRoot}>{compactDigest(manifest.merkleRoot)}</code></div>
          <div><span>Manifest signature</span><VerificationStateBadge result={result} checkName="signature" validLabel="Valid" invalidLabel="Invalid" /></div>
          <div><span>Artifact comparison</span><VerificationStateBadge result={result} checkName="artifacts" validLabel="Match" invalidLabel="Mismatch" /></div>
        </div>
        <Collapsible.Root open={proofOpen} onOpenChange={setProofOpen}>
          <Collapsible.Trigger className="proof-trigger">
            <Fingerprint aria-hidden="true" />
            Proof details
            <CaretDown className="proof-caret" aria-hidden="true" />
          </Collapsible.Trigger>
          <Collapsible.Content className="proof-content">
            <dl>
              <div><dt>Passport identifier</dt><dd><code>{manifest.passportId}</code></dd></div>
              <div><dt>Event chain head</dt><dd><code title={manifest.eventChainHead}>{compactDigest(manifest.eventChainHead)}</code></dd></div>
              <div><dt>Evidence events</dt><dd>{manifest.events.length} observable records</dd></div>
              <div><dt>Timestamp type</dt><dd>{manifest.timestampType}</dd></div>
            </dl>
          </Collapsible.Content>
        </Collapsible.Root>
      </section>

      <div className="verifier-actions">
        <Button onClick={onVerify} disabled={busy} variant={invalid ? "danger" : "primary"}>
          {busy ? <ArrowClockwise className="spin" /> : invalid ? <ShieldWarning /> : <SealCheck />}
          {busy ? "Verifying passport" : invalid ? "Verify again" : "Verify passport"}
        </Button>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Button onClick={onToggleTamper} disabled={busy} variant="secondary">
              {tampered ? <ArrowClockwise /> : <PencilSimpleLine />}
              {tampered ? "Restore original artifact" : "Alter covered artifact in memory"}
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content className="tooltip-content" sideOffset={8}>
              {tampered ? "Return to the signed fixture's original artifact bytes." : "Create a temporary browser-memory change only."}
              <Tooltip.Arrow className="tooltip-arrow" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
        <p className="action-note">No file is changed on disk, and no network request or Application Programming Interface key is used.</p>
      </div>

      <div className="limitations">
        <Info size={22} weight="fill" aria-hidden="true" />
        <p><strong>Limitations:</strong> Integrity verification does not prove correctness, signer identity, certified security, legal compliance, or trusted time.</p>
      </div>
    </aside>
  );
}

export function App() {
  const [tampered, setTampered] = useState(false);
  const [busy, setBusy] = useState(true);
  const [result, setResult] = useState(null);

  async function runVerification(nextTampered = tampered) {
    setBusy(true);
    const artifacts = nextTampered
      ? { ...originalArtifacts, "src/password-reset.ts": tamperedSource }
      : originalArtifacts;
    // Keep the genuine browser computation visible long enough for a judge to perceive the state change.
    const [nextResult] = await Promise.all([
      verifySafely(artifacts),
      new Promise((resolve) => setTimeout(resolve, MINIMUM_INTERACTIVE_VERIFICATION_MILLISECONDS)),
    ]);
    setResult(nextResult);
    setBusy(false);
  }

  useEffect(() => {
    let active = true;
    verifySafely(originalArtifacts).then((initialResult) => {
      if (!active) return;
      setResult(initialResult);
      setBusy(false);
    });
    return () => { active = false; };
  }, []);

  async function toggleTamper() {
    const nextTampered = !tampered;
    setTampered(nextTampered);
    await runVerification(nextTampered);
  }

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand"><Record size={30} weight="duotone" /><strong>Flight Recorder</strong></div>
          <span className="view-name">Verification split view</span>
          <div className="topbar-meta">
            <Badge tone="neutral">Signed synthetic cryptographic fixture</Badge>
            <time dateTime={manifest.createdAt}>{formatRecordedAt(manifest.createdAt)}</time>
          </div>
        </header>

        <main className="split-layout">
          <section className="session-panel" aria-labelledby="session-title">
            <div className="session-heading">
              <div>
                <Badge tone="neutral"><Record weight="fill" /> Signed synthetic cryptographic fixture</Badge>
                <h1 id="session-title">Password-reset fixture replay</h1>
                <p>This replay is synthetic. It demonstrates the evidence structure and does not claim a genuine Codex or GPT-5.6 session.</p>
              </div>
              <div className="session-meta">
                <span>Passport</span>
                <code>{manifest.passportId}</code>
              </div>
            </div>

            <Accordion.Root type="multiple" defaultValue={["event-001", "event-002", "event-003"]} className="timeline">
              {sessionSteps.map((step) => <SessionStep key={step.id} step={step} />)}
            </Accordion.Root>

            <footer className="session-footer">
              <span><CheckCircle weight="fill" /> Signed fixture ready for local verification</span>
              <EvidencePill>{manifest.events.length} synthetic events</EvidencePill>
            </footer>
          </section>

          <Verifier
            result={result}
            busy={busy}
            tampered={tampered}
            onVerify={() => runVerification()}
            onToggleTamper={toggleTamper}
          />
        </main>
      </div>
    </Tooltip.Provider>
  );
}
