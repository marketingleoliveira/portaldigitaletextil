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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      achieved_certificates: {
        Row: {
          achieved_at: string
          achieved_date: string
          created_at: string
          goal_id: string
          goal_title: string
          goal_value: string
          id: string
          period_type: string
          user_id: string
        }
        Insert: {
          achieved_at?: string
          achieved_date?: string
          created_at?: string
          goal_id: string
          goal_title: string
          goal_value: string
          id?: string
          period_type: string
          user_id: string
        }
        Update: {
          achieved_at?: string
          achieved_date?: string
          created_at?: string
          goal_id?: string
          goal_title?: string
          goal_value?: string
          id?: string
          period_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "achieved_certificates_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      creation_categories: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      creation_files: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          is_external_link: boolean | null
          name: string
          subcategory_id: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_external_link?: boolean | null
          name: string
          subcategory_id?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_external_link?: boolean | null
          name?: string
          subcategory_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creation_files_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "creation_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creation_files_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "creation_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      creation_subcategories: {
        Row: {
          category_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creation_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "creation_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      development_updates: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          title: string
          version: string | null
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          title: string
          version?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          title?: string
          version?: string | null
        }
        Relationships: []
      }
      file_region_visibility: {
        Row: {
          file_id: string
          id: string
          region: string
        }
        Insert: {
          file_id: string
          id?: string
          region: string
        }
        Update: {
          file_id?: string
          id?: string
          region?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_region_visibility_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      file_visibility: {
        Row: {
          file_id: string
          id: string
          visible_to_role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          file_id: string
          id?: string
          visible_to_role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          file_id?: string
          id?: string
          visible_to_role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "file_visibility_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          is_external_link: boolean
          name: string
          subcategory_id: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_external_link?: boolean
          name: string
          subcategory_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_external_link?: boolean
          name?: string
          subcategory_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_progress: {
        Row: {
          current_value: number
          goal_id: string
          id: string
          notes: string | null
          period_end: string
          period_start: string
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          current_value?: number
          goal_id: string
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          current_value?: number
          goal_id?: string
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_progress_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          goal_type: string
          id: string
          is_active: boolean | null
          period_type: string
          target_user_id: string | null
          target_value: number
          title: string
          unit: string
          updated_at: string | null
          visible_to_roles: Database["public"]["Enums"]["app_role"][] | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          goal_type?: string
          id?: string
          is_active?: boolean | null
          period_type: string
          target_user_id?: string | null
          target_value: number
          title: string
          unit?: string
          updated_at?: string | null
          visible_to_roles?: Database["public"]["Enums"]["app_role"][] | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          goal_type?: string
          id?: string
          is_active?: boolean | null
          period_type?: string
          target_user_id?: string | null
          target_value?: number
          title?: string
          unit?: string
          updated_at?: string | null
          visible_to_roles?: Database["public"]["Enums"]["app_role"][] | null
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          activity_type: string
          created_at: string
          description: string
          id: string
          lead_id: string
          new_status: Database["public"]["Enums"]["lead_status"] | null
          previous_status: Database["public"]["Enums"]["lead_status"] | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description: string
          id?: string
          lead_id: string
          new_status?: Database["public"]["Enums"]["lead_status"] | null
          previous_status?: Database["public"]["Enums"]["lead_status"] | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string
          id?: string
          lead_id?: string
          new_status?: Database["public"]["Enums"]["lead_status"] | null
          previous_status?: Database["public"]["Enums"]["lead_status"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_reminders: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          lead_id: string
          reminder_date: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          description: string
          id?: string
          lead_id: string
          reminder_date: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          lead_id?: string
          reminder_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_reminders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_reminders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_schedules: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          id: string
          lead_id: string
          meeting_id: string | null
          notes: string | null
          scheduled_date: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          lead_id: string
          meeting_id?: string | null
          notes?: string | null
          scheduled_date: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string
          meeting_id?: string | null
          notes?: string | null
          scheduled_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_schedules_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_schedules_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          company_name: string
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string
          created_by: string
          estimated_value: number | null
          expected_close_date: string | null
          id: string
          last_contact_at: string | null
          notes: string | null
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_name: string
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          created_by: string
          estimated_value?: number | null
          expected_close_date?: string | null
          id?: string
          last_contact_at?: string | null
          notes?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          estimated_value?: number | null
          expected_close_date?: string | null
          id?: string
          last_contact_at?: string | null
          notes?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_lead_contacts: {
        Row: {
          contact_type: string
          created_at: string
          created_by: string
          id: string
          lead_id: string
          message: string | null
          result: string | null
        }
        Insert: {
          contact_type: string
          created_at?: string
          created_by: string
          id?: string
          lead_id: string
          message?: string | null
          result?: string | null
        }
        Update: {
          contact_type?: string
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string
          message?: string | null
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_lead_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "marketing_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_leads: {
        Row: {
          company_name: string
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["marketing_lead_status"]
          updated_at: string
        }
        Insert: {
          company_name: string
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["marketing_lead_status"]
          updated_at?: string
        }
        Update: {
          company_name?: string
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["marketing_lead_status"]
          updated_at?: string
        }
        Relationships: []
      }
      marketing_quick_responses: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          label: string
          response_type: string
          shortcut_key: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          label: string
          response_type?: string
          shortcut_key?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          label?: string
          response_type?: string
          shortcut_key?: string | null
        }
        Relationships: []
      }
      meeting_messages: {
        Row: {
          created_at: string
          guest_id: string | null
          guest_name: string | null
          id: string
          meeting_id: string
          message: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          guest_id?: string | null
          guest_name?: string | null
          id?: string
          meeting_id: string
          message: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          guest_id?: string | null
          guest_name?: string | null
          id?: string
          meeting_id?: string
          message?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_messages_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          guest_id: string | null
          guest_name: string | null
          id: string
          is_co_host: boolean | null
          is_hand_raised: boolean | null
          is_host: boolean | null
          is_muted: boolean | null
          is_screen_sharing: boolean | null
          is_video_on: boolean | null
          joined_at: string | null
          left_at: string | null
          meeting_id: string
          user_id: string | null
        }
        Insert: {
          guest_id?: string | null
          guest_name?: string | null
          id?: string
          is_co_host?: boolean | null
          is_hand_raised?: boolean | null
          is_host?: boolean | null
          is_muted?: boolean | null
          is_screen_sharing?: boolean | null
          is_video_on?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          meeting_id: string
          user_id?: string | null
        }
        Update: {
          guest_id?: string | null
          guest_name?: string | null
          id?: string
          is_co_host?: boolean | null
          is_hand_raised?: boolean | null
          is_host?: boolean | null
          is_muted?: boolean | null
          is_screen_sharing?: boolean | null
          is_video_on?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          meeting_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_recordings: {
        Row: {
          created_at: string
          download_url: string | null
          duration_seconds: number | null
          expires_at: string
          id: string
          meeting_date: string
          meeting_id: string | null
          meeting_title: string
          recording_id: string
        }
        Insert: {
          created_at?: string
          download_url?: string | null
          duration_seconds?: number | null
          expires_at?: string
          id?: string
          meeting_date: string
          meeting_id?: string | null
          meeting_title: string
          recording_id: string
        }
        Update: {
          created_at?: string
          download_url?: string | null
          duration_seconds?: number | null
          expires_at?: string
          id?: string
          meeting_date?: string
          meeting_id?: string | null
          meeting_title?: string
          recording_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_recordings_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          allow_chat: boolean | null
          allow_participants_audio: boolean | null
          allow_participants_video: boolean | null
          allow_screen_share: boolean | null
          created_at: string
          description: string | null
          ended_at: string | null
          host_user_id: string
          id: string
          is_active: boolean | null
          max_participants: number | null
          meeting_code: string
          password: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          started_at: string | null
          title: string
          updated_at: string
          waiting_room_enabled: boolean | null
        }
        Insert: {
          allow_chat?: boolean | null
          allow_participants_audio?: boolean | null
          allow_participants_video?: boolean | null
          allow_screen_share?: boolean | null
          created_at?: string
          description?: string | null
          ended_at?: string | null
          host_user_id: string
          id?: string
          is_active?: boolean | null
          max_participants?: number | null
          meeting_code: string
          password?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          started_at?: string | null
          title: string
          updated_at?: string
          waiting_room_enabled?: boolean | null
        }
        Update: {
          allow_chat?: boolean | null
          allow_participants_audio?: boolean | null
          allow_participants_video?: boolean | null
          allow_screen_share?: boolean | null
          created_at?: string
          description?: string | null
          ended_at?: string | null
          host_user_id?: string
          id?: string
          is_active?: boolean | null
          max_participants?: number | null
          meeting_code?: string
          password?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          started_at?: string | null
          title?: string
          updated_at?: string
          waiting_room_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          id: string
          notification_id: string | null
          read_at: string | null
          user_id: string
          user_notification_id: string | null
        }
        Insert: {
          id?: string
          notification_id?: string | null
          read_at?: string | null
          user_id: string
          user_notification_id?: string | null
        }
        Update: {
          id?: string
          notification_id?: string | null
          read_at?: string | null
          user_id?: string
          user_notification_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_reads_user_notification_id_fkey"
            columns: ["user_notification_id"]
            isOneToOne: false
            referencedRelation: "user_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          image_path: string | null
          image_url: string | null
          message: string
          title: string
          visible_to_roles: Database["public"]["Enums"]["app_role"][]
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          message: string
          title: string
          visible_to_roles?: Database["public"]["Enums"]["app_role"][]
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          message?: string
          title?: string
          visible_to_roles?: Database["public"]["Enums"]["app_role"][]
        }
        Relationships: []
      }
      price_files: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          file_size: number | null
          file_url: string
          id: string
          name: string
          region: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          name: string
          region?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          name?: string
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_visibility: {
        Row: {
          id: string
          product_id: string
          visible_to_role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          id?: string
          product_id: string
          visible_to_role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          id?: string
          product_id?: string
          visible_to_role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "product_visibility_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          catalog_url: string | null
          category_id: string | null
          commercial_conditions: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number | null
          technical_sheet_url: string | null
          updated_at: string | null
        }
        Insert: {
          catalog_url?: string | null
          category_id?: string | null
          commercial_conditions?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price?: number | null
          technical_sheet_url?: string | null
          updated_at?: string | null
        }
        Update: {
          catalog_url?: string | null
          category_id?: string | null
          commercial_conditions?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number | null
          technical_sheet_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          custom_image_url: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          linkedin: string | null
          location_sharing_enabled: boolean | null
          phone: string | null
          region: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          custom_image_url?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean | null
          linkedin?: string | null
          location_sharing_enabled?: boolean | null
          phone?: string | null
          region?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          custom_image_url?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          linkedin?: string | null
          location_sharing_enabled?: boolean | null
          phone?: string | null
          region?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      room_reservations: {
        Row: {
          created_at: string
          description: string | null
          end_time: string
          id: string
          start_time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          start_time: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          start_time?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonial_schedules: {
        Row: {
          company_name: string
          completed_at: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          id: string
          meeting_link: string | null
          notes: string | null
          orientation_file_name: string | null
          orientation_file_url: string | null
          scheduled_date: string
          status: string
          updated_at: string
        }
        Insert: {
          company_name: string
          completed_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by: string
          id?: string
          meeting_link?: string | null
          notes?: string | null
          orientation_file_name?: string | null
          orientation_file_url?: string | null
          scheduled_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_name?: string
          completed_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          id?: string
          meeting_link?: string | null
          notes?: string | null
          orientation_file_name?: string | null
          orientation_file_url?: string | null
          scheduled_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_attachments: {
        Row: {
          created_at: string | null
          created_by: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          message_id: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          message_id?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          message_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ticket_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          created_at: string
          id: string
          is_admin_reply: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin_reply?: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin_reply?: boolean
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      time_records: {
        Row: {
          created_at: string | null
          entry_time: string | null
          exit_time: string | null
          id: string
          lunch_exit_time: string | null
          lunch_return_time: string | null
          record_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entry_time?: string | null
          exit_time?: string | null
          id?: string
          lunch_exit_time?: string | null
          lunch_return_time?: string | null
          record_date?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          entry_time?: string | null
          exit_time?: string | null
          id?: string
          lunch_exit_time?: string | null
          lunch_return_time?: string | null
          record_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_activity_sessions: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          session_end: string | null
          session_start: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          session_end?: string | null
          session_start?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          session_end?: string | null
          session_start?: string
          user_id?: string
        }
        Relationships: []
      }
      user_location_history: {
        Row: {
          city: string | null
          country: string | null
          id: string
          ip_address: string | null
          latitude: number | null
          location_source: string | null
          longitude: number | null
          neighborhood: string | null
          recorded_at: string
          region: string | null
          street: string | null
          user_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          id?: string
          ip_address?: string | null
          latitude?: number | null
          location_source?: string | null
          longitude?: number | null
          neighborhood?: string | null
          recorded_at?: string
          region?: string | null
          street?: string | null
          user_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          id?: string
          ip_address?: string | null
          latitude?: number | null
          location_source?: string | null
          longitude?: number | null
          neighborhood?: string | null
          recorded_at?: string
          region?: string | null
          street?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_locations: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          id: string
          ip_address: string | null
          last_updated: string
          latitude: number | null
          location_source: string | null
          longitude: number | null
          neighborhood: string | null
          region: string | null
          street: string | null
          user_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          last_updated?: string
          latitude?: number | null
          location_source?: string | null
          longitude?: number | null
          neighborhood?: string | null
          region?: string | null
          street?: string | null
          user_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          last_updated?: string
          latitude?: number | null
          location_source?: string | null
          longitude?: number | null
          neighborhood?: string | null
          region?: string | null
          street?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          image_path: string | null
          image_url: string | null
          message: string
          target_user_id: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          message: string
          target_user_id?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          message?: string
          target_user_id?: string | null
          title?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          created_at: string
          id: string
          is_online: boolean
          last_seen: string
          session_started: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_online?: boolean
          last_seen?: string
          session_started?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_online?: boolean
          last_seen?: string
          session_started?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_file: {
        Args: { _file_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_product: {
        Args: { _product_id: string; _user_id: string }
        Returns: boolean
      }
      cleanup_expired_recordings: { Args: never; Returns: undefined }
      generate_meeting_code: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_creation_access: { Args: { _user_id: string }; Returns: boolean }
      has_full_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_meeting_host: {
        Args: { _meeting_id: string; _user_id: string }
        Returns: boolean
      }
      is_meeting_participant: {
        Args: { _meeting_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "gerente"
        | "vendedor"
        | "dev"
        | "criacao"
        | "sdr"
        | "marketing"
      lead_source:
        | "indicacao"
        | "site"
        | "telefone"
        | "email"
        | "rede_social"
        | "evento"
        | "outro"
      lead_status:
        | "novo"
        | "fora_de_perfil"
        | "contatado"
        | "qualificado"
        | "proposta"
        | "negociacao"
        | "ganho"
        | "perdido"
      marketing_lead_status:
        | "lead"
        | "contato_inicial"
        | "resposta"
        | "agendado"
        | "depoimento_realizado"
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
      app_role: [
        "admin",
        "gerente",
        "vendedor",
        "dev",
        "criacao",
        "sdr",
        "marketing",
      ],
      lead_source: [
        "indicacao",
        "site",
        "telefone",
        "email",
        "rede_social",
        "evento",
        "outro",
      ],
      lead_status: [
        "novo",
        "fora_de_perfil",
        "contatado",
        "qualificado",
        "proposta",
        "negociacao",
        "ganho",
        "perdido",
      ],
      marketing_lead_status: [
        "lead",
        "contato_inicial",
        "resposta",
        "agendado",
        "depoimento_realizado",
      ],
    },
  },
} as const
