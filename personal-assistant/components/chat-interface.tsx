"use client"

import type React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send } from "lucide-react"
import type { FormEvent } from "react"

interface Message {
  role: "user" | "assistant"
  content: string
  toolCalls?: Array<{
    id: string
    name: string
    args: Record<string, unknown>
  }>
  toolResponses?: Array<{
    toolCallId: string
    toolName: string
    content: string
  }>
}

interface ChatInterfaceProps {
  messages: Message[]
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  isStreaming: boolean
  streamingContent: string
}

export function ChatInterface({
  messages,
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  isStreaming,
  streamingContent,
}: ChatInterfaceProps) {
  return (
    <Card className="w-full max-w-4xl mx-auto bg-black/20 backdrop-blur-sm border-white/10">
      {/* Chat Messages */}
      <div className="h-96 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-slate-300 mt-20">
            <p>Start a conversation with your personal assistant</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className="space-y-2">
              <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.role === "user" ? "bg-blue-600 text-white" : "bg-white/10 text-white"
                  }`}
                >
                  <p>{message.content}</p>
                </div>
              </div>

              {/* Show tool calls if present */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="flex justify-start">
                  <div className="bg-purple-600/20 text-purple-200 px-3 py-1 rounded text-sm">
                    🔧 Using {message.toolCalls.map((tc) => tc.name).join(", ")}...
                  </div>
                </div>
              )}

              {/* Show tool responses if present */}
              {message.toolResponses && message.toolResponses.length > 0 && (
                <div className="flex justify-start">
                  <div className="bg-green-600/20 text-green-200 px-3 py-1 rounded text-sm max-w-xs lg:max-w-md">
                    ✅ Tool completed
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* Show streaming content */}
        {isStreaming && streamingContent && (
          <div className="flex justify-start">
            <div className="bg-white/10 text-white px-4 py-2 rounded-lg max-w-xs lg:max-w-md">
              <p>{streamingContent}</p>
              <div className="flex space-x-1 mt-1">
                <div className="w-1 h-1 bg-white rounded-full animate-bounce" />
                <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
              </div>
            </div>
          </div>
        )}

        {isLoading && !isStreaming && (
          <div className="flex justify-start">
            <div className="bg-white/10 text-white px-4 py-2 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <div className="border-t border-white/10 p-4">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            className="flex-1 bg-white/10 border-white/20 text-white placeholder-slate-400"
            disabled={isLoading || isStreaming}
          />
          <Button type="submit" disabled={isLoading || isStreaming || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </Card>
  )
}
