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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      care_plan_completions: {
        Row: {
          care_plan_item_id: string
          completed: boolean
          created_at: string
          id: string
          notes: string | null
          updated_at: string
          visit_log_id: string
        }
        Insert: {
          care_plan_item_id: string
          completed?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          visit_log_id: string
        }
        Update: {
          care_plan_item_id?: string
          completed?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          visit_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_plan_completions_care_plan_item_id_fkey"
            columns: ["care_plan_item_id"]
            isOneToOne: false
            referencedRelation: "care_plan_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plan_completions_visit_log_id_fkey"
            columns: ["visit_log_id"]
            isOneToOne: false
            referencedRelation: "visit_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      care_plan_items: {
        Row: {
          active: boolean
          care_recipient_id: string
          category: string | null
          created_at: string
          created_by_admin_id: string | null
          frequency: string
          id: string
          task_description: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          care_recipient_id: string
          category?: string | null
          created_at?: string
          created_by_admin_id?: string | null
          frequency?: string
          id?: string
          task_description: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          care_recipient_id?: string
          category?: string | null
          created_at?: string
          created_by_admin_id?: string | null
          frequency?: string
          id?: string
          task_description?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_plan_items_care_recipient_id_fkey"
            columns: ["care_recipient_id"]
            isOneToOne: false
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plan_items_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      care_recipients: {
        Row: {
          address_line: string | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          family_id: string
          full_name: string
          id: string
          municipality: string | null
          notes: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address_line?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          family_id: string
          full_name: string
          id?: string
          municipality?: string | null
          notes?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address_line?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          family_id?: string
          full_name?: string
          id?: string
          municipality?: string | null
          notes?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_recipients_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      care_shifts: {
        Row: {
          care_recipient_id: string
          caregiver_id: string | null
          client_id: string | null
          created_at: string
          created_by_admin_id: string | null
          id: string
          notes: string | null
          scheduled_date: string
          scheduled_end_time: string
          scheduled_start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          care_recipient_id: string
          caregiver_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by_admin_id?: string | null
          id?: string
          notes?: string | null
          scheduled_date: string
          scheduled_end_time: string
          scheduled_start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          care_recipient_id?: string
          caregiver_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by_admin_id?: string | null
          id?: string
          notes?: string | null
          scheduled_date?: string
          scheduled_end_time?: string
          scheduled_start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_shifts_care_recipient_id_fkey"
            columns: ["care_recipient_id"]
            isOneToOne: false
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_shifts_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_shifts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_shifts_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      caregivers: {
        Row: {
          active: boolean
          background_check_date: string | null
          background_check_status: string
          bio: string | null
          created_at: string
          id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          background_check_date?: string | null
          background_check_status?: string
          bio?: string | null
          created_at?: string
          id?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          background_check_date?: string | null
          background_check_status?: string
          bio?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "caregivers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_family_members: {
        Row: {
          client_id: string
          created_at: string
          id: string
          relationship: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          relationship?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          relationship?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_family_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          created_at: string
          date_of_birth: string | null
          full_name: string
          id: string
          notes: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          id?: string
          notes?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      families: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          start_date: string
          status: string
          subscription_tier_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          start_date?: string
          status?: string
          subscription_tier_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          start_date?: string
          status?: string
          subscription_tier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "families_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "families_subscription_tier_id_fkey"
            columns: ["subscription_tier_id"]
            isOneToOne: false
            referencedRelation: "subscription_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      family_messages: {
        Row: {
          content: string
          created_at: string
          family_id: string
          id: string
          read_at: string | null
          sender_profile_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          family_id: string
          id?: string
          read_at?: string | null
          sender_profile_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          family_id?: string
          id?: string
          read_at?: string | null
          sender_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_messages_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          client_id: string | null
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          client_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          client_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          preferred_language: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_tiers: {
        Row: {
          created_at: string
          hours_per_week: number
          id: string
          monthly_price: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hours_per_week: number
          id?: string
          monthly_price: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hours_per_week?: number
          id?: string
          monthly_price?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visit_logs: {
        Row: {
          care_recipient_id: string | null
          caregiver_id: string
          client_id: string | null
          clock_in: string
          clock_out: string | null
          created_at: string
          id: string
          mood: string | null
          notes: string | null
          shift_id: string | null
        }
        Insert: {
          care_recipient_id?: string | null
          caregiver_id: string
          client_id?: string | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          mood?: string | null
          notes?: string | null
          shift_id?: string | null
        }
        Update: {
          care_recipient_id?: string | null
          caregiver_id?: string
          client_id?: string | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          mood?: string | null
          notes?: string | null
          shift_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_logs_care_recipient_id_fkey"
            columns: ["care_recipient_id"]
            isOneToOne: false
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_logs_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "care_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      wellbeing_entries: {
        Row: {
          created_at: string
          food_appetite: Database["public"]["Enums"]["appetite_level"] | null
          food_meals_offered: string | null
          food_notes: string | null
          hygiene_bathing_completed: boolean | null
          hygiene_grooming_completed: boolean | null
          hygiene_notes: string | null
          id: string
          medicine_notes: string | null
          medicine_taken: Database["public"]["Enums"]["medicine_taken"] | null
          mood_notes: string | null
          mood_scale: number | null
          mood_tags: string[]
          movement_assisted: boolean | null
          movement_notes: string | null
          updated_at: string
          visit_log_id: string
        }
        Insert: {
          created_at?: string
          food_appetite?: Database["public"]["Enums"]["appetite_level"] | null
          food_meals_offered?: string | null
          food_notes?: string | null
          hygiene_bathing_completed?: boolean | null
          hygiene_grooming_completed?: boolean | null
          hygiene_notes?: string | null
          id?: string
          medicine_notes?: string | null
          medicine_taken?: Database["public"]["Enums"]["medicine_taken"] | null
          mood_notes?: string | null
          mood_scale?: number | null
          mood_tags?: string[]
          movement_assisted?: boolean | null
          movement_notes?: string | null
          updated_at?: string
          visit_log_id: string
        }
        Update: {
          created_at?: string
          food_appetite?: Database["public"]["Enums"]["appetite_level"] | null
          food_meals_offered?: string | null
          food_notes?: string | null
          hygiene_bathing_completed?: boolean | null
          hygiene_grooming_completed?: boolean | null
          hygiene_notes?: string | null
          id?: string
          medicine_notes?: string | null
          medicine_taken?: Database["public"]["Enums"]["medicine_taken"] | null
          mood_notes?: string | null
          mood_scale?: number | null
          mood_tags?: string[]
          movement_assisted?: boolean | null
          movement_notes?: string | null
          updated_at?: string
          visit_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellbeing_entries_visit_log_id_fkey"
            columns: ["visit_log_id"]
            isOneToOne: true
            referencedRelation: "visit_logs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      profiles_share_care_circle: {
        Args: { _target: string; _viewer: string }
        Returns: boolean
      }
      user_can_access_family: {
        Args: { _family_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_view_client: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_view_recipient: {
        Args: { _recipient_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "caregiver" | "family_member"
      appetite_level: "good" | "fair" | "poor"
      medicine_taken: "yes" | "no" | "partial"
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
      app_role: ["admin", "caregiver", "family_member"],
      appetite_level: ["good", "fair", "poor"],
      medicine_taken: ["yes", "no", "partial"],
    },
  },
} as const
