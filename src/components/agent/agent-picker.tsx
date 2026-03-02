"use client";

type Agent = {
  id: string;
  name: string;
  icon: string;
  slug: string;
};

export function AgentPicker({
  agents,
  selected,
  onSelect,
}: {
  agents: Agent[];
  selected?: string;
  onSelect: (slug: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto p-2">
      {agents.map((agent) => (
        <button
          key={agent.id}
          onClick={() => onSelect(agent.slug)}
          className={`flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
            selected === agent.slug
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <span>{agent.icon}</span>
          <span>{agent.name}</span>
        </button>
      ))}
    </div>
  );
}
