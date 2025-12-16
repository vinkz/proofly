export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '15.1.0';
  };
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          organization: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          organization?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string;
          organization?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'clients_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      certificates: {
        Row: {
          id: string;
          job_id: string | null;
          pdf_url: string | null;
          pdf_path: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          job_id?: string | null;
          pdf_url?: string | null;
          pdf_path?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          job_id?: string | null;
          pdf_url?: string | null;
          pdf_path?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'certificates_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          trade_types: string[];
          certifications: string[];
          onboarding_complete: boolean | null;
          created_at: string | null;
          updated_at: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          date_of_birth?: string | null;
          profession?: string | null;
        };
        Insert: {
          id: string;
          trade_types?: string[];
          certifications?: string[];
          onboarding_complete?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          date_of_birth?: string | null;
          profession?: string | null;
        };
        Update: {
          id?: string;
          trade_types?: string[];
          certifications?: string[];
          onboarding_complete?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          date_of_birth?: string | null;
          profession?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      templates: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          trade_type: string;
          description: string | null;
          is_public: boolean;
          is_general: boolean;
          items: Json;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          trade_type: string;
          description?: string | null;
          is_public?: boolean;
          is_general?: boolean;
          items?: Json;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string;
          trade_type?: string;
          description?: string | null;
          is_public?: boolean;
          is_general?: boolean;
          items?: Json;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'templates_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      template_items: {
        Row: {
          id: string;
          template_id: string;
          label: string;
          help_text: string | null;
          is_required: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          label: string;
          help_text?: string | null;
          is_required?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string;
          label?: string;
          help_text?: string | null;
          is_required?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'template_items_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'templates';
            referencedColumns: ['id'];
          },
        ];
      };
      jobs: {
        Row: {
          id: string;
          user_id: string | null;
          client_id: string | null;
          client_name: string;
          address: string | null;
          title: string | null;
          status: Database['public']['Enums']['job_status'];
          template_id: string | null;
          scheduled_for: string | null;
          completed_at: string | null;
          engineer_signature_path: string | null;
          client_signature_path: string | null;
          technician_name: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          client_id?: string | null;
          client_name: string;
          address?: string | null;
          title?: string | null;
          status?: Database['public']['Enums']['job_status'];
          template_id?: string | null;
          scheduled_for?: string | null;
          completed_at?: string | null;
          engineer_signature_path?: string | null;
          client_signature_path?: string | null;
          technician_name?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          client_id?: string | null;
          client_name?: string;
          address?: string | null;
          title?: string | null;
          status?: Database['public']['Enums']['job_status'];
          template_id?: string | null;
          scheduled_for?: string | null;
          completed_at?: string | null;
          engineer_signature_path?: string | null;
          client_signature_path?: string | null;
          technician_name?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'jobs_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'jobs_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'templates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'jobs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      job_items: {
        Row: {
          id: string;
          job_id: string;
          template_item_id: string | null;
          label: string;
          result: string | null;
          note: string | null;
          photos: Json | null;
          position: number | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          job_id: string;
          template_item_id?: string | null;
          label: string;
          result?: string | null;
          note?: string | null;
          photos?: Json | null;
          position?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          job_id?: string;
          template_item_id?: string | null;
          label?: string;
          result?: string | null;
          note?: string | null;
          photos?: Json | null;
          position?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'job_items_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'job_items_template_item_id_fkey';
            columns: ['template_item_id'];
            isOneToOne: false;
            referencedRelation: 'template_items';
            referencedColumns: ['id'];
          },
        ];
      };
      photos: {
        Row: {
          id: string;
          job_id: string | null;
          checklist_id: string | null;
          storage_path: string;
          caption: string | null;
          geo_lat: number | null;
          geo_lng: number | null;
          shot_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          job_id?: string | null;
          checklist_id?: string | null;
          storage_path: string;
          caption?: string | null;
          geo_lat?: number | null;
          geo_lng?: number | null;
          shot_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          job_id?: string | null;
          checklist_id?: string | null;
          storage_path?: string;
          caption?: string | null;
          geo_lat?: number | null;
          geo_lng?: number | null;
          shot_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'photos_checklist_id_fkey';
            columns: ['checklist_id'];
            isOneToOne: false;
            referencedRelation: 'job_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'photos_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: {
          id: string;
          job_id: string;
          storage_path: string;
          generated_at: string;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          job_id: string;
          storage_path: string;
          generated_at?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          job_id?: string;
          storage_path?: string;
          generated_at?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'reports_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: true;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      report_deliveries: {
        Row: {
          id: string;
          job_id: string;
          report_id: string;
          recipient_email: string;
          recipient_name: string | null;
          status: string;
          last_error: string | null;
          sent_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          job_id: string;
          report_id: string;
          recipient_email: string;
          recipient_name?: string | null;
          status?: string;
          last_error?: string | null;
          sent_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          job_id?: string;
          report_id?: string;
          recipient_email?: string;
          recipient_name?: string | null;
          status?: string;
          last_error?: string | null;
          sent_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'report_deliveries_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'report_deliveries_report_id_fkey';
            columns: ['report_id'];
            isOneToOne: false;
            referencedRelation: 'reports';
            referencedColumns: ['id'];
          },
        ];
      };
      signatures: {
        Row: {
          job_id: string;
          plumber_sig_path: string | null;
          client_sig_path: string | null;
          signed_at: string | null;
        };
        Insert: {
          job_id: string;
          plumber_sig_path?: string | null;
          client_sig_path?: string | null;
          signed_at?: string | null;
        };
        Update: {
          job_id?: string;
          plumber_sig_path?: string | null;
          client_sig_path?: string | null;
          signed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'signatures_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: true;
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: Record<string, never>;
    Enums: {
      job_status: 'draft' | 'active' | 'awaiting_signatures' | 'awaiting_report' | 'completed';
      job_item_status: 'pending' | 'pass' | 'fail';
      template_item_type: 'toggle' | 'text' | 'number' | 'note';
    };
    CompositeTypes: Record<string, never>;
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof DatabaseWithoutInternals, 'public'>];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof (DatabaseWithoutInternals[PublicTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[PublicTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
      ? R
      : never
  : PublicTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][PublicEnumNameOrOptions]
    : never;
