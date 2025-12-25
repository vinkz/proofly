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
      certificates: {
        Row: {
          appliances: Json | null
          cert_type: string | null
          created_at: string | null
          fields: Json | null
          id: string
          issued_at: string | null
          job_id: string | null
          pdf_path: string | null
          pdf_url: string | null
          status: string | null
          template_version: string | null
          user_id: string | null
        }
        Insert: {
          appliances?: Json | null
          cert_type?: string | null
          created_at?: string | null
          fields?: Json | null
          id?: string
          issued_at?: string | null
          job_id?: string | null
          pdf_path?: string | null
          pdf_url?: string | null
          status?: string | null
          template_version?: string | null
          user_id?: string | null
        }
        Update: {
          appliances?: Json | null
          cert_type?: string | null
          created_at?: string | null
          fields?: Json | null
          id?: string
          issued_at?: string | null
          job_id?: string | null
          pdf_path?: string | null
          pdf_url?: string | null
          status?: string | null
          template_version?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          landlord_address: string | null
          landlord_name: string | null
          name: string
          organization: string | null
          phone: string | null
          postcode: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          landlord_address?: string | null
          landlord_name?: string | null
          name: string
          organization?: string | null
          phone?: string | null
          postcode?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          landlord_address?: string | null
          landlord_name?: string | null
          name?: string
          organization?: string | null
          phone?: string | null
          postcode?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
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
      cp12_appliances: {
        Row: {
          appliance_type: string | null
          classification_code: string | null
          co_reading_ppm: string | null
          created_at: string | null
          flue_condition: string | null
          flue_type: string | null
          gas_tightness_test: string | null
          heat_input: string | null
          id: string
          job_id: string | null
          location: string | null
          make_model: string | null
          operating_pressure: string | null
          safety_rating: string | null
          stability_test: string | null
          user_id: string | null
          ventilation_provision: string | null
          ventilation_satisfactory: string | null
        }
        Insert: {
          appliance_type?: string | null
          classification_code?: string | null
          co_reading_ppm?: string | null
          created_at?: string | null
          flue_condition?: string | null
          flue_type?: string | null
          gas_tightness_test?: string | null
          heat_input?: string | null
          id?: string
          job_id?: string | null
          location?: string | null
          make_model?: string | null
          operating_pressure?: string | null
          safety_rating?: string | null
          stability_test?: string | null
          user_id?: string | null
          ventilation_provision?: string | null
          ventilation_satisfactory?: string | null
        }
        Update: {
          appliance_type?: string | null
          classification_code?: string | null
          co_reading_ppm?: string | null
          created_at?: string | null
          flue_condition?: string | null
          flue_type?: string | null
          gas_tightness_test?: string | null
          heat_input?: string | null
          id?: string
          job_id?: string | null
          location?: string | null
          make_model?: string | null
          operating_pressure?: string | null
          safety_rating?: string | null
          stability_test?: string | null
          user_id?: string | null
          ventilation_provision?: string | null
          ventilation_satisfactory?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cp12_appliances_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
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
      job_fields: {
        Row: {
          created_at: string | null
          field_key: string
          id: string
          job_id: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          field_key: string
          id?: string
          job_id?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          field_key?: string
          id?: string
          job_id?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_fields_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_items: {
        Row: {
          created_at: string | null
          id: string
          job_id: string | null
          label: string
          note: string | null
          photos: string[] | null
          position: number | null
          result: string | null
          template_item_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id?: string | null
          label?: string
          note?: string | null
          photos?: string[] | null
          position?: number | null
          result?: string | null
          template_item_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string | null
          label?: string
          note?: string | null
          photos?: string[] | null
          position?: number | null
          result?: string | null
          template_item_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_items_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      job_photos: {
        Row: {
          category: string
          created_at: string | null
          file_url: string
          id: string
          job_id: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          file_url: string
          id?: string
          job_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          file_url?: string
          id?: string
          job_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_sheets: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          job_id: string
          last_scanned_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          job_id: string
          last_scanned_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          job_id?: string
          last_scanned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_sheets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_records: {
        Row: {
          created_at: string
          job_id: string
          record: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          job_id: string
          record?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          job_id?: string
          record?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_records_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          address: string | null
          certificate_type: string | null
          client_id: string | null
          client_name: string | null
          client_signature_path: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string | null
          engineer_signature_path: string | null
          id: string
          job_type: string | null
          notes: string | null
          scheduled_for: string | null
          status: string | null
          technician_name: string | null
          template_id: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          certificate_type?: string | null
          client_id?: string | null
          client_name?: string | null
          client_signature_path?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          engineer_signature_path?: string | null
          id?: string
          job_type?: string | null
          notes?: string | null
          scheduled_for?: string | null
          status?: string | null
          technician_name?: string | null
          template_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          certificate_type?: string | null
          client_id?: string | null
          client_name?: string | null
          client_signature_path?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          engineer_signature_path?: string | null
          id?: string
          job_type?: string | null
          notes?: string | null
          scheduled_for?: string | null
          status?: string | null
          technician_name?: string | null
          template_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
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
          certifications: string[] | null
          company_name: string | null
          created_at: string | null
          date_of_birth: string | null
          default_engineer_id: string | null
          default_engineer_name: string | null
          full_name: string | null
          gas_safe_number: string | null
          id: string
          logo_url: string | null
          onboarding_complete: boolean | null
          plan_tier: string | null
          profession: string | null
          trade_type: string | null
          trade_types: string[] | null
        }
        Insert: {
          certifications?: string[] | null
          company_name?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          default_engineer_id?: string | null
          default_engineer_name?: string | null
          full_name?: string | null
          gas_safe_number?: string | null
          id: string
          logo_url?: string | null
          onboarding_complete?: boolean | null
          plan_tier?: string | null
          profession?: string | null
          trade_type?: string | null
          trade_types?: string[] | null
        }
        Update: {
          certifications?: string[] | null
          company_name?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          default_engineer_id?: string | null
          default_engineer_name?: string | null
          full_name?: string | null
          gas_safe_number?: string | null
          id?: string
          logo_url?: string | null
          onboarding_complete?: boolean | null
          plan_tier?: string | null
          profession?: string | null
          trade_type?: string | null
          trade_types?: string[] | null
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
      report_deliveries: {
        Row: {
          created_at: string | null
          id: string
          job_id: string | null
          last_error: string | null
          recipient_email: string
          recipient_name: string | null
          report_id: string | null
          sent_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id?: string | null
          last_error?: string | null
          recipient_email?: string
          recipient_name?: string | null
          report_id?: string | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string | null
          last_error?: string | null
          recipient_email?: string
          recipient_name?: string | null
          report_id?: string | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_deliveries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_deliveries_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string | null
          generated_at: string | null
          id: string
          job_id: string
          kind: string | null
          storage_path: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          generated_at?: string | null
          id?: string
          job_id: string
          kind?: string | null
          storage_path: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          generated_at?: string | null
          id?: string
          job_id?: string
          kind?: string | null
          storage_path?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
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
      template_items: {
        Row: {
          created_at: string | null
          help_text: string | null
          id: string
          is_required: boolean | null
          label: string
          position: number | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          help_text?: string | null
          id?: string
          is_required?: boolean | null
          label?: string
          position?: number | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          help_text?: string | null
          id?: string
          is_required?: boolean | null
          label?: string
          position?: number | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_general: boolean
          is_public: boolean | null
          items: Json
          name: string
          trade_type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_general?: boolean
          is_public?: boolean | null
          items: Json
          name: string
          trade_type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_general?: boolean
          is_public?: boolean | null
          items?: Json
          name?: string
          trade_type?: string
          updated_at?: string | null
          user_id?: string | null
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
      job_item_status: "pending" | "pass" | "fail"
      job_type: "general" | "safety_check" | "service" | "breakdown" | "installation"
      job_status:
        | "draft"
        | "active"
        | "awaiting_signatures"
        | "awaiting_report"
        | "completed"
      template_item_type: "toggle" | "text" | "number" | "note"
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
      job_item_status: ["pending", "pass", "fail"],
      job_status: [
        "draft",
        "active",
        "awaiting_signatures",
        "awaiting_report",
        "completed",
      ],
      template_item_type: ["toggle", "text", "number", "note"],
    },
  },
} as const
