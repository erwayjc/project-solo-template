"use client";

import { ChatContainer } from "@/components/agent/chat-container";

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Support</h1>
      <p className="mt-2 text-gray-600">
        Chat with our AI assistant for help with your account or course content.
      </p>
      <div className="mt-6">
        <ChatContainer agentSlug="support-agent" />
      </div>
    </div>
  );
}
