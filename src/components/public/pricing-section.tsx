import Link from "next/link";

export function PricingSection({ data }: { data: Record<string, unknown> }) {
  const plans =
    (data.plans as {
      name: string;
      price: string;
      interval?: string;
      features: string[];
      cta_url: string;
      highlighted?: boolean;
    }[]) || [];

  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-6xl px-4">
        {!!data.headline && (
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            {data.headline as string}
          </h2>
        )}
        <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`rounded-lg bg-white p-8 shadow-sm ${
                plan.highlighted ? "ring-2 ring-blue-600" : "border"
              }`}
            >
              <h3 className="text-xl font-semibold text-gray-900">
                {plan.name}
              </h3>
              <p className="mt-4">
                <span className="text-4xl font-bold text-gray-900">
                  {plan.price}
                </span>
                {plan.interval && (
                  <span className="text-gray-500">/{plan.interval}</span>
                )}
              </p>
              <ul className="mt-6 space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center text-gray-600">
                    <svg
                      className="mr-2 h-5 w-5 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.cta_url || "/checkout"}
                className={`mt-8 block rounded-md px-4 py-2 text-center font-medium ${
                  plan.highlighted
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                Get Started
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
