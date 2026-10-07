import { useEffect, useRef, useState } from 'react';
import {
  MECHANISM_COPY,
  MECHANISM_STORYBOARD,
  drawHillsideMechanism,
  mechanismPhase,
} from '../domain/hillsideMechanism.js';

function paint(canvas, play, reduced) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  if (reduced) {
    const frame = MECHANISM_STORYBOARD[2];
    drawHillsideMechanism(ctx, { width, height, t: frame.t, treat: false, title: frame.title });
    return;
  }
  const phase = play >= 1 ? MECHANISM_STORYBOARD[3] : mechanismPhase(play);
  drawHillsideMechanism(ctx, {
    width,
    height,
    t: phase.treat ? 0 : Math.min(play, 1),
    treat: phase.treat,
    title: phase.title,
  });
}

export function HillsideMechanismAnimation() {
  const canvasRef = useRef(null);
  const playRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(Boolean(media?.matches));
    sync();
    media?.addEventListener?.('change', sync);
    return () => media?.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    paint(canvas, reduced ? 0.92 : playRef.current, reduced);
    if (reduced || !playing) return undefined;

    let last = performance.now();
    let frame = 0;
    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      playRef.current += dt / 4.2;
      if (playRef.current > 1.18) {
        playRef.current = 1.18;
        setPlaying(false);
        paint(canvas, playRef.current, false);
        return;
      }
      paint(canvas, playRef.current, false);
      frame = window.requestAnimationFrame(tick);
    }
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing, reduced]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => !entry.isIntersecting)) setPlaying(false);
    }, { threshold: 0.15 });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  function replay() {
    playRef.current = 0;
    paint(canvasRef.current, 0, reduced);
    if (!reduced) setPlaying(true);
  }

  return (
    <section className="early-action" data-testid="hillside-mechanism">
      <b>{MECHANISM_COPY.title}</b>
      <canvas
        ref={canvasRef}
        width="640"
        height="280"
        className="mechanism-canvas"
        role="img"
        aria-label={MECHANISM_COPY.alt}
        data-testid="mechanism-canvas"
      />
      <div className="mechanism-controls">
        <button
          type="button"
          className="flow-tertiary"
          data-testid="mechanism-play"
          disabled={reduced}
          onClick={() => setPlaying(true)}
        >
          {MECHANISM_COPY.play}
        </button>
        <button
          type="button"
          className="flow-tertiary"
          data-testid="mechanism-pause"
          disabled={reduced}
          onClick={() => setPlaying(false)}
        >
          {MECHANISM_COPY.pause}
        </button>
        <button type="button" className="flow-tertiary" data-testid="mechanism-replay" onClick={replay}>
          {MECHANISM_COPY.replay}
        </button>
      </div>
      <p>{MECHANISM_COPY.caption}</p>
    </section>
  );
}
