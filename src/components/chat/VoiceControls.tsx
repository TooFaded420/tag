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
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hide if MediaRecorder unsupported (older Safari, locked iOS)
  if (typeof MediaRecorder === "undefined") return null;

  // Cleanup on unmount
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function start() {
    if (!byokKey) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        try {
          const form = new FormData();
          form.append("file", blob, "audio.webm");
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  if (!byokKey || !text) return null;

  async function play() {
    if (playing) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlaying(false);
      return;
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
      const audio = new Audio(URL.createObjectURL(blob));
      audio.onended = () => setPlaying(false);
      audioRef.current = audio;
      setPlaying(true);
      await audio.play();
    } catch {
      setPlaying(false);
    }
  }

  return (
    <button
      type="button"
      onClick={play}
      title={playing ? "Stop playback" : "Play with TTS"}
      className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
      aria-label={playing ? "Stop playback" : "Play with TTS"}
    >
      <Volume2 className={cn("h-3.5 w-3.5", playing && "text-primary")} />
    </button>
  );
}
