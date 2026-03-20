"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function CheckoutPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const productName = searchParams.get("product");
  const priceId = searchParams.get("priceId") ?? "default";

  async function handleCheckout() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ??
            "Checkout failed. Please try again."
        );
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      } else {
        setError(
          "Unable to start checkout. Please try again or contact support."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
      {productName ? (
        <p className="mt-4 text-gray-600">
          You are purchasing:{" "}
          <span className="font-medium text-gray-900">{productName}</span>
        </p>
      ) : (
        <p className="mt-4 text-gray-600">
          Choose your plan and get started today.
        </p>
      )}
      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="mt-8">
        <button
          onClick={handleCheckout}
          disabled={isLoading}
          className="w-full rounded-md bg-blue-600 px-6 py-3 text-lg font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Processing..." : "Get Started"}
        </button>
      </div>
    </div>
  );
}
