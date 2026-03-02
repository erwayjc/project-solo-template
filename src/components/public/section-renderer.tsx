import { HeroSection } from "./hero-section";
import { BenefitsSection } from "./benefits-section";
import { TestimonialsSection } from "./testimonials-section";
import { PricingSection } from "./pricing-section";
import { CtaSection } from "./cta-section";

const sectionComponents: Record<
  string,
  React.ComponentType<{ data: Record<string, unknown> }>
> = {
  hero: HeroSection,
  benefits: BenefitsSection,
  testimonials: TestimonialsSection,
  pricing: PricingSection,
  cta: CtaSection,
};

export function SectionRenderer({
  section,
}: {
  section: Record<string, unknown>;
}) {
  const type = section.type as string;
  const Component = sectionComponents[type];

  if (!Component) {
    // For text/content sections, render as prose
    if (section.body) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-8">
          {!!section.headline && (
            <h2 className="mb-4 text-2xl font-bold text-gray-900">
              {section.headline as string}
            </h2>
          )}
          <div className="prose max-w-none">{section.body as string}</div>
        </div>
      );
    }
    return null;
  }

  return <Component data={section} />;
}
