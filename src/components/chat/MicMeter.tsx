import { useEffect, useRef } from "react";

interface MicMeterProps {
  stream: MediaStream | null;
  active: boolean;
}

/**
 * Live VU meter — 5 dots that pulse with mic input volume.
 * Uses an AudioContext + AnalyserNode; cleans up when active goes false.
 */
export function MicMeter({ stream, active }: MicMeterProps) {
  const dotsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // FIX 3: suspend/resume the singleton AudioContext instead of creating a new
  // one each activation to avoid AudioContext leaks under rapid start/stop.
  useEffect(() => {
    if (!active || !stream) {
      // Suspend and disconnect on deactivation rather than close
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      sourceRef.current?.disconnect();
      sourceRef.current = null;
      analyserRef.current = null;
      ctxRef.current?.suspend();
      dotsRef.current.forEach((d) => {
        if (d) { d.style.opacity = "0.2"; d.style.transform = "scaleY(1)"; }
      });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    // Reuse existing context if available; create once
    if (!ctxRef.current) {
      ctxRef.current = new AudioCtx();
    } else if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    const ctx = ctxRef.current;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    analyserRef.current = analyser;
    sourceRef.current = source;

    const data = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      analyser.getByteFrequencyData(data);
      // Average all bins into 0-1
      const avg = data.reduce((s, v) => s + v, 0) / (data.length * 255);
      const dots = dotsRef.current;
      for (let i = 0; i < 5; i++) {
        const dot = dots[i];
        if (!dot) continue;
        // Each dot lights up when avg exceeds a threshold staircase
        const threshold = (i + 1) / 6; // 0.167, 0.333, 0.5, 0.667, 0.833
        const lit = avg >= threshold;
        dot.style.opacity = lit ? "1" : "0.2";
        dot.style.transform = lit ? "scaleY(1.4)" : "scaleY(1)";
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      sourceRef.current?.disconnect();
      sourceRef.current = null;
      analyserRef.current = null;
      ctxRef.current?.suspend();
      dotsRef.current.forEach((d) => {
        if (d) { d.style.opacity = "0.2"; d.style.transform = "scaleY(1)"; }
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stream]);

  // Close AudioContext on final unmount
  useEffect(() => () => {
    ctxRef.current?.close();
    ctxRef.current = null;
  }, []);

  if (!active) return null;

  return (
    <span className="inline-flex items-center gap-0.5 h-4 px-1">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          ref={(el) => { dotsRef.current[i] = el; }}
          className="w-0.5 h-3 rounded-full bg-destructive transition-all duration-75"
          style={{ opacity: 0.2 }}
        />
      ))}
    </span>
  );
}
