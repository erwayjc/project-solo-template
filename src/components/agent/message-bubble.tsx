export function MessageBubble({
  role,
  content,
  timestamp,
}: {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}) {
  return (
    <div
      className={`flex ${role === "user" ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          role === "user"
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-900"
        }`}
      >
        <p className="whitespace-pre-wrap text-sm">{content}</p>
        <time
          className={`mt-1 block text-xs ${
            role === "user" ? "text-blue-200" : "text-gray-400"
          }`}
        >
          {new Date(timestamp).toLocaleTimeString()}
        </time>
      </div>
    </div>
  );
}
