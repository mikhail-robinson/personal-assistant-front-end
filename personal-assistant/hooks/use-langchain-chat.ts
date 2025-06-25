'use client'

import { useState, useCallback } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: Array<{
    id: string
    name: string
    args: any
  }>
  toolResponses?: Array<{
    toolCallId: string
    toolName: string
    content: string
  }>
}

interface StreamEvent {
  type:
    | 'content'
    | 'ai_tool_request'
    | 'tool_response'
    | 'final_ai_response'
    | 'stream_end'
  data?: string
  message_id?: string
  tool_calls?: Array<{
    id: string
    name: string
    args: any
  }>
  tool_call_id?: string
  tool_name?: string
  content?: string
}

export function useLangchainChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return

    // Add user message immediately
    const userMessage: Message = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMessage])

    setIsLoading(true)
    setIsStreaming(false)
    setStreamingContent('')

    try {
      const response = await fetch('http://localhost:8000/chat/invoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      setIsLoading(false)
      setIsStreaming(true)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const currentAssistantMessage: Message = {
        role: 'assistant',
        content: '',
        toolCalls: [],
        toolResponses: [],
      }

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Process complete SSE messages
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || '' // Keep incomplete message in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const eventData: StreamEvent = JSON.parse(line.slice(6))

                switch (eventData.type) {
                  case 'content':
                    if (eventData.data) {
                      currentAssistantMessage.content += eventData.data
                      setStreamingContent(currentAssistantMessage.content)
                    }
                    break

                  case 'ai_tool_request':
                    if (eventData.tool_calls) {
                      currentAssistantMessage.toolCalls = eventData.tool_calls
                      // Update messages to show tool usage
                      setMessages((prev) => {
                        const newMessages = [...prev];
                        const lastMessageIndex = newMessages.length - 1;

                        if (lastMessageIndex >= 0 && newMessages[lastMessageIndex].role === 'assistant') {
                          // Update the last assistant message
                          newMessages[lastMessageIndex] = {
                            ...newMessages[lastMessageIndex],
                            content: "", // Clear content as it's handled by streamingContent
                            toolCalls: currentAssistantMessage.toolCalls, // Set/update toolCalls
                          };
                        } else {
                          // Add a new assistant message placeholder for tool calls
                          newMessages.push({
                            role: 'assistant',
                            content: "", // Handled by streamingContent
                            toolCalls: currentAssistantMessage.toolCalls,
                            toolResponses: [],
                          });
                        }
                        return newMessages;
                      });
                    }
                    break

                  case 'tool_response':
                    if (
                      eventData.tool_call_id &&
                      eventData.tool_name &&
                      eventData.content
                    ) {
                      if (!currentAssistantMessage.toolResponses) {
                        currentAssistantMessage.toolResponses = []
                      }
                      currentAssistantMessage.toolResponses.push({
                        toolCallId: eventData.tool_call_id,
                        toolName: eventData.tool_name,
                        content: eventData.content, // This is the tool's output
                      })

                      // Update the UI to reflect the tool response
                      setMessages((prev) => {
                        const newMessages = [...prev]
                        const lastMessageIndex = newMessages.length - 1
                        if (lastMessageIndex >= 0 && newMessages[lastMessageIndex].role === "assistant") {
                          newMessages[lastMessageIndex] = {
                            ...newMessages[lastMessageIndex], // Preserve content (should be ""), toolCalls
                            toolResponses: [...(currentAssistantMessage.toolResponses || [])],
                          }
                        }
                        return newMessages
                      })
                    }
                    break

                  case 'final_ai_response':
                    if (eventData.content) {
                      currentAssistantMessage.content = eventData.content
                      setStreamingContent('')
                      setMessages((prev) => {
                        // Replace the last assistant message or add new one
                        const newMessages = [...prev]
                        const lastMessage = newMessages[newMessages.length - 1]
                        if (lastMessage && lastMessage.role === 'assistant') {
                          newMessages[newMessages.length - 1] =
                            currentAssistantMessage
                        } else {
                          newMessages.push(currentAssistantMessage)
                        }
                        return newMessages
                      })
                    }
                    break

                  case 'stream_end':
                    setIsStreaming(false)
                    setStreamingContent('')
                    break
                }
              } catch (parseError) {
                console.error('Error parsing SSE data:', parseError)
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Sorry, I encountered an error while processing your request. Please try again.',
        },
      ])
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
      setStreamingContent('')
    }
  }, [])

  const resetChat = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/chat/reset', {
        method: 'POST',
      })

      if (response.ok) {
        setMessages([])
        setInput('')
        setStreamingContent('')
      } else {
        console.error('Failed to reset chat')
      }
    } catch (error) {
      console.error('Error resetting chat:', error)
    }
  }, [])

  return {
    messages,
    input,
    setInput,
    isLoading,
    isStreaming,
    streamingContent,
    sendMessage,
    resetChat,
  }
}
