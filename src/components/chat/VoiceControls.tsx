import { useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MicButtonProps {
  onTranscript: (text: string) => void;
  byokKey: string | undefined;
}

export function MicButton({ onTranscript, byokKey }: MicButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // P1b: guard against overlapping start() calls (double-click / slow permission prompt)
  const startingRef = useRef(false);

  // Hide if MediaRecorder unsupported (older Safari, locked iOS)
  if (typeof MediaRecorder === "undefined") return null;

  // Cleanup on unmount
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      // MEDIUM: stop the live stream even if onstop hasn't fired yet
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function start() {
    if (!byokKey) return;
    // P1b: prevent overlapping recorder starts
    if (startingRef.current || isRecording) return;
    startingRef.current = true;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // MEDIUM: keep stream ref so unmount cleanup can stop it
      streamRef.current = stream;

      // P1a: MediaRecorder constructor may throw on unsupported mimeType (e.g. Safari/iOS).
      // On throw, stop the live stream immediately so the mic indicator goes dark.
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      } catch {
        // Fallback: try audio/mp4, then let the browser pick
        try {
          recorder = new MediaRecorder(stream, { mimeType: "audio/mp4" });
        } catch {
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          setError("Recording not supported in this browser");
          return;
        }
      }

      const mimeType = recorder.mimeType || "audio/webm";
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const ext = mimeType.includes("mp4") ? "audio.mp4" : "audio.webm";
        try {
          const form = new FormData();
          form.append("file", blob, ext);
          form.append("model", "whisper-1");
          const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${byokKey}` },
            body: form,
          });
          if (!res.ok) throw new Error(`Whisper ${res.status}`);
          const data = await res.json();
          if (data.text) onTranscript(data.text);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Transcription failed");
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
      // 30s auto-stop
      timeoutRef.current = setTimeout(() => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
          setIsRecording(false);
        }
      }, 30_000);
    } catch {
      setError("Microphone permission denied");
      setIsRecording(false);
    } finally {
      // P1b: always release the guard so a subsequent attempt is allowed
      startingRef.current = false;
    }
  }

  function stop() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setIsRecording(false);
  }

  const disabled = !byokKey;
  const title = disabled
    ? "Add an OpenAI key in BYOK settings to use voice"
    : error
    ? error
    : isRecording
    ? "Stop recording"
    : "Start recording";

  return (
    <button
      type="button"
      onClick={isRecording ? stop : start}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
        disabled
          ? "text-muted-foreground/40 cursor-not-allowed"
          : isRecording
          ? "bg-destructive/10 text-destructive ring-2 ring-destructive/40 animate-pulse"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
      aria-label={isRecording ? "Stop recording" : "Start voice input"}
    >
      {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}

interface TTSButtonProps {
  text: string;
  byokKey: string | undefined;
}

export function TTSButton({ text, byokKey }: TTSButtonProps) {
  const [playing, setPlaying] = useState(false);
  // P2a: prevent duplicate in-flight fetches while a request is loading
  const [loading, setLoading] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // P2b: track the current object URL so we can revoke it before creating a new one
  const audioUrlRef = useRef<string | null>(null);
  const truncatedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
    // P2b: revoke on unmount to release the blob memory
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    if (truncatedTimerRef.current) clearTimeout(truncatedTimerRef.current);
  }, []);

  if (!byokKey || !text) return null;

  async function play() {
    if (playing) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlaying(false);
      return;
    }
    // P2a: bail out if a fetch is already in flight
    if (loading) return;
    setLoading(true);
    if (text.length > 4000) {
      setTruncated(true);
      if (truncatedTimerRef.current) clearTimeout(truncatedTimerRef.current);
      truncatedTimerRef.current = setTimeout(() => setTruncated(false), 5000);
    }
    try {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${byokKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "tts-1", voice: "nova", input: text.slice(0, 4000) }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      // P2b: revoke the previous URL before creating a new one
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audio.onended = () => setPlaying(false);
      audioRef.current = audio;
      setPlaying(true);
      await audio.play();
    } catch {
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={play}
        // P2a: disable while a fetch is in flight
        disabled={loading}
        title={playing ? "Stop playback" : loading ? "Loading…" : "Play with TTS"}
        className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={playing ? "Stop playback" : "Play with TTS"}
      >
        <Volume2 className={cn("h-3.5 w-3.5", playing && "text-primary")} />
      </button>
      {truncated && (
        <span className="text-[10px] text-muted-foreground">
          Truncated to first 4000 chars for TTS.
        </span>
      )}
    </span>
  );
}
