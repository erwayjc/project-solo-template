import type { Metadata } from 'next'
import { getTestimonials } from '@/actions/testimonials'
import { TestimonialsAdmin } from '@/components/admin/testimonials-admin'

export const metadata: Metadata = {
  title: 'Testimonials - Admin',
}

export default async function TestimonialsPage() {
  const testimonials = await getTestimonials()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Testimonials</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage customer testimonials displayed on your public pages.
        </p>
      </div>
      <TestimonialsAdmin initialTestimonials={testimonials} />
    </div>
  )
}
