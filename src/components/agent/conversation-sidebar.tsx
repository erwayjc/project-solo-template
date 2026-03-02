"use client";

type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
};

export function ConversationSidebar({
  conversations,
  selected,
  onSelect,
  onNew,
}: {
  conversations: Conversation[];
  selected?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex h-full w-64 flex-col border-r bg-white">
      <div className="border-b p-3">
        <button
          onClick={onNew}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New Conversation
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full px-3 py-3 text-left text-sm hover:bg-gray-50 ${
              selected === c.id ? "bg-blue-50" : ""
            }`}
          >
            <p className="truncate font-medium text-gray-900">{c.title}</p>
            <p className="text-xs text-gray-400">
              {new Date(c.updatedAt).toLocaleDateString()}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
