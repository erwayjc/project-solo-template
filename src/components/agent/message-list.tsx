import { MessageBubble } from "./message-bubble";
import { ToolCallCard } from "./tool-call-card";

type Message = {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { name: string; input: unknown; result?: unknown }[];
  timestamp: string;
};

export function MessageList({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        <p>Start a conversation...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message, index) => (
        <div key={index}>
          <MessageBubble
            role={message.role}
            content={message.content}
            timestamp={message.timestamp}
          />
          {message.toolCalls?.map((tc, i) => (
            <ToolCallCard key={i} name={tc.name} input={tc.input} result={tc.result} />
          ))}
        </div>
      ))}
    </div>
  );
}
