// PLACEHOLDER (Database area). Hand-written to match the schema in CLAUDE.md and docs/database.md,
// in the same shape as `npx supabase gen types typescript --local > lib/types.db.ts`.
// The database owner replaces this file with the generated one once the migrations exist.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; business_name: string | null; default_tax_rate: number };
        Insert: { id: string; business_name?: string | null; default_tax_rate?: number };
        Update: { id?: string; business_name?: string | null; default_tax_rate?: number };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          client: string | null;
          address: string | null;
          tax_rate: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          client?: string | null;
          address?: string | null;
          tax_rate: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          client?: string | null;
          address?: string | null;
          tax_rate?: number;
          created_at?: string | null;
        };
        Relationships: [];
      };
      project_columns: {
        Row: { id: string; project_id: string; name: string; position: number };
        Insert: { id?: string; project_id: string; name: string; position: number };
        Update: { id?: string; project_id?: string; name?: string; position?: number };
        Relationships: [
          {
            foreignKeyName: 'project_columns_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      rows: {
        Row: {
          id: string;
          project_id: string;
          position: number;
          date: string | null;
          description: string;
          calc_type: Database['public']['Enums']['calc_type'];
          quantity: number | null;
          unit: string | null;
          unit_price: number | null;
          percent: number | null;
          extra: Json;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          position: number;
          date?: string | null;
          description: string;
          calc_type?: Database['public']['Enums']['calc_type'];
          quantity?: number | null;
          unit?: string | null;
          unit_price?: number | null;
          percent?: number | null;
          extra?: Json;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          position?: number;
          date?: string | null;
          description?: string;
          calc_type?: Database['public']['Enums']['calc_type'];
          quantity?: number | null;
          unit?: string | null;
          unit_price?: number | null;
          percent?: number | null;
          extra?: Json;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'rows_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      reorder_rows: { Args: { p_project_id: string; p_row_ids: string[] }; Returns: undefined };
      delete_column: { Args: { p_column_id: string }; Returns: undefined };
    };
    Enums: { calc_type: 'fixed' | 'qty_price' | 'percent' };
    CompositeTypes: { [_ in never]: never };
  };
};
