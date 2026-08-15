import { useEffect, useState } from 'react';
import { useApp } from '../store';

const STEPS = [
  { t: 'Tap a place on the map', d: 'see live routes & time to get there' },
  { t: 'Search above', d: 'jump straight to any spot in the city' },
  { t: 'Try "How far?"', d: 'drag the bubble to feel distances' },
];

export default function Tour() {
  const { state, dispatch } = useApp();
  const done = state.explore.tourDone;
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (done) return;
    const t = window.setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(t);
  }, [done]);

  useEffect(() => {
    if (done) return;
    if (state.explore.selection) setStep((s) => Math.max(s, 1));
    if (state.explore.isoOpen || state.explore.traceOpen) setStep((s) => Math.max(s, 2));
  }, [done, state.explore.selection, state.explore.isoOpen, state.explore.traceOpen]);

  useEffect(() => {
    if (done) return;
    const t = window.setTimeout(() => setStep((s) => (s < STEPS.length - 1 ? s + 1 : s)), 9000);
    return () => clearTimeout(t);
  }, [done, step]);

  if (done || !show) return null;

  const finish = () => dispatch({ type: 'TOUR_DONE' });
  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : finish());

  return (
    <div className="tour" role="status">
      <div className="tour-body">
        <span className="tour-step">{step + 1}/{STEPS.length}</span>
        <strong>{STEPS[step].t}</strong>
        <span className="muted">{STEPS[step].d}</span>
      </div>
      <div className="tour-dots">
        {STEPS.map((_, i) => (
          <i key={i} className={i === step ? 'on' : ''} />
        ))}
      </div>
      <div className="tour-actions">
        <button type="button" className="mini" onClick={finish}>
          skip
        </button>
        <button type="button" className="btn primary" onClick={next}>
          {step < STEPS.length - 1 ? 'Next' : 'Done'}
        </button>
      </div>
    </div>
  );
}
