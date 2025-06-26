"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Mic, MicOff, MessageSquare, Volume2, VolumeX, RotateCcw } from "lucide-react"
import { VoiceVisualizer } from "@/components/voice-visualizer"
import { ChatInterface } from "@/components/chat-interface"
import { AudioManager } from "@/lib/audio-manager"
import { useLangchainChat } from "@/hooks/use-langchain-chat"

export default function PersonalAssistant() {
  const [isVoiceMode, setIsVoiceMode] = useState(true)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const audioManagerRef = useRef<AudioManager | null>(null)

  const { messages, input, setInput, isLoading, isStreaming, sendMessage, resetChat, streamingContent } =
    useLangchainChat()

  useEffect(() => {
    // Initialize audio manager
    audioManagerRef.current = new AudioManager({
      onAudioLevel: setAudioLevel,
      onSpeechStart: () => {
        setIsListening(true)
        setError(null)
      },
      onSpeechEnd: () => setIsListening(false),
      onSpeechResult: handleVoiceInput,
      onSpeakStart: () => setIsSpeaking(true),
      onSpeakEnd: () => setIsSpeaking(false),
      onError: (err) => setError(err),
    })

    return () => {
      audioManagerRef.current?.cleanup()
    }
  }, [])

  const handleVoiceInput = async (transcript: string) => {
    if (!transcript.trim()) return

    await sendMessage(transcript)

    // Convert AI response to speech when in voice mode (will be implemented later)
    // if (isVoiceMode && isAudioEnabled && response) {
    //   handleTextToSpeech(response)
    // }
  }

  const handleTextToSpeech = (text: string) => {
    audioManagerRef.current?.speak(text)
  }

  const toggleListening = () => {
    if (isListening) {
      audioManagerRef.current?.stopListening()
    } else {
      audioManagerRef.current?.startListening()
    }
  }

  const toggleMode = () => {
    setIsVoiceMode(!isVoiceMode)
    if (isListening) {
      audioManagerRef.current?.stopListening()
    }
    if (isSpeaking) {
      audioManagerRef.current?.stopSpeaking()
    }
  }

  const toggleAudio = () => {
    setIsAudioEnabled(!isAudioEnabled)
    if (!isAudioEnabled && isSpeaking) {
      audioManagerRef.current?.stopSpeaking()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    await sendMessage(input)
    setInput("")
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Personal Assistant</h1>
          <p className="text-slate-300">Your intelligent companion powered by LangChain</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex justify-center mb-8">
          <Card className="p-2 bg-black/20 backdrop-blur-sm border-white/10">
            <div className="flex items-center space-x-2">
              <Button variant={isVoiceMode ? "default" : "ghost"} size="sm" onClick={toggleMode} className="text-white">
                <Mic className="w-4 h-4 mr-2" />
                Voice
              </Button>
              <Button
                variant={!isVoiceMode ? "default" : "ghost"}
                size="sm"
                onClick={toggleMode}
                className="text-white"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Chat
              </Button>
              <div className="w-px h-6 bg-white/20 mx-2" />
              <Button variant="ghost" size="sm" onClick={toggleAudio} className="text-white">
                {isAudioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={resetChat} className="text-white">
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Main Interface */}
        {isVoiceMode ? (
          <div className="flex flex-col items-center space-y-8">
            {/* Voice Visualizer */}
            <VoiceVisualizer
              isListening={isListening}
              isSpeaking={isSpeaking}
              audioLevel={audioLevel}
              isLoading={isLoading || isStreaming}
            />

            {/* Voice Controls */}
            <div className="flex items-center space-x-4">
              <Button
                onClick={toggleListening}
                size="lg"
                variant={isListening ? "destructive" : "default"}
                className="rounded-full w-16 h-16"
                disabled={isLoading || isStreaming}
              >
                {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </Button>
            </div>

            {/* Status */}
            <div className="text-center">
              <p className="text-white text-lg">
                {isListening
                  ? "Listening..."
                  : isSpeaking
                    ? "Speaking..."
                    : isLoading || isStreaming
                      ? "Thinking..."
                      : error
                        ? "Error, tap to retry"
                        : "Tap to speak"}
              </p>
              {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>

            {/* Recent Messages (Voice Mode) */}
            {messages.length > 0 && (
              <Card className="w-full max-w-2xl bg-black/20 backdrop-blur-sm border-white/10 p-6">
                <div className="space-y-4 max-h-60 overflow-y-auto">
                  {messages.slice(-3).map((message, index) => (
                    <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-xs px-4 py-2 rounded-lg ${
                          message.role === "user" ? "bg-blue-600 text-white" : "bg-white/10 text-white"
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                      </div>
                    </div>
                  ))}
                  {/* Show streaming content in voice mode */}
                  {isStreaming && streamingContent && (
                    <div className="flex justify-start">
                      <div className="bg-white/10 text-white px-4 py-2 rounded-lg max-w-xs">
                        <p className="text-sm">{streamingContent}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        ) : (
          <ChatInterface
            messages={messages}
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
          />
        )}
      </div>
    </div>
  )
}
