interface AudioManagerOptions {
  onAudioLevel: (level: number) => void
  onSpeechStart: () => void
  onSpeechEnd: () => void
  onSpeechResult: (transcript: string) => void
  onSpeakStart: () => void
  onSpeakEnd: () => void
}

export class AudioManager {
  private recognition: any | null = null
  private synthesis: SpeechSynthesis
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private microphone: MediaStreamAudioSourceNode | null = null
  private dataArray: Uint8Array | null = null
  private animationFrame: number | null = null
  private options: AudioManagerOptions

  constructor(options: AudioManagerOptions) {
    this.options = options
    this.synthesis = window.speechSynthesis
    this.initializeSpeechRecognition()
  }

  private initializeSpeechRecognition() {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      this.recognition = new SpeechRecognition()

      this.recognition.continuous = false
      this.recognition.interimResults = false
      this.recognition.lang = "en-US"

      this.recognition.onstart = () => {
        this.options.onSpeechStart()
      }

      this.recognition.onend = () => {
        this.options.onSpeechEnd()
      }

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        this.options.onSpeechResult(transcript)
      }

      this.recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error)
        this.options.onSpeechEnd()
      }
    }
  }

  async startListening() {
    if (!this.recognition) {
      console.error("Speech recognition not supported")
      return
    }

    try {
      // Initialize audio context for visualization
      await this.initializeAudioContext()
      this.recognition.start()
    } catch (error) {
      console.error("Error starting speech recognition:", error)
    }
  }

  stopListening() {
    if (this.recognition) {
      this.recognition.stop()
    }
    this.stopAudioVisualization()
  }

  speak(text: string) {
    if (!this.synthesis) {
      console.error("Speech synthesis not supported")
      return
    }

    // Cancel any ongoing speech
    this.synthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.volume = 1

    utterance.onstart = () => {
      this.options.onSpeakStart()
    }

    utterance.onend = () => {
      this.options.onSpeakEnd()
    }

    utterance.onerror = (event) => {
      console.error("Speech synthesis error:", event.error)
      this.options.onSpeakEnd()
    }

    this.synthesis.speak(utterance)
  }

  stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel()
      this.options.onSpeakEnd()
    }
  }

  private async initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.microphone = this.audioContext.createMediaStreamSource(stream)
      this.microphone.connect(this.analyser)

      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)
      this.startAudioVisualization()
    } catch (error) {
      console.error("Error initializing audio context:", error)
    }
  }

  private startAudioVisualization() {
    if (!this.analyser || !this.dataArray) return

    const updateAudioLevel = () => {
      this.analyser!.getByteFrequencyData(this.dataArray!)

      // Calculate average audio level
      const average = this.dataArray!.reduce((sum, value) => sum + value, 0) / this.dataArray!.length
      const normalizedLevel = average / 255

      this.options.onAudioLevel(normalizedLevel)
      this.animationFrame = requestAnimationFrame(updateAudioLevel)
    }

    updateAudioLevel()
  }

  private stopAudioVisualization() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
  }

  cleanup() {
    this.stopListening()
    this.stopSpeaking()
    this.stopAudioVisualization()

    if (this.audioContext) {
      this.audioContext.close()
    }
  }
}

// Extend Window interface for speech recognition
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
    AudioContext: typeof AudioContext
    webkitAudioContext: typeof AudioContext
  }
}
