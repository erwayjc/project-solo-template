import { IntegrationGate } from "@/components/shared/integration-gate";
import { DevAgentChat } from "@/components/agent/dev-agent-chat";

export const metadata = { title: "Dev Agent - Admin" };

export default function DevAgentPage() {
  const anthropicConnected = !!process.env.ANTHROPIC_API_KEY;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <IntegrationGate
        integration="anthropic"
        isConnected={anthropicConnected}
      >
        <DevAgentChat />
      </IntegrationGate>
    </div>
  );
}
