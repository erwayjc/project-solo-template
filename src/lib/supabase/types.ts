// ---------------------------------------------------------------------------
// Supabase Database types — hand-written to match SQL migrations (00001–00028).
// Replace this file with auto-generated types once Supabase is running:
//   npx supabase gen types typescript --local > src/lib/supabase/types.ts
// ---------------------------------------------------------------------------

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          role: string
          stripe_customer_id: string | null
          resend_contact_id: string | null
          email_opt_out: boolean
          metadata: Json
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          email?: string | null
          role?: string
          stripe_customer_id?: string | null
          resend_contact_id?: string | null
          email_opt_out?: boolean
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string | null
          role?: string
          stripe_customer_id?: string | null
          resend_contact_id?: string | null
          email_opt_out?: boolean
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }

      site_config: {
        Row: {
          id: number
          site_name: string
          tagline: string
          logo_url: string | null
          brand_colors: Json
          social_links: Json
          seo_defaults: Json
          master_context: string
          admin_user_id: string | null
          setup_complete: boolean
          analytics_id: string | null
          legal_business_name: string | null
          legal_contact_email: string | null
          cs_agent_config: Json
          onboarding_checklist: Json
          resend_webhook_secret: string | null
          stripe_connect_account_id: string | null
          page_design_tokens: Json
          template_version: string
          last_migration_number: number
          update_available: boolean
          update_history: Json
        }
        Insert: {
          id?: number
          site_name?: string
          tagline?: string
          logo_url?: string | null
          brand_colors?: Json
          social_links?: Json
          seo_defaults?: Json
          master_context?: string
          admin_user_id?: string | null
          setup_complete?: boolean
          analytics_id?: string | null
          legal_business_name?: string | null
          legal_contact_email?: string | null
          cs_agent_config?: Json
          onboarding_checklist?: Json
          resend_webhook_secret?: string | null
          stripe_connect_account_id?: string | null
          page_design_tokens?: Json
          template_version?: string
          last_migration_number?: number
          update_available?: boolean
          update_history?: Json
        }
        Update: {
          id?: number
          site_name?: string
          tagline?: string
          logo_url?: string | null
          brand_colors?: Json
          social_links?: Json
          seo_defaults?: Json
          master_context?: string
          admin_user_id?: string | null
          setup_complete?: boolean
          analytics_id?: string | null
          legal_business_name?: string | null
          legal_contact_email?: string | null
          cs_agent_config?: Json
          onboarding_checklist?: Json
          resend_webhook_secret?: string | null
          stripe_connect_account_id?: string | null
          page_design_tokens?: Json
          template_version?: string
          last_migration_number?: number
          update_available?: boolean
          update_history?: Json
        }
        Relationships: []
      }

      products: {
        Row: {
          id: string
          name: string
          description: string
          stripe_product_id: string | null
          stripe_price_id: string | null
          price_amount: number
          currency: string
          price_type: string
          subscription_interval: string | null
          features: Json
          is_active: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string
          stripe_product_id?: string | null
          stripe_price_id?: string | null
          price_amount?: number
          currency?: string
          price_type?: string
          subscription_interval?: string | null
          features?: Json
          is_active?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          stripe_product_id?: string | null
          stripe_price_id?: string | null
          price_amount?: number
          currency?: string
          price_type?: string
          subscription_interval?: string | null
          features?: Json
          is_active?: boolean
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }

      purchases: {
        Row: {
          id: string
          user_id: string
          product_id: string
          stripe_payment_id: string | null
          amount: number
          currency: string
          status: string
          purchased_at: string
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          stripe_payment_id?: string | null
          amount?: number
          currency?: string
          status?: string
          purchased_at?: string
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          stripe_payment_id?: string | null
          amount?: number
          currency?: string
          status?: string
          purchased_at?: string
          expires_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'purchases_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchases_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }

      modules: {
        Row: {
          id: string
          product_id: string | null
          title: string
          description: string
          sort_order: number
          is_published: boolean
          created_at: string
        }
        Insert: {
          id?: string
          product_id?: string | null
          title: string
          description?: string
          sort_order?: number
          is_published?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string | null
          title?: string
          description?: string
          sort_order?: number
          is_published?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'modules_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }

      lessons: {
        Row: {
          id: string
          module_id: string
          title: string
          content: string
          video_url: string | null
          downloads: Json
          sort_order: number
          is_published: boolean
          created_at: string
        }
        Insert: {
          id?: string
          module_id: string
          title: string
          content?: string
          video_url?: string | null
          downloads?: Json
          sort_order?: number
          is_published?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          module_id?: string
          title?: string
          content?: string
          video_url?: string | null
          downloads?: Json
          sort_order?: number
          is_published?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lessons_module_id_fkey'
            columns: ['module_id']
            isOneToOne: false
            referencedRelation: 'modules'
            referencedColumns: ['id']
          },
        ]
      }

      lesson_progress: {
        Row: {
          id: string
          user_id: string
          lesson_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          lesson_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          lesson_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lesson_progress_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lesson_progress_lesson_id_fkey'
            columns: ['lesson_id']
            isOneToOne: false
            referencedRelation: 'lessons'
            referencedColumns: ['id']
          },
        ]
      }

      leads: {
        Row: {
          id: string
          email: string
          name: string | null
          source: string
          status: string
          lead_magnet: string | null
          tags: string[]
          metadata: Json
          unsubscribed: boolean
          unsubscribed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          source?: string
          status?: string
          lead_magnet?: string | null
          tags?: string[]
          metadata?: Json
          unsubscribed?: boolean
          unsubscribed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          source?: string
          status?: string
          lead_magnet?: string | null
          tags?: string[]
          metadata?: Json
          unsubscribed?: boolean
          unsubscribed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }

      pages: {
        Row: {
          id: string
          slug: string
          sections: Json
          seo: Json
          is_published: boolean
          created_at: string
          render_mode: string
          html_content: string | null
          html_content_previous: string | null
          sanitized_at: string | null
          view_count: number
          container_type: string
          funnel_id: string | null
        }
        Insert: {
          id?: string
          slug: string
          sections?: Json
          seo?: Json
          is_published?: boolean
          created_at?: string
          render_mode?: string
          html_content?: string | null
          html_content_previous?: string | null
          sanitized_at?: string | null
          view_count?: number
          container_type?: string
          funnel_id?: string | null
        }
        Update: {
          id?: string
          slug?: string
          sections?: Json
          seo?: Json
          is_published?: boolean
          created_at?: string
          render_mode?: string
          html_content?: string | null
          html_content_previous?: string | null
          sanitized_at?: string | null
          view_count?: number
          container_type?: string
          funnel_id?: string | null
        }
        Relationships: []
      }

      email_sequences: {
        Row: {
          id: string
          name: string
          trigger: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          trigger?: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          trigger?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }

      email_sequence_steps: {
        Row: {
          id: string
          sequence_id: string
          step_number: number
          subject: string
          body: string
          delay_hours: number
          created_at: string
        }
        Insert: {
          id?: string
          sequence_id: string
          step_number: number
          subject: string
          body: string
          delay_hours?: number
          created_at?: string
        }
        Update: {
          id?: string
          sequence_id?: string
          step_number?: number
          subject?: string
          body?: string
          delay_hours?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'email_sequence_steps_sequence_id_fkey'
            columns: ['sequence_id']
            isOneToOne: false
            referencedRelation: 'email_sequences'
            referencedColumns: ['id']
          },
        ]
      }

      email_sends: {
        Row: {
          id: string
          recipient_email: string
          sequence_id: string | null
          step_id: string | null
          resend_id: string | null
          status: string
          sent_at: string | null
          opened_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          recipient_email: string
          sequence_id?: string | null
          step_id?: string | null
          resend_id?: string | null
          status?: string
          sent_at?: string | null
          opened_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          recipient_email?: string
          sequence_id?: string | null
          step_id?: string | null
          resend_id?: string | null
          status?: string
          sent_at?: string | null
          opened_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'email_sends_sequence_id_fkey'
            columns: ['sequence_id']
            isOneToOne: false
            referencedRelation: 'email_sequences'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'email_sends_step_id_fkey'
            columns: ['step_id']
            isOneToOne: false
            referencedRelation: 'email_sequence_steps'
            referencedColumns: ['id']
          },
        ]
      }

      broadcasts: {
        Row: {
          id: string
          subject: string
          body: string
          audience_filter: Json
          status: string
          scheduled_for: string | null
          sent_at: string | null
          stats: Json
          created_at: string
        }
        Insert: {
          id?: string
          subject: string
          body: string
          audience_filter?: Json
          status?: string
          scheduled_for?: string | null
          sent_at?: string | null
          stats?: Json
          created_at?: string
        }
        Update: {
          id?: string
          subject?: string
          body?: string
          audience_filter?: Json
          status?: string
          scheduled_for?: string | null
          sent_at?: string | null
          stats?: Json
          created_at?: string
        }
        Relationships: []
      }

      sequence_enrollments: {
        Row: {
          id: string
          email: string
          sequence_id: string
          current_step: number
          status: string
          started_at: string
          last_sent_at: string | null
          next_send_at: string | null
          completed_at: string | null
          processing_started_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          sequence_id: string
          current_step?: number
          status?: string
          started_at?: string
          last_sent_at?: string | null
          next_send_at?: string | null
          completed_at?: string | null
          processing_started_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          sequence_id?: string
          current_step?: number
          status?: string
          started_at?: string
          last_sent_at?: string | null
          next_send_at?: string | null
          completed_at?: string | null
          processing_started_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sequence_enrollments_sequence_id_fkey'
            columns: ['sequence_id']
            isOneToOne: false
            referencedRelation: 'email_sequences'
            referencedColumns: ['id']
          },
        ]
      }

      blog_posts: {
        Row: {
          id: string
          title: string
          slug: string
          content: string
          excerpt: string
          featured_image: string | null
          tags: string[]
          seo: Json
          status: string
          published_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          content?: string
          excerpt?: string
          featured_image?: string | null
          tags?: string[]
          seo?: Json
          status?: string
          published_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          slug?: string
          content?: string
          excerpt?: string
          featured_image?: string | null
          tags?: string[]
          seo?: Json
          status?: string
          published_at?: string | null
          created_at?: string
        }
        Relationships: []
      }

      content_queue: {
        Row: {
          id: string
          platform: string
          content: string
          media_urls: string[]
          status: string
          scheduled_for: string | null
          buffer_id: string | null
          source_content_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          platform: string
          content: string
          media_urls?: string[]
          status?: string
          scheduled_for?: string | null
          buffer_id?: string | null
          source_content_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          platform?: string
          content?: string
          media_urls?: string[]
          status?: string
          scheduled_for?: string | null
          buffer_id?: string | null
          source_content_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'content_queue_source_content_id_fkey'
            columns: ['source_content_id']
            isOneToOne: false
            referencedRelation: 'blog_posts'
            referencedColumns: ['id']
          },
        ]
      }

      support_tickets: {
        Row: {
          id: string
          user_id: string | null
          subject: string
          messages: Json
          status: string
          priority: string
          source: string
          customer_email: string | null
          created_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          subject: string
          messages?: Json
          status?: string
          priority?: string
          source?: string
          customer_email?: string | null
          created_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          subject?: string
          messages?: Json
          status?: string
          priority?: string
          source?: string
          customer_email?: string | null
          created_at?: string
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'support_tickets_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      agents: {
        Row: {
          id: string
          name: string
          slug: string
          description: string
          system_prompt: string
          tools: string[]
          mcp_servers: string[]
          data_access: string[]
          icon: string
          model: string
          is_system: boolean
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string
          system_prompt: string
          tools?: string[]
          mcp_servers?: string[]
          data_access?: string[]
          icon?: string
          model?: string
          is_system?: boolean
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string
          system_prompt?: string
          tools?: string[]
          mcp_servers?: string[]
          data_access?: string[]
          icon?: string
          model?: string
          is_system?: boolean
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }

      agent_conversations: {
        Row: {
          id: string
          agent_id: string
          user_id: string | null
          title: string
          messages: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          agent_id: string
          user_id?: string | null
          title?: string
          messages?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          user_id?: string | null
          title?: string
          messages?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'agent_conversations_agent_id_fkey'
            columns: ['agent_id']
            isOneToOne: false
            referencedRelation: 'agents'
            referencedColumns: ['id']
          },
        ]
      }

      mcp_connections: {
        Row: {
          id: string
          name: string
          slug: string
          transport: string
          url: string | null
          auth_type: string
          credentials_encrypted: string | null
          is_system: boolean
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          transport?: string
          url?: string | null
          auth_type?: string
          credentials_encrypted?: string | null
          is_system?: boolean
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          transport?: string
          url?: string | null
          auth_type?: string
          credentials_encrypted?: string | null
          is_system?: boolean
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }

      announcements: {
        Row: {
          id: string
          title: string
          content: string
          type: string
          is_published: boolean
          published_at: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          content?: string
          type?: string
          is_published?: boolean
          published_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          type?: string
          is_published?: boolean
          published_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Relationships: []
      }

      media: {
        Row: {
          id: string
          filename: string
          url: string
          mime_type: string | null
          size_bytes: number | null
          alt_text: string
          context: string
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          filename: string
          url: string
          mime_type?: string | null
          size_bytes?: number | null
          alt_text?: string
          context?: string
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          filename?: string
          url?: string
          mime_type?: string | null
          size_bytes?: number | null
          alt_text?: string
          context?: string
          uploaded_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'media_uploaded_by_fkey'
            columns: ['uploaded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      testimonials: {
        Row: {
          id: string
          name: string
          quote: string
          role: string | null
          company: string | null
          image_url: string | null
          sort_order: number
          is_published: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          quote: string
          role?: string | null
          company?: string | null
          image_url?: string | null
          sort_order?: number
          is_published?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          quote?: string
          role?: string | null
          company?: string | null
          image_url?: string | null
          sort_order?: number
          is_published?: boolean
          created_at?: string
        }
        Relationships: []
      }

      inbound_emails: {
        Row: {
          id: string
          resend_email_id: string | null
          from_address: string
          from_name: string | null
          to_address: string
          subject: string | null
          body_snippet: string | null
          support_ticket_id: string | null
          agent_response_status: string
          created_at: string
          processed_at: string | null
        }
        Insert: {
          id?: string
          resend_email_id?: string | null
          from_address: string
          from_name?: string | null
          to_address: string
          subject?: string | null
          body_snippet?: string | null
          support_ticket_id?: string | null
          agent_response_status?: string
          created_at?: string
          processed_at?: string | null
        }
        Update: {
          id?: string
          resend_email_id?: string | null
          from_address?: string
          from_name?: string | null
          to_address?: string
          subject?: string | null
          body_snippet?: string | null
          support_ticket_id?: string | null
          agent_response_status?: string
          created_at?: string
          processed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'inbound_emails_support_ticket_id_fkey'
            columns: ['support_ticket_id']
            isOneToOne: false
            referencedRelation: 'support_tickets'
            referencedColumns: ['id']
          },
        ]
      }
      testimonial_requests: {
        Row: {
          id: string
          user_id: string
          trigger_type: string
          status: string
          sent_at: string | null
          responded_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          trigger_type: string
          status?: string
          sent_at?: string | null
          responded_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          trigger_type?: string
          status?: string
          sent_at?: string | null
          responded_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'testimonial_requests_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      agent_memories: {
        Row: {
          id: string
          agent_id: string
          scope: string
          customer_id: string | null
          content: string
          embedding: unknown | null
          category: string
          importance: number
          source_conversation_id: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          agent_id: string
          scope: string
          customer_id?: string | null
          content: string
          embedding?: unknown | null
          category?: string
          importance?: number
          source_conversation_id?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          scope?: string
          customer_id?: string | null
          content?: string
          embedding?: unknown | null
          category?: string
          importance?: number
          source_conversation_id?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'agent_memories_agent_id_fkey'
            columns: ['agent_id']
            isOneToOne: false
            referencedRelation: 'agents'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'agent_memories_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'agent_memories_source_conversation_id_fkey'
            columns: ['source_conversation_id']
            isOneToOne: false
            referencedRelation: 'agent_conversations'
            referencedColumns: ['id']
          },
        ]
      }
      agent_handoffs: {
        Row: {
          id: string
          source_agent_id: string
          target_agent_id: string
          customer_id: string | null
          summary: string
          memory_ids: Json
          status: string
          metadata: Json
          created_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          source_agent_id: string
          target_agent_id: string
          customer_id?: string | null
          summary: string
          memory_ids?: Json
          status?: string
          metadata?: Json
          created_at?: string
          expires_at?: string | null
        }
        Update: {
          id?: string
          source_agent_id?: string
          target_agent_id?: string
          customer_id?: string | null
          summary?: string
          memory_ids?: Json
          status?: string
          metadata?: Json
          created_at?: string
          expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'agent_handoffs_source_agent_id_fkey'
            columns: ['source_agent_id']
            isOneToOne: false
            referencedRelation: 'agents'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'agent_handoffs_target_agent_id_fkey'
            columns: ['target_agent_id']
            isOneToOne: false
            referencedRelation: 'agents'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'agent_handoffs_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      funnels: {
        Row: {
          id: string
          name: string
          description: string | null
          status: string
          goal_type: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          status?: string
          goal_type: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          status?: string
          goal_type?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      funnel_steps: {
        Row: {
          id: string
          funnel_id: string
          page_id: string
          step_order: number
          step_type: string
          expected_action: string
          product_id: string | null
          email_sequence_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          funnel_id: string
          page_id: string
          step_order: number
          step_type: string
          expected_action: string
          product_id?: string | null
          email_sequence_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          funnel_id?: string
          page_id?: string
          step_order?: number
          step_type?: string
          expected_action?: string
          product_id?: string | null
          email_sequence_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'funnel_steps_funnel_id_fkey'
            columns: ['funnel_id']
            isOneToOne: false
            referencedRelation: 'funnels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'funnel_steps_page_id_fkey'
            columns: ['page_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
        ]
      }

      funnel_events: {
        Row: {
          id: string
          funnel_id: string
          funnel_step_id: string
          event_type: string
          visitor_hash: string | null
          lead_id: string | null
          user_id: string | null
          stripe_session_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          funnel_id: string
          funnel_step_id: string
          event_type: string
          visitor_hash?: string | null
          lead_id?: string | null
          user_id?: string | null
          stripe_session_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          funnel_id?: string
          funnel_step_id?: string
          event_type?: string
          visitor_hash?: string | null
          lead_id?: string | null
          user_id?: string | null
          stripe_session_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'funnel_events_funnel_id_fkey'
            columns: ['funnel_id']
            isOneToOne: false
            referencedRelation: 'funnels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'funnel_events_funnel_step_id_fkey'
            columns: ['funnel_step_id']
            isOneToOne: false
            referencedRelation: 'funnel_steps'
            referencedColumns: ['id']
          },
        ]
      }

      agent_schedules: {
        Row: {
          id: string
          agent_id: string
          name: string
          prompt: string
          cron_expression: string
          is_active: boolean
          last_run_at: string | null
          next_run_at: string | null
          max_retries: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          agent_id: string
          name: string
          prompt: string
          cron_expression: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          max_retries?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          name?: string
          prompt?: string
          cron_expression?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          max_retries?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'agent_schedules_agent_id_fkey'
            columns: ['agent_id']
            isOneToOne: false
            referencedRelation: 'agents'
            referencedColumns: ['id']
          },
        ]
      }

      agent_triggers: {
        Row: {
          id: string
          agent_id: string
          name: string
          table_name: string
          event_type: string
          filter_conditions: Json | null
          prompt_template: string
          is_active: boolean
          cooldown_seconds: number
          last_triggered_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          agent_id: string
          name: string
          table_name: string
          event_type?: string
          filter_conditions?: Json | null
          prompt_template: string
          is_active?: boolean
          cooldown_seconds?: number
          last_triggered_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          name?: string
          table_name?: string
          event_type?: string
          filter_conditions?: Json | null
          prompt_template?: string
          is_active?: boolean
          cooldown_seconds?: number
          last_triggered_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'agent_triggers_agent_id_fkey'
            columns: ['agent_id']
            isOneToOne: false
            referencedRelation: 'agents'
            referencedColumns: ['id']
          },
        ]
      }

      agent_runs: {
        Row: {
          id: string
          agent_id: string
          trigger_type: string
          trigger_id: string | null
          status: string
          prompt: string | null
          response: string | null
          tool_calls: Json | null
          tokens_used: number | null
          duration_ms: number | null
          error_message: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          agent_id: string
          trigger_type: string
          trigger_id?: string | null
          status?: string
          prompt?: string | null
          response?: string | null
          tool_calls?: Json | null
          tokens_used?: number | null
          duration_ms?: number | null
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          trigger_type?: string
          trigger_id?: string | null
          status?: string
          prompt?: string | null
          response?: string | null
          tool_calls?: Json | null
          tokens_used?: number | null
          duration_ms?: number | null
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'agent_runs_agent_id_fkey'
            columns: ['agent_id']
            isOneToOne: false
            referencedRelation: 'agents'
            referencedColumns: ['id']
          },
        ]
      }

      agent_status: {
        Row: {
          agent_id: string
          status: string
          current_task: string | null
          last_active_at: string | null
          runs_today: number
          errors_today: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          status?: string
          current_task?: string | null
          last_active_at?: string | null
          runs_today?: number
          errors_today?: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          status?: string
          current_task?: string | null
          last_active_at?: string | null
          runs_today?: number
          errors_today?: number
          updated_at?: string
        }
        Relationships: []
      }

      goals: {
        Row: {
          id: string
          title: string
          description: string | null
          target_metrics: Json | null
          current_metrics: Json | null
          strategy: string | null
          status: string
          target_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          target_metrics?: Json | null
          current_metrics?: Json | null
          strategy?: string | null
          status?: string
          target_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          target_metrics?: Json | null
          current_metrics?: Json | null
          strategy?: string | null
          status?: string
          target_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      goal_tasks: {
        Row: {
          id: string
          goal_id: string
          agent_id: string | null
          title: string
          description: string | null
          status: string
          result: string | null
          priority: number
          order_index: number
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          goal_id: string
          agent_id?: string | null
          title: string
          description?: string | null
          status?: string
          result?: string | null
          priority?: number
          order_index?: number
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          goal_id?: string
          agent_id?: string | null
          title?: string
          description?: string | null
          status?: string
          result?: string | null
          priority?: number
          order_index?: number
          created_at?: string
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'goal_tasks_goal_id_fkey'
            columns: ['goal_id']
            isOneToOne: false
            referencedRelation: 'goals'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'goal_tasks_agent_id_fkey'
            columns: ['agent_id']
            isOneToOne: false
            referencedRelation: 'agents'
            referencedColumns: ['id']
          },
        ]
      }

      page_templates: {
        Row: {
          id: string
          name: string
          category: string
          description: string
          html_content: string
          design_notes: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          category: string
          description?: string
          html_content: string
          design_notes?: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string
          description?: string
          html_content?: string
          design_notes?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      merge_onboarding_checklist: {
        Args: {
          updates: Json
        }
        Returns: undefined
      }
      match_memories: {
        Args: {
          query_embedding: string
          match_threshold?: number
          match_count?: number
          filter_agent_id?: string | null
          filter_scope?: string | null
          filter_customer_id?: string | null
          filter_conversation_id?: string | null
        }
        Returns: {
          id: string
          agent_id: string
          scope: string
          customer_id: string | null
          content: string
          category: string
          importance: number
          source_conversation_id: string | null
          metadata: Json
          similarity: number
        }[]
      }
      describe_schema: {
        Args: {
          p_table_name?: string | null
        }
        Returns: Json
      }
      execute_readonly_query: {
        Args: {
          p_query: string
          p_max_rows?: number
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
