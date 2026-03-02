"use client";

import { useParams } from "next/navigation";
import { ChatContainer } from "@/components/agent/chat-container";

export default function AgentChatPage() {
  const params = useParams<{ id: string }>();

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <ChatContainer agentId={params.id} />
    </div>
  );
}
