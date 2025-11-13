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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      contacts: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      job_checklist: {
        Row: {
          created_at: string | null
          id: string
          job_id: string | null
          label: string | null
          note: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id?: string | null
          label?: string | null
          note?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string | null
          label?: string | null
          note?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_checklist_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          address: string | null
          client_name: string | null
          contact_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          status: string | null
          template_id: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          client_name?: string | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          template_id?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          client_name?: string | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          template_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          caption: string | null
          checklist_id: string | null
          created_at: string | null
          geo_lat: number | null
          geo_lng: number | null
          id: string
          job_id: string | null
          shot_at: string | null
          storage_path: string
        }
        Insert: {
          caption?: string | null
          checklist_id?: string | null
          created_at?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          job_id?: string | null
          shot_at?: string | null
          storage_path: string
        }
        Update: {
          caption?: string | null
          checklist_id?: string | null
          created_at?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          job_id?: string | null
          shot_at?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "job_checklist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          trade_type: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          id: string
          logo_url?: string | null
          trade_type?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          trade_type?: string | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          contact_id: string | null
          created_at: string | null
          due_date: string
          id: string
          job_id: string | null
          kind: string | null
          sent_at: string | null
          user_id: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          due_date: string
          id?: string
          job_id?: string | null
          kind?: string | null
          sent_at?: string | null
          user_id?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          due_date?: string
          id?: string
          job_id?: string | null
          kind?: string | null
          sent_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          generated_at: string | null
          job_id: string
          storage_path: string
        }
        Insert: {
          generated_at?: string | null
          job_id: string
          storage_path: string
        }
        Update: {
          generated_at?: string | null
          job_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      signatures: {
        Row: {
          client_sig_path: string | null
          job_id: string
          plumber_sig_path: string | null
          signed_at: string | null
        }
        Insert: {
          client_sig_path?: string | null
          job_id: string
          plumber_sig_path?: string | null
          signed_at?: string | null
        }
        Update: {
          client_sig_path?: string | null
          job_id?: string
          plumber_sig_path?: string | null
          signed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signatures_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_public: boolean | null
          items: Json
          name: string
          trade_type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_public?: boolean | null
          items: Json
          name: string
          trade_type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_public?: boolean | null
          items?: Json
          name?: string
          trade_type?: string
        }
        Relationships: []
      }
      usage_counters: {
        Row: {
          month_key: string
          reports_generated: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          month_key: string
          reports_generated?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          month_key?: string
          reports_generated?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
