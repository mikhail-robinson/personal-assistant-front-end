interface AudioManagerOptions {
  onAudioLevel: (level: number) => void
  onSpeechStart: () => void
  onSpeechEnd: () => void
  onSpeechResult: (transcript: string) => void
  onSpeakStart: () => void
  onSpeakEnd: () => void
  onError?: (error: string) => void
}

export class AudioManager {
  private options: AudioManagerOptions
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private stream: MediaStream | null = null

  // For audio visualization
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private microphone: MediaStreamAudioSourceNode | null = null
  private dataArray: Uint8Array | null = null
  private animationFrame: number | null = null

  // For TTS
  private audioQueue: HTMLAudioElement[] = []
  private isPlaying = false

  constructor(options: AudioManagerOptions) {
    this.options = options
  }

  private async initializeMedia(): Promise<boolean> {
    if (this.stream) return true
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      this.microphone = this.audioContext.createMediaStreamSource(this.stream)
      this.microphone.connect(this.analyser)
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)
      this.startAudioVisualization()
      return true
    } catch (error) {
      console.error("Error initializing media:", error)
      this.options.onError?.("Error initializing microphone: " + (error as Error).message)
      return false
    }
  }

  async startListening() {
    const mediaInitialized = await this.initializeMedia()
    if (!mediaInitialized || !this.stream) {
      this.options.onSpeechEnd() // Ensure state is reset
      return
    }

    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      console.log("Already recording.")
      return
    }

    try {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "audio/webm"
      console.log("Using MIME type:", mimeType)

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType })
      this.audioChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: mimeType })
        this.audioChunks = []

        if (audioBlob.size === 0) {
          console.warn("Audio blob is empty, not sending.")
          this.options.onSpeechEnd()
          this.options.onError?.("No audio recorded.")
          return
        }

        const formData = new FormData()
        const fileName = "recording." + (mimeType.split("/")[1]?.split(";")[0] ?? "webm")
        formData.append("audio", audioBlob, fileName)

        try {
          // NOTE: The STT endpoint was changed in the plan to /stt/transcribe
          // This ensures consistency with the new TTS endpoint.
          const response = await fetch("http://localhost:8001/stt/transcribe", {
            method: "POST",
            body: formData,
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
            throw new Error(`STT server error: ${response.status} ${errorData.detail || response.statusText}`)
          }

          const result = await response.json()
          if (result.status === "ok" && result.response) {
            this.options.onSpeechResult(result.response)
          } else {
            throw new Error(result.response || "STT request failed with no specific message.")
          }
        } catch (error) {
          console.error("Error sending audio to STT backend:", error)
          this.options.onError?.("Error transcribing audio: " + (error as Error).message)
        } finally {
          this.options.onSpeechEnd()
        }
      }

      this.mediaRecorder.start()
      this.options.onSpeechStart()
    } catch (error) {
      console.error("Error starting MediaRecorder:", error)
      this.options.onError?.("Error starting recording: " + (error as Error).message)
      this.options.onSpeechEnd()
    }
  }

  stopListening() {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.stop()
    }
    // Immediately update the UI state to reflect that listening has stopped.
    this.options.onSpeechEnd()
  }

  private startAudioVisualization() {
    if (!this.analyser || !this.dataArray || !this.audioContext || this.audioContext.state === "closed") return
    const update = () => {
      if (!this.analyser || !this.dataArray || !this.audioContext || this.audioContext.state === "closed") {
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame)
        return
      }
      this.analyser.getByteFrequencyData(this.dataArray)
      const average = this.dataArray.reduce((sum, value) => sum + value, 0) / this.dataArray.length
      this.options.onAudioLevel(average / 255)
      this.animationFrame = requestAnimationFrame(update)
    }
    update()
  }

  private stopAudioVisualization() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
  }

  async speak(text: string) {
    if (!text.trim()) return

    try {
      const response = await fetch("http://localhost:8002/tts/synthesize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "TTS server error" }))
        throw new Error(errorData.detail)
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      this.audioQueue.push(audio)
      if (!this.isPlaying) {
        this.playNextInQueue()
      }
    } catch (error) {
      console.error("Error synthesizing speech:", error)
      this.options.onError?.("Failed to generate speech.")
    }
  }

  private playNextInQueue() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false
      this.options.onSpeakEnd() // Ensure state is reset when the queue is empty
      return
    }

    this.isPlaying = true
    const audio = this.audioQueue[0]

    const onEnded = () => {
      URL.revokeObjectURL(audio.src) // Clean up the object URL
      this.audioQueue.shift() // Remove the played audio from the queue
      this.playNextInQueue()
    }

    audio.addEventListener("ended", onEnded)
    audio.addEventListener("error", (e) => {
      console.error("Error playing audio:", e)
      this.options.onError?.("Failed to play audio.")
      onEnded() // Move to the next item even if this one fails
    })

    this.options.onSpeakStart()
    audio.play().catch((e) => {
      console.error("Audio play failed:", e)
      this.options.onError?.("Audio playback was prevented.")
      onEnded() // Ensure queue continues
    })
  }

  stopSpeaking() {
    if (this.audioQueue.length > 0) {
      const currentAudio = this.audioQueue[0]
      currentAudio.pause()
      currentAudio.currentTime = 0
      // Clean up the entire queue
      this.audioQueue.forEach(audio => URL.revokeObjectURL(audio.src));
      this.audioQueue = []
      this.isPlaying = false
      this.options.onSpeakEnd()
    }
  }

  cleanup() {
    this.stopListening()
    this.stopSpeaking()
    this.stopAudioVisualization()

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }
    if (this.microphone) {
      this.microphone.disconnect()
      this.microphone = null
    }
    if (this.analyser) {
      this.analyser.disconnect()
      this.analyser = null
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(console.error)
      this.audioContext = null
    }
  }
}

declare global {
  interface Window {
    AudioContext: typeof AudioContext
    webkitAudioContext: typeof AudioContext
  }
}
