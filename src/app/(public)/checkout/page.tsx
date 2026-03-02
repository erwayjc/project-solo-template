"use client";

import { useState } from "react";

export default function CheckoutPage() {
  const [isLoading, setIsLoading] = useState(false);

  async function handleCheckout(priceId: string) {
    setIsLoading(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
      <p className="mt-4 text-gray-600">
        Choose your plan and get started today.
      </p>
      <div className="mt-8">
        <button
          onClick={() => handleCheckout("default")}
          disabled={isLoading}
          className="w-full rounded-md bg-blue-600 px-6 py-3 text-lg font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Processing..." : "Get Started"}
        </button>
      </div>
    </div>
  );
}
