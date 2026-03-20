"use server"

import { requireAuth } from "@/lib/auth/helpers"

export async function getPageTemplates(category?: string) {
  const { supabase } = await requireAuth()

  let query = supabase
    .from("page_templates")
    .select("id, name, category, description, design_notes")
    .eq("is_active", true)
    .order("category")

  if (category) {
    query = query.eq("category", category)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  return data ?? []
}

export async function getPageTemplate(templateId: string) {
  const { supabase } = await requireAuth()

  const { data, error } = await supabase
    .from("page_templates")
    .select("*")
    .eq("id", templateId)
    .eq("is_active", true)
    .single()

  if (error || !data) throw new Error("Template not found")

  return data
}
