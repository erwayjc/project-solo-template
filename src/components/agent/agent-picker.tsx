"use client";

import { useState, useRef, useEffect } from "react";

type Agent = {
  id: string;
  name: string;
  icon: string;
  slug: string;
  description?: string;
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
  const [isOpen, setIsOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedAgent = agents.find((a) => a.slug === selected);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
        setFocusIndex(0);
      }
      return;
    }

    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((prev) => Math.min(prev + 1, agents.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      onSelect(agents[focusIndex].slug);
      setIsOpen(false);
    }
  }

  return (
    <div ref={dropdownRef} className="relative" onKeyDown={handleKeyDown}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
      >
        {selectedAgent ? (
          <>
            <span>{selectedAgent.icon}</span>
            <span>{selectedAgent.name}</span>
          </>
        ) : (
          <span className="text-gray-400">Select agent</span>
        )}
        <svg
          className={`ml-1 h-3.5 w-3.5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {agents.map((agent, index) => (
            <button
              key={agent.id}
              onClick={() => {
                onSelect(agent.slug);
                setIsOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                focusIndex === index
                  ? "bg-blue-50"
                  : "hover:bg-gray-50"
              } ${selected === agent.slug ? "text-blue-700" : "text-gray-700"}`}
            >
              <span className="text-lg">{agent.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{agent.name}</p>
                {agent.description && (
                  <p className="truncate text-xs text-gray-400">
                    {agent.description}
                  </p>
                )}
              </div>
              {selected === agent.slug && (
                <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
