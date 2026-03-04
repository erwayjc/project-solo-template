import { createClient } from '@/lib/supabase/server'

export async function TestimonialsSection({
  data,
}: {
  data: Record<string, unknown>
}) {
  const jsonbItems =
    (data.items as { name: string; quote: string; role?: string }[]) || []

  let items: { name: string; quote: string; role?: string }[] = []

  if (jsonbItems.length > 0) {
    // Use JSONB data if provided (backwards compatible)
    items = jsonbItems
  } else {
    // Fall back to database testimonials
    try {
      const supabase = await createClient()
      const { data: dbTestimonials } = await supabase
        .from('testimonials')
        .select('name, quote, role')
        .eq('is_published', true)
        .order('sort_order', { ascending: true })

      if (dbTestimonials && dbTestimonials.length > 0) {
        items = dbTestimonials.map((t) => ({
          name: t.name,
          quote: t.quote,
          role: t.role ?? undefined,
        }))
      }
    } catch (err) {
      console.error('Failed to load testimonials from DB:', err)
    }
  }

  if (items.length === 0) return null

  const headline = (data.headline as string) || 'What Our Customers Say'

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
          {headline}
        </h2>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <blockquote
              key={index}
              className="rounded-lg border bg-gray-50 p-6"
            >
              <p className="text-gray-700">&ldquo;{item.quote}&rdquo;</p>
              <footer className="mt-4">
                <p className="font-semibold text-gray-900">{item.name}</p>
                {item.role && (
                  <p className="text-sm text-gray-500">{item.role}</p>
                )}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  )
}
