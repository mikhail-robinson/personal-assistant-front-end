"use client"

import { useEffect, useRef } from "react"

interface VoiceVisualizerProps {
  isListening: boolean
  isSpeaking: boolean
  audioLevel: number
  isLoading: boolean
}

export function VoiceVisualizer({ isListening, isSpeaking, audioLevel, isLoading }: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    let time = 0

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Base parameters
      const baseRadius = 80
      const pulseIntensity = isListening || isSpeaking ? audioLevel * 50 + 20 : 10
      const particleCount = 100

      // Create swirling cloud effect
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + time * 0.01
        const radius = baseRadius + Math.sin(time * 0.02 + i * 0.1) * pulseIntensity
        const x = centerX + Math.cos(angle) * radius
        const y = centerY + Math.sin(angle) * radius

        // Particle properties
        const size = 2 + Math.sin(time * 0.03 + i * 0.2) * 1
        const opacity = 0.3 + Math.sin(time * 0.02 + i * 0.15) * 0.3

        // Color based on state
        let color = "rgba(147, 197, 253, " // Blue for idle
        if (isListening) {
          color = "rgba(34, 197, 94, " // Green for listening
        } else if (isSpeaking) {
          color = "rgba(239, 68, 68, " // Red for speaking
        } else if (isLoading) {
          color = "rgba(168, 85, 247, " // Purple for loading
        }

        ctx.beginPath()
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fillStyle = color + opacity + ")"
        ctx.fill()

        // Add glow effect
        ctx.shadowBlur = 10
        ctx.shadowColor = color + "0.5)"
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // Central core
      const coreRadius = 20 + pulseIntensity * 0.3
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius)

      if (isListening) {
        gradient.addColorStop(0, "rgba(34, 197, 94, 0.8)")
        gradient.addColorStop(1, "rgba(34, 197, 94, 0.1)")
      } else if (isSpeaking) {
        gradient.addColorStop(0, "rgba(239, 68, 68, 0.8)")
        gradient.addColorStop(1, "rgba(239, 68, 68, 0.1)")
      } else if (isLoading) {
        gradient.addColorStop(0, "rgba(168, 85, 247, 0.8)")
        gradient.addColorStop(1, "rgba(168, 85, 247, 0.1)")
      } else {
        gradient.addColorStop(0, "rgba(147, 197, 253, 0.8)")
        gradient.addColorStop(1, "rgba(147, 197, 253, 0.1)")
      }

      ctx.beginPath()
      ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      time += 1
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isListening, isSpeaking, audioLevel, isLoading])

  return (
    <div className="relative">
      <canvas ref={canvasRef} width={400} height={400} className="rounded-full" />

      {/* Outer ring */}
      <div
        className={`absolute inset-0 rounded-full border-2 ${
          isListening
            ? "border-green-400 animate-pulse"
            : isSpeaking
              ? "border-red-400 animate-pulse"
              : isLoading
                ? "border-purple-400 animate-spin"
                : "border-blue-400/30"
        }`}
      />
    </div>
  )
}
