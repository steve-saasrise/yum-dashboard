export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      api_usage_tracking: {
        Row: {
          endpoint: string
          id: string
          ip_address: unknown | null
          last_request: string | null
          rate_limited: boolean | null
          request_count: number | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
          user_id: string | null
          window_start: string | null
        }
        Insert: {
          endpoint: string
          id?: string
          ip_address?: unknown | null
          last_request?: string | null
          rate_limited?: boolean | null
          request_count?: number | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
          user_id?: string | null
          window_start?: string | null
        }
        Update: {
          endpoint?: string
          id?: string
          ip_address?: unknown | null
          last_request?: string | null
          rate_limited?: boolean | null
          request_count?: number | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
          user_id?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_tracking_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      brightdata_snapshots: {
        Row: {
          created_at: string | null
          creator_urls: Json | null
          creators_processed: number | null
          dataset_id: string
          error: string | null
          error_code: string | null
          id: string
          last_checked_at: string | null
          metadata: Json | null
          posts_retrieved: number | null
          processed_at: string | null
          snapshot_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          creator_urls?: Json | null
          creators_processed?: number | null
          dataset_id: string
          error?: string | null
          error_code?: string | null
          id?: string
          last_checked_at?: string | null
          metadata?: Json | null
          posts_retrieved?: number | null
          processed_at?: string | null
          snapshot_id: string
          status?: string
        }
        Update: {
          created_at?: string | null
          creator_urls?: Json | null
          creators_processed?: number | null
          dataset_id?: string
          error?: string | null
          error_code?: string | null
          id?: string
          last_checked_at?: string | null
          metadata?: Json | null
          posts_retrieved?: number | null
          processed_at?: string | null
          snapshot_id?: string
          status?: string
        }
        Relationships: []
      }
      content: {
        Row: {
          ai_summary: string | null
          ai_summary_long: string | null
          ai_summary_short: string | null
          content_body: string | null
          content_hash: string | null
          created_at: string | null
          creator_id: string
          description: string | null
          duplicate_group_id: string | null
          engagement_metrics: Json | null
          error_message: string | null
          id: string
          is_primary: boolean | null
          media_urls: Json | null
          platform: Database["public"]["Enums"]["platform_type"]
          platform_content_id: string
          processing_status:
            | Database["public"]["Enums"]["content_processing_status"]
            | null
          published_at: string | null
          reading_time_minutes: number | null
          reference_type: string | null
          referenced_content: Json | null
          referenced_content_id: string | null
          relevancy_checked_at: string | null
          relevancy_reason: string | null
          relevancy_score: number | null
          summary_error_message: string | null
          summary_generated_at: string | null
          summary_model: string | null
          summary_status: Database["public"]["Enums"]["summary_status"] | null
          summary_word_count_long: number | null
          summary_word_count_short: number | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string | null
          url: string
          word_count: number | null
        }
        Insert: {
          ai_summary?: string | null
          ai_summary_long?: string | null
          ai_summary_short?: string | null
          content_body?: string | null
          content_hash?: string | null
          created_at?: string | null
          creator_id: string
          description?: string | null
          duplicate_group_id?: string | null
          engagement_metrics?: Json | null
          error_message?: string | null
          id?: string
          is_primary?: boolean | null
          media_urls?: Json | null
          platform: Database["public"]["Enums"]["platform_type"]
          platform_content_id: string
          processing_status?:
            | Database["public"]["Enums"]["content_processing_status"]
            | null
          published_at?: string | null
          reading_time_minutes?: number | null
          reference_type?: string | null
          referenced_content?: Json | null
          referenced_content_id?: string | null
          relevancy_checked_at?: string | null
          relevancy_reason?: string | null
          relevancy_score?: number | null
          summary_error_message?: string | null
          summary_generated_at?: string | null
          summary_model?: string | null
          summary_status?: Database["public"]["Enums"]["summary_status"] | null
          summary_word_count_long?: number | null
          summary_word_count_short?: number | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string | null
          url: string
          word_count?: number | null
        }
        Update: {
          ai_summary?: string | null
          ai_summary_long?: string | null
          ai_summary_short?: string | null
          content_body?: string | null
          content_hash?: string | null
          created_at?: string | null
          creator_id?: string
          description?: string | null
          duplicate_group_id?: string | null
          engagement_metrics?: Json | null
          error_message?: string | null
          id?: string
          is_primary?: boolean | null
          media_urls?: Json | null
          platform?: Database["public"]["Enums"]["platform_type"]
          platform_content_id?: string
          processing_status?:
            | Database["public"]["Enums"]["content_processing_status"]
            | null
          published_at?: string | null
          reading_time_minutes?: number | null
          reference_type?: string | null
          referenced_content?: Json | null
          referenced_content_id?: string | null
          relevancy_checked_at?: string | null
          relevancy_reason?: string | null
          relevancy_score?: number | null
          summary_error_message?: string | null
          summary_generated_at?: string | null
          summary_model?: string | null
          summary_status?: Database["public"]["Enums"]["summary_status"] | null
          summary_word_count_long?: number | null
          summary_word_count_short?: number | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string | null
          url?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_referenced_content_id_fkey"
            columns: ["referenced_content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      content_processing_queue: {
        Row: {
          attempts: number | null
          completed_at: string | null
          content_id: string
          created_at: string | null
          error_message: string | null
          id: string
          payload: Json | null
          priority: number | null
          result: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["processing_queue_status"] | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          content_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          priority?: number | null
          result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["processing_queue_status"] | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          content_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          priority?: number | null
          result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["processing_queue_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_processing_queue_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_lounges: {
        Row: {
          created_at: string | null
          creator_id: string
          lounge_id: string
          relevance_score: number | null
        }
        Insert: {
          created_at?: string | null
          creator_id: string
          lounge_id: string
          relevance_score?: number | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string
          lounge_id?: string
          relevance_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_topics_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_topics_topic_id_fkey"
            columns: ["lounge_id"]
            isOneToOne: false
            referencedRelation: "lounges"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_lounges_backup: {
        Row: {
          created_at: string | null
          creator_id: string | null
          lounge_id: string | null
          relevance_score: number | null
        }
        Insert: {
          created_at?: string | null
          creator_id?: string | null
          lounge_id?: string | null
          relevance_score?: number | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string | null
          lounge_id?: string | null
          relevance_score?: number | null
        }
        Relationships: []
      }
      creator_urls: {
        Row: {
          created_at: string | null
          creator_id: string
          id: string
          last_validated: string | null
          metadata: Json | null
          normalized_url: string
          platform: Database["public"]["Enums"]["platform_type"]
          updated_at: string | null
          url: string
          validation_status:
            | Database["public"]["Enums"]["url_validation_status"]
            | null
        }
        Insert: {
          created_at?: string | null
          creator_id: string
          id?: string
          last_validated?: string | null
          metadata?: Json | null
          normalized_url: string
          platform: Database["public"]["Enums"]["platform_type"]
          updated_at?: string | null
          url: string
          validation_status?:
            | Database["public"]["Enums"]["url_validation_status"]
            | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string
          id?: string
          last_validated?: string | null
          metadata?: Json | null
          normalized_url?: string
          platform?: Database["public"]["Enums"]["platform_type"]
          updated_at?: string | null
          url?: string
          validation_status?:
            | Database["public"]["Enums"]["url_validation_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_urls_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          avatar_url: string | null
          bio: string | null
          content_count: number | null
          created_at: string | null
          display_name: string
          follower_count: number | null
          id: string
          last_content_date: string | null
          metadata: Json | null
          status: Database["public"]["Enums"]["creator_status"] | null
          updated_at: string | null
          user_id: string | null
          verified: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          content_count?: number | null
          created_at?: string | null
          display_name: string
          follower_count?: number | null
          id?: string
          last_content_date?: string | null
          metadata?: Json | null
          status?: Database["public"]["Enums"]["creator_status"] | null
          updated_at?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          content_count?: number | null
          created_at?: string | null
          display_name?: string
          follower_count?: number | null
          id?: string
          last_content_date?: string | null
          metadata?: Json | null
          status?: Database["public"]["Enums"]["creator_status"] | null
          updated_at?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      creators_backup_with_lounge: {
        Row: {
          avatar_url: string | null
          bio: string | null
          content_count: number | null
          created_at: string | null
          display_name: string | null
          follower_count: number | null
          id: string | null
          last_content_date: string | null
          lounge_id: string | null
          metadata: Json | null
          status: Database["public"]["Enums"]["creator_status"] | null
          updated_at: string | null
          user_id: string | null
          verified: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          content_count?: number | null
          created_at?: string | null
          display_name?: string | null
          follower_count?: number | null
          id?: string | null
          last_content_date?: string | null
          lounge_id?: string | null
          metadata?: Json | null
          status?: Database["public"]["Enums"]["creator_status"] | null
          updated_at?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          content_count?: number | null
          created_at?: string | null
          display_name?: string | null
          follower_count?: number | null
          id?: string | null
          last_content_date?: string | null
          lounge_id?: string | null
          metadata?: Json | null
          status?: Database["public"]["Enums"]["creator_status"] | null
          updated_at?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      csrf_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          ip_address: unknown | null
          session_id: string | null
          token: string
          used_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: unknown | null
          session_id?: string | null
          token: string
          used_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: unknown | null
          session_id?: string | null
          token?: string
          used_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "csrf_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      curator_invites: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "curator_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "curators"
            referencedColumns: ["id"]
          },
        ]
      }
      curator_password_resets: {
        Row: {
          created_at: string | null
          curator_id: string
          expires_at: string
          id: string
          token: string
          used: boolean | null
        }
        Insert: {
          created_at?: string | null
          curator_id: string
          expires_at: string
          id?: string
          token: string
          used?: boolean | null
        }
        Update: {
          created_at?: string | null
          curator_id?: string
          expires_at?: string
          id?: string
          token?: string
          used?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "curator_password_resets_curator_id_fkey"
            columns: ["curator_id"]
            isOneToOne: false
            referencedRelation: "curators"
            referencedColumns: ["id"]
          },
        ]
      }
      curator_user_mapping: {
        Row: {
          curator_id: string
          migrated_at: string | null
          user_id: string
        }
        Insert: {
          curator_id: string
          migrated_at?: string | null
          user_id: string
        }
        Update: {
          curator_id?: string
          migrated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      curators: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_admin: boolean | null
          password_hash: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_admin?: boolean | null
          password_hash: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_admin?: boolean | null
          password_hash?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      deleted_content: {
        Row: {
          creator_id: string
          deleted_at: string
          deleted_by: string | null
          deletion_reason: string | null
          id: string
          platform: string
          platform_content_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          creator_id: string
          deleted_at?: string
          deleted_by?: string | null
          deletion_reason?: string | null
          id?: string
          platform: string
          platform_content_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          creator_id?: string
          deleted_at?: string
          deleted_by?: string | null
          deletion_reason?: string | null
          id?: string
          platform?: string
          platform_content_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deleted_content_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deleted_content_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      device_sessions: {
        Row: {
          browser: string | null
          browser_version: string | null
          created_at: string | null
          device_fingerprint: string | null
          device_name: string | null
          device_type: string | null
          first_seen: string | null
          id: string
          ip_address: unknown | null
          is_current: boolean | null
          is_trusted: boolean | null
          last_active: string | null
          location: Json | null
          os: string | null
          os_version: string | null
          session_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          browser_version?: string | null
          created_at?: string | null
          device_fingerprint?: string | null
          device_name?: string | null
          device_type?: string | null
          first_seen?: string | null
          id?: string
          ip_address?: unknown | null
          is_current?: boolean | null
          is_trusted?: boolean | null
          last_active?: string | null
          location?: Json | null
          os?: string | null
          os_version?: string | null
          session_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          browser_version?: string | null
          created_at?: string | null
          device_fingerprint?: string | null
          device_name?: string | null
          device_type?: string | null
          first_seen?: string | null
          id?: string
          ip_address?: unknown | null
          is_current?: boolean | null
          is_trusted?: boolean | null
          last_active?: string | null
          location?: Json | null
          os?: string | null
          os_version?: string | null
          session_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_digests: {
        Row: {
          active: boolean | null
          created_at: string | null
          day_of_week: number | null
          delivery_count: number | null
          frequency: Database["public"]["Enums"]["email_digest_frequency"]
          id: string
          last_sent: string | null
          lounges_included: Json | null
          template_version: number | null
          time_of_day: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          day_of_week?: number | null
          delivery_count?: number | null
          frequency: Database["public"]["Enums"]["email_digest_frequency"]
          id?: string
          last_sent?: string | null
          lounges_included?: Json | null
          template_version?: number | null
          time_of_day?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          day_of_week?: number | null
          delivery_count?: number | null
          frequency?: Database["public"]["Enums"]["email_digest_frequency"]
          id?: string
          last_sent?: string | null
          lounges_included?: Json | null
          template_version?: number | null
          time_of_day?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_digests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lounge_digest_subscriptions: {
        Row: {
          created_at: string | null
          id: string
          lounge_id: string
          subscribed: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lounge_id: string
          subscribed?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lounge_id?: string
          subscribed?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lounge_digest_subscriptions_lounge_id_fkey"
            columns: ["lounge_id"]
            isOneToOne: false
            referencedRelation: "lounges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lounge_digest_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lounge_feed_subscriptions: {
        Row: {
          created_at: string | null
          id: string
          lounge_id: string
          subscribed: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lounge_id: string
          subscribed?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lounge_id?: string
          subscribed?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lounge_feed_subscriptions_lounge_id_fkey"
            columns: ["lounge_id"]
            isOneToOne: false
            referencedRelation: "lounges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lounge_feed_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lounges: {
        Row: {
          content_count: number | null
          created_at: string | null
          creator_count: number | null
          description: string | null
          id: string
          is_system_lounge: boolean | null
          name: string
          parent_lounge_id: string | null
          relevancy_threshold: number | null
          subdomain: string | null
          theme_description: string | null
          updated_at: string | null
          usage_count: number | null
          user_id: string | null
        }
        Insert: {
          content_count?: number | null
          created_at?: string | null
          creator_count?: number | null
          description?: string | null
          id?: string
          is_system_lounge?: boolean | null
          name: string
          parent_lounge_id?: string | null
          relevancy_threshold?: number | null
          subdomain?: string | null
          theme_description?: string | null
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string | null
        }
        Update: {
          content_count?: number | null
          created_at?: string | null
          creator_count?: number | null
          description?: string | null
          id?: string
          is_system_lounge?: boolean | null
          name?: string
          parent_lounge_id?: string | null
          relevancy_threshold?: number | null
          subdomain?: string | null
          theme_description?: string | null
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_parent_topic_id_fkey"
            columns: ["parent_lounge_id"]
            isOneToOne: false
            referencedRelation: "lounges"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_adjustments: {
        Row: {
          active: boolean | null
          adjustment_text: string
          adjustment_type: string | null
          approved: boolean | null
          approved_at: string | null
          approved_by: string | null
          corrections_addressed: number | null
          created_at: string | null
          effectiveness_score: number | null
          id: string
          lounge_id: string | null
          reason: string | null
          suggested_at: string | null
        }
        Insert: {
          active?: boolean | null
          adjustment_text: string
          adjustment_type?: string | null
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          corrections_addressed?: number | null
          created_at?: string | null
          effectiveness_score?: number | null
          id?: string
          lounge_id?: string | null
          reason?: string | null
          suggested_at?: string | null
        }
        Update: {
          active?: boolean | null
          adjustment_text?: string
          adjustment_type?: string | null
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          corrections_addressed?: number | null
          created_at?: string | null
          effectiveness_score?: number | null
          id?: string
          lounge_id?: string | null
          reason?: string | null
          suggested_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_adjustments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_adjustments_lounge_id_fkey"
            columns: ["lounge_id"]
            isOneToOne: false
            referencedRelation: "lounges"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_config: {
        Row: {
          created_at: string | null
          enabled: boolean
          endpoint: string
          id: string
          requests_per_day: number
          requests_per_hour: number
          requests_per_minute: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean
          endpoint: string
          id?: string
          requests_per_day?: number
          requests_per_hour?: number
          requests_per_minute?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean
          endpoint?: string
          id?: string
          requests_per_day?: number
          requests_per_hour?: number
          requests_per_minute?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      relevancy_analysis_runs: {
        Row: {
          analysis_summary: Json | null
          completed_at: string | null
          corrections_analyzed: number | null
          created_at: string | null
          id: string
          run_date: string | null
          suggestions_generated: number | null
        }
        Insert: {
          analysis_summary?: Json | null
          completed_at?: string | null
          corrections_analyzed?: number | null
          created_at?: string | null
          id?: string
          run_date?: string | null
          suggestions_generated?: number | null
        }
        Update: {
          analysis_summary?: Json | null
          completed_at?: string | null
          corrections_analyzed?: number | null
          created_at?: string | null
          id?: string
          run_date?: string | null
          suggestions_generated?: number | null
        }
        Relationships: []
      }
      relevancy_corrections: {
        Row: {
          content_id: string | null
          content_snapshot: Json | null
          created_at: string | null
          id: string
          lounge_id: string | null
          original_reason: string | null
          original_score: number | null
          processed: boolean | null
          restored_at: string | null
          restored_by: string | null
        }
        Insert: {
          content_id?: string | null
          content_snapshot?: Json | null
          created_at?: string | null
          id?: string
          lounge_id?: string | null
          original_reason?: string | null
          original_score?: number | null
          processed?: boolean | null
          restored_at?: string | null
          restored_by?: string | null
        }
        Update: {
          content_id?: string | null
          content_snapshot?: Json | null
          created_at?: string | null
          id?: string
          lounge_id?: string | null
          original_reason?: string | null
          original_score?: number | null
          processed?: boolean | null
          restored_at?: string | null
          restored_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relevancy_corrections_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relevancy_corrections_lounge_id_fkey"
            columns: ["lounge_id"]
            isOneToOne: false
            referencedRelation: "lounges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relevancy_corrections_restored_by_fkey"
            columns: ["restored_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_content: {
        Row: {
          content_id: string
          id: string
          notes: string | null
          read_status: boolean | null
          saved_at: string | null
          tags: Json | null
          user_id: string
        }
        Insert: {
          content_id: string
          id?: string
          notes?: string | null
          read_status?: boolean | null
          saved_at?: string | null
          tags?: Json | null
          user_id: string
        }
        Update: {
          content_id?: string
          id?: string
          notes?: string | null
          read_status?: boolean | null
          saved_at?: string | null
          tags?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_content_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_content_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string | null
          description: string
          event_type: string
          id: string
          ip_address: unknown | null
          location: Json | null
          metadata: Json | null
          session_id: string | null
          severity: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description: string
          event_type: string
          id?: string
          ip_address?: unknown | null
          location?: Json | null
          metadata?: Json | null
          session_id?: string | null
          severity?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string
          event_type?: string
          id?: string
          ip_address?: unknown | null
          location?: Json | null
          metadata?: Json | null
          session_id?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_lounges_backup: {
        Row: {
          created_at: string | null
          lounge_id: string | null
          notification_enabled: boolean | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          lounge_id?: string | null
          notification_enabled?: boolean | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          lounge_id?: string | null
          notification_enabled?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string | null
          device_info: Json | null
          expires_at: string
          id: string
          ip_address: unknown | null
          is_active: boolean | null
          last_activity: string | null
          refresh_token: string | null
          session_token: string
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          expires_at: string
          id?: string
          ip_address?: unknown | null
          is_active?: boolean | null
          last_activity?: string | null
          refresh_token?: string | null
          session_token: string
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          expires_at?: string
          id?: string
          ip_address?: unknown | null
          is_active?: boolean | null
          last_activity?: string | null
          refresh_token?: string | null
          session_token?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          account_locked_until: string | null
          account_status:
            | Database["public"]["Enums"]["user_account_status"]
            | null
          avatar_url: string | null
          created_at: string | null
          data_deletion_requested: boolean | null
          email: string
          failed_login_attempts: number | null
          full_name: string | null
          gdpr_consent: boolean | null
          gdpr_consent_date: string | null
          id: string
          last_login: string | null
          last_password_verified_at: string | null
          last_sensitive_action_at: string | null
          provider: string | null
          provider_id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          security_settings: Json | null
          timezone: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          account_locked_until?: string | null
          account_status?:
            | Database["public"]["Enums"]["user_account_status"]
            | null
          avatar_url?: string | null
          created_at?: string | null
          data_deletion_requested?: boolean | null
          email: string
          failed_login_attempts?: number | null
          full_name?: string | null
          gdpr_consent?: boolean | null
          gdpr_consent_date?: string | null
          id: string
          last_login?: string | null
          last_password_verified_at?: string | null
          last_sensitive_action_at?: string | null
          provider?: string | null
          provider_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          security_settings?: Json | null
          timezone?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          account_locked_until?: string | null
          account_status?:
            | Database["public"]["Enums"]["user_account_status"]
            | null
          avatar_url?: string | null
          created_at?: string | null
          data_deletion_requested?: boolean | null
          email?: string
          failed_login_attempts?: number | null
          full_name?: string | null
          gdpr_consent?: boolean | null
          gdpr_consent_date?: string | null
          id?: string
          last_login?: string | null
          last_password_verified_at?: string | null
          last_sensitive_action_at?: string | null
          provider?: string | null
          provider_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          security_settings?: Json | null
          timezone?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_ip_address?: unknown
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: Json
      }
      cleanup_expired_csrf_tokens: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_old_rate_limit_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      deduplicate_media_urls: {
        Args: { media_urls_array: Json }
        Returns: Json
      }
      generate_csrf_token: {
        Args: {
          p_ip_address?: unknown
          p_session_id?: string
          p_user_agent?: string
          p_user_id?: string
          p_validity_hours?: number
        }
        Returns: Json
      }
      get_content_for_relevancy_check: {
        Args: { p_limit?: number }
        Returns: {
          content_description: string
          content_id: string
          content_title: string
          content_url: string
          creator_name: string
          lounge_id: string
          lounge_name: string
          reference_type: string
          referenced_content: Json
          theme_description: string
        }[]
      }
      get_deleted_content_for_filtering: {
        Args: { creator_ids: string[] }
        Returns: {
          content_id: string
        }[]
      }
      get_relevancy_stats_24h: {
        Args: Record<PropertyKey, never>
        Returns: {
          lounges_involved: number
          total_unchecked: number
          unique_content: number
        }[]
      }
      validate_csrf_token: {
        Args: {
          p_ip_address?: unknown
          p_mark_used?: boolean
          p_session_id?: string
          p_token: string
          p_user_id?: string
        }
        Returns: Json
      }
    }
    Enums: {
      content_processing_status: "pending" | "processed" | "failed"
      creator_status: "active" | "inactive" | "suspended"
      email_digest_frequency: "daily" | "weekly" | "monthly"
      platform_type:
        | "youtube"
        | "twitter"
        | "linkedin"
        | "threads"
        | "rss"
        | "website"
      processing_queue_status: "queued" | "processing" | "completed" | "failed"
      summary_status: "pending" | "processing" | "completed" | "error"
      url_validation_status: "valid" | "invalid" | "pending"
      user_account_status: "active" | "inactive" | "suspended"
      user_role: "viewer" | "curator" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      content_processing_status: ["pending", "processed", "failed"],
      creator_status: ["active", "inactive", "suspended"],
      email_digest_frequency: ["daily", "weekly", "monthly"],
      platform_type: [
        "youtube",
        "twitter",
        "linkedin",
        "threads",
        "rss",
        "website",
      ],
      processing_queue_status: ["queued", "processing", "completed", "failed"],
      summary_status: ["pending", "processing", "completed", "error"],
      url_validation_status: ["valid", "invalid", "pending"],
      user_account_status: ["active", "inactive", "suspended"],
      user_role: ["viewer", "curator", "admin"],
    },
  },
} as const