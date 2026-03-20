export interface LandingPageTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  sections: Record<string, unknown>[];
}

export const LANDING_PAGE_TEMPLATES: LandingPageTemplate[] = [
  {
    id: "saas-product",
    name: "SaaS Product",
    description:
      "Perfect for software products and apps. Includes features, social proof, pricing, and FAQ.",
    category: "Software",
    sections: [
      {
        type: "hero",
        headline: "Build better products, faster",
        body: "The modern platform that helps teams streamline their workflow, ship with confidence, and focus on what matters most.",
        cta: { text: "Start Free Trial", url: "/checkout" },
      },
      {
        type: "features",
        headline: "Everything you need to ship",
        subtitle:
          "Powerful tools designed to help you move from idea to launch without the overhead.",
        items: [
          {
            icon: "\u26A1",
            title: "Lightning Fast",
            description:
              "Built for speed from the ground up. Sub-second response times keep your team in flow.",
          },
          {
            icon: "\uD83D\uDD12",
            title: "Enterprise Security",
            description:
              "SOC 2 compliant with end-to-end encryption. Your data stays safe and private.",
          },
          {
            icon: "\uD83D\uDD04",
            title: "Seamless Integrations",
            description:
              "Connect with the tools you already use. Slack, GitHub, Jira, and 50+ more.",
          },
          {
            icon: "\uD83D\uDCCA",
            title: "Real-time Analytics",
            description:
              "Track progress and spot bottlenecks with dashboards that update in real time.",
          },
          {
            icon: "\uD83E\uDD1D",
            title: "Team Collaboration",
            description:
              "Built for teams of any size. Comments, mentions, and shared workspaces.",
          },
          {
            icon: "\uD83C\uDF1F",
            title: "AI-Powered",
            description:
              "Smart suggestions and automation that learn from your workflow patterns.",
          },
        ],
      },
      {
        type: "stats",
        headline: "Trusted by teams worldwide",
        items: [
          { value: "10K+", label: "Active Teams" },
          { value: "99.9%", label: "Uptime" },
          { value: "50%", label: "Faster Shipping" },
          { value: "24/7", label: "Support" },
        ],
      },
      {
        type: "testimonials",
        headline: "What our customers say",
        items: [
          {
            name: "Sarah Chen",
            quote:
              "We cut our sprint cycle time in half within the first month. The workflow automation alone pays for itself.",
            role: "VP of Engineering, Acme Corp",
          },
          {
            name: "Marcus Johnson",
            quote:
              "Finally a tool that our whole team actually enjoys using. The interface is clean and intuitive.",
            role: "Product Manager, TechStart",
          },
          {
            name: "Elena Rodriguez",
            quote:
              "The integrations saved us hours of manual work every week. It just works with our existing stack.",
            role: "CTO, ScaleUp Labs",
          },
        ],
      },
      {
        type: "pricing",
        headline: "Simple, transparent pricing",
        plans: [
          {
            name: "Starter",
            price: "$29/mo",
            features: [
              "Up to 10 team members",
              "Core features",
              "5 integrations",
              "Email support",
            ],
            cta: { text: "Get Started", url: "/checkout" },
          },
          {
            name: "Pro",
            price: "$79/mo",
            features: [
              "Unlimited team members",
              "All features",
              "Unlimited integrations",
              "Priority support",
              "Custom workflows",
              "Advanced analytics",
            ],
            highlighted: true,
            cta: { text: "Start Free Trial", url: "/checkout" },
          },
        ],
      },
      {
        type: "faq",
        headline: "Frequently asked questions",
        items: [
          {
            question: "How long is the free trial?",
            answer:
              "The free trial lasts 14 days with full access to all Pro features. No credit card required to start.",
          },
          {
            question: "Can I change plans later?",
            answer:
              "Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.",
          },
          {
            question: "Is there a setup fee?",
            answer:
              "No setup fees or hidden costs. You only pay the monthly subscription price shown above.",
          },
          {
            question: "Do you offer refunds?",
            answer:
              "We offer a 30-day money-back guarantee. If you are not satisfied, contact support for a full refund.",
          },
          {
            question: "What kind of support do you offer?",
            answer:
              "Starter plans include email support with 24-hour response times. Pro plans include priority support with 2-hour response times and dedicated account management.",
          },
        ],
      },
      {
        type: "cta",
        headline: "Ready to get started?",
        body: "Join thousands of teams already shipping faster. Start your free trial today.",
        cta: { text: "Start Free Trial", url: "/checkout" },
      },
    ],
  },
  {
    id: "online-course",
    name: "Online Course",
    description:
      "Sell courses and workshops. Highlights curriculum, instructor credibility, and student results.",
    category: "Education",
    sections: [
      {
        type: "hero",
        headline: "Master the skills that matter",
        body: "A hands-on course designed to take you from beginner to confident practitioner. Learn at your own pace with lifetime access.",
        cta: { text: "Enroll Now", url: "/checkout" },
      },
      {
        type: "benefits",
        headline: "What you will learn",
        items: [
          {
            title: "Foundation Concepts",
            description:
              "Build a rock-solid understanding of the fundamentals that everything else builds on.",
          },
          {
            title: "Real-World Projects",
            description:
              "Apply what you learn with hands-on projects based on actual industry scenarios.",
          },
          {
            title: "Advanced Techniques",
            description:
              "Go beyond the basics with strategies and patterns used by top professionals.",
          },
          {
            title: "Career Toolkit",
            description:
              "Portfolio pieces, interview prep, and networking strategies to land your next opportunity.",
          },
          {
            title: "Community Access",
            description:
              "Join a private community of learners for feedback, accountability, and collaboration.",
          },
          {
            title: "Lifetime Updates",
            description:
              "Get free access to all future course updates as the field evolves.",
          },
        ],
      },
      {
        type: "feature_highlight",
        headline: "Learn from an industry expert",
        body: "Your instructor brings over 10 years of professional experience and has helped thousands of students launch successful careers. The curriculum is constantly updated to reflect current best practices.",
        layout: "image_right",
        cta: { text: "See the Curriculum", url: "#curriculum" },
      },
      {
        type: "testimonials",
        headline: "Student success stories",
        items: [
          {
            name: "Jamie Torres",
            quote:
              "This course completely changed my career trajectory. I went from feeling stuck to landing a role I love within 3 months of completing it.",
            role: "Career Changer",
          },
          {
            name: "Alex Kim",
            quote:
              "The projects are incredibly well designed. I still reference them in my day-to-day work. Worth every penny.",
            role: "Junior Developer",
          },
          {
            name: "Priya Patel",
            quote:
              "The community alone makes this worth it. I have made lifelong connections and found accountability partners.",
            role: "Freelancer",
          },
        ],
      },
      {
        type: "pricing",
        headline: "Invest in yourself",
        plans: [
          {
            name: "Self-Paced",
            price: "$197",
            features: [
              "Full course access",
              "All project files",
              "Community access",
              "Lifetime updates",
            ],
            cta: { text: "Enroll Now", url: "/checkout" },
          },
          {
            name: "With Coaching",
            price: "$497",
            features: [
              "Everything in Self-Paced",
              "4 live coaching calls",
              "Direct message access",
              "Portfolio review",
              "Certificate of completion",
            ],
            highlighted: true,
            cta: { text: "Enroll with Coaching", url: "/checkout" },
          },
        ],
      },
      {
        type: "faq",
        headline: "Common questions",
        items: [
          {
            question: "How long do I have access?",
            answer:
              "You get lifetime access to the course and all future updates. Learn at your own pace.",
          },
          {
            question: "Do I need prior experience?",
            answer:
              "No, this course starts from the fundamentals. Whether you are a complete beginner or looking to fill gaps in your knowledge, you will find the content valuable.",
          },
          {
            question: "Is there a refund policy?",
            answer:
              "Yes, we offer a 30-day money-back guarantee. If the course is not right for you, just reach out and we will process a full refund.",
          },
          {
            question: "How much time should I dedicate per week?",
            answer:
              "Most students spend 5\u201310 hours per week and complete the course in 6\u20138 weeks. But since you have lifetime access, you can go at whatever pace works for you.",
          },
        ],
      },
      {
        type: "cta",
        headline: "Start your learning journey today",
        body: "Join thousands of students who have transformed their skills and careers.",
        cta: { text: "Enroll Now", url: "/checkout" },
      },
    ],
  },
  {
    id: "newsletter",
    name: "Newsletter / Lead Magnet",
    description:
      "Capture email subscribers with a compelling lead magnet or newsletter signup page.",
    category: "Marketing",
    sections: [
      {
        type: "hero",
        headline: "Get smarter about your business in 5 minutes a week",
        body: "Join 15,000+ entrepreneurs who get actionable strategies, case studies, and insights delivered every Tuesday morning.",
        cta: { text: "Subscribe Free", url: "/opt-in" },
      },
      {
        type: "benefits",
        headline: "What you get",
        items: [
          {
            title: "Actionable Strategies",
            description:
              "No fluff. Every edition includes at least one tactic you can implement the same day.",
          },
          {
            title: "Case Studies",
            description:
              "Learn from real businesses. We break down what works, what does not, and why.",
          },
          {
            title: "Curated Resources",
            description:
              "The best tools, articles, and frameworks hand-picked from across the web.",
          },
        ],
      },
      {
        type: "testimonials",
        headline: "What readers are saying",
        items: [
          {
            name: "David Park",
            quote:
              "This is the only newsletter I read every single week. The case studies alone have saved me from making costly mistakes.",
            role: "Founder, ParkCo",
          },
          {
            name: "Rachel Liu",
            quote:
              "Short, practical, and actually useful. I have implemented dozens of ideas from this newsletter into my business.",
            role: "Solo Entrepreneur",
          },
          {
            name: "Tom Bradley",
            quote:
              "I forward this to my entire team every week. It is become required reading for us.",
            role: "CEO, Bradley & Co",
          },
        ],
      },
      {
        type: "cta",
        headline: "Join the community",
        body: "Free to subscribe. Unsubscribe anytime. No spam, ever.",
        cta: { text: "Subscribe Free", url: "/opt-in" },
      },
    ],
  },
  {
    id: "consulting",
    name: "Consulting / Services",
    description:
      "Showcase your expertise and services. Built for consultants, agencies, and freelancers.",
    category: "Services",
    sections: [
      {
        type: "hero",
        headline: "Grow your business with expert guidance",
        body: "Strategic consulting for ambitious businesses ready to scale. We bring the expertise so you can focus on execution.",
        cta: { text: "Book a Free Consultation", url: "/opt-in" },
      },
      {
        type: "features",
        headline: "How we help",
        subtitle:
          "Proven frameworks and hands-on support to accelerate your growth.",
        items: [
          {
            icon: "\uD83C\uDFAF",
            title: "Strategy Development",
            description:
              "Clarify your vision and build a roadmap that aligns your team around measurable goals.",
          },
          {
            icon: "\uD83D\uDCC8",
            title: "Growth Optimization",
            description:
              "Identify your highest-leverage opportunities and build systems to capture them.",
          },
          {
            icon: "\u2699\uFE0F",
            title: "Operations Improvement",
            description:
              "Streamline workflows, reduce overhead, and build processes that scale.",
          },
          {
            icon: "\uD83D\uDC65",
            title: "Team Development",
            description:
              "Build high-performing teams with the right structure, hiring, and culture.",
          },
          {
            icon: "\uD83D\uDCB0",
            title: "Revenue Strategy",
            description:
              "Optimize pricing, packaging, and sales processes to increase revenue per customer.",
          },
          {
            icon: "\uD83D\uDE80",
            title: "Launch Support",
            description:
              "Go-to-market planning and execution support for new products and services.",
          },
        ],
      },
      {
        type: "stats",
        items: [
          { value: "200+", label: "Clients Served" },
          { value: "3.5x", label: "Avg. Revenue Growth" },
          { value: "12+", label: "Years Experience" },
          { value: "95%", label: "Client Retention" },
        ],
      },
      {
        type: "testimonials",
        headline: "Client results",
        items: [
          {
            name: "Lisa Nguyen",
            quote:
              "Working with them was a turning point for our business. We doubled revenue within 8 months of implementing their strategy.",
            role: "CEO, Bloom Studio",
          },
          {
            name: "James Wright",
            quote:
              "They do not just give advice \u2014 they roll up their sleeves and help you execute. That is what sets them apart.",
            role: "Founder, Wright Ventures",
          },
          {
            name: "Amy Foster",
            quote:
              "The operational improvements they helped us make freed up 20 hours per week across our team. Game changer.",
            role: "COO, GreenPath Inc",
          },
        ],
      },
      {
        type: "cta",
        headline: "Let us talk about your goals",
        body: "Book a free 30-minute consultation to see how we can help your business grow.",
        cta: { text: "Book a Free Consultation", url: "/opt-in" },
      },
    ],
  },
  {
    id: "product-launch",
    name: "Product Launch",
    description:
      "Launch a new product with impact. Combines feature highlights, social proof, and urgency.",
    category: "Commerce",
    sections: [
      {
        type: "hero",
        headline: "Introducing the next generation of [Product]",
        body: "Redesigned from the ground up. Faster, smarter, and built for the way you actually work.",
        cta: { text: "Pre-Order Now", url: "/checkout" },
      },
      {
        type: "feature_highlight",
        headline: "Designed with purpose",
        body: "Every detail has been carefully considered. From the materials we chose to the interface you interact with, quality is not negotiable.",
        layout: "image_right",
        cta: { text: "See the Details", url: "#features" },
      },
      {
        type: "benefits",
        headline: "Why you will love it",
        items: [
          {
            title: "Premium Build Quality",
            description:
              "Crafted with materials that look great and stand the test of time.",
          },
          {
            title: "Effortless Setup",
            description:
              "Unbox it, turn it on, and you are ready to go. No complicated configuration.",
          },
          {
            title: "All-Day Performance",
            description:
              "Optimized to keep up with your busiest days without slowing down.",
          },
        ],
      },
      {
        type: "stats",
        headline: "By the numbers",
        items: [
          { value: "2x", label: "Faster Performance" },
          { value: "40%", label: "Lighter Design" },
          { value: "18hr", label: "Battery Life" },
          { value: "5yr", label: "Warranty" },
        ],
      },
      {
        type: "pricing",
        headline: "Choose your edition",
        plans: [
          {
            name: "Standard",
            price: "$299",
            features: [
              "Core product",
              "Standard accessories",
              "1-year warranty",
              "Free shipping",
            ],
            cta: { text: "Pre-Order", url: "/checkout" },
          },
          {
            name: "Premium",
            price: "$449",
            features: [
              "Enhanced product",
              "Premium accessories kit",
              "5-year warranty",
              "Priority shipping",
              "Exclusive color options",
            ],
            highlighted: true,
            cta: { text: "Pre-Order Premium", url: "/checkout" },
          },
        ],
      },
      {
        type: "faq",
        headline: "Questions about the launch",
        items: [
          {
            question: "When does it ship?",
            answer:
              "Pre-orders begin shipping within 2 weeks of the launch date. You will receive a tracking number via email.",
          },
          {
            question: "What is included in the box?",
            answer:
              "The Standard edition includes the product, quick-start guide, and standard accessories. The Premium edition includes additional accessories and a premium carry case.",
          },
          {
            question: "Can I return it if I do not like it?",
            answer:
              "Yes, we offer a 30-day return policy. If you are not completely satisfied, return it for a full refund.",
          },
          {
            question: "Is international shipping available?",
            answer:
              "Yes, we ship to over 50 countries. Shipping costs and delivery times vary by location.",
          },
        ],
      },
      {
        type: "cta",
        headline: "Be first in line",
        body: "Pre-order today and be among the first to experience what is next.",
        cta: { text: "Pre-Order Now", url: "/checkout" },
      },
    ],
  },
];

export function getTemplateById(
  id: string
): LandingPageTemplate | undefined {
  return LANDING_PAGE_TEMPLATES.find((t) => t.id === id);
}
