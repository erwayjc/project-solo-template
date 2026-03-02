"use client";

import { ChatContainer } from "@/components/agent/chat-container";

export default function DevAgentPage() {
  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <ChatContainer agentSlug="dev-agent" />
    </div>
  );
}
