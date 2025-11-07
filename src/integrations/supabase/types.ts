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
      categories: {
        Row: {
          color: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          activity: string | null
          created_at: string
          created_by: string | null
          cnpj_encrypted: string | null
          email: string | null
          id: string
          metadata: Json | null
          monthly_revenue: number
          name: string
          phone: string | null
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          activity?: string | null
          created_at?: string
          created_by?: string | null
          cnpj_encrypted?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          monthly_revenue?: number
          name: string
          phone?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          activity?: string | null
          created_at?: string
          created_by?: string | null
          cnpj_encrypted?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          monthly_revenue?: number
          name?: string
          phone?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_categories: {
        Row: {
          color: string
          company_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_fixed_costs: {
        Row: {
          amount: number
          category_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          payment_method: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          payment_method?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          payment_method?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_fixed_costs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "company_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_fixed_costs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_fixed_costs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          invited_by: string | null
          profile_id: string
          role: Database["pj"]["Enums"]["member_role"]
        }
        Insert: {
          company_id: string
          created_at?: string
          invited_by?: string | null
          profile_id: string
          role?: Database["pj"]["Enums"]["member_role"]
        }
        Update: {
          company_id?: string
          created_at?: string
          invited_by?: string | null
          profile_id?: string
          role?: Database["pj"]["Enums"]["member_role"]
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_transactions: {
        Row: {
          amount: number
          category_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          date: string
          description: string
          id: string
          notes: string | null
          payment_method: string | null
          type: Database["pj"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          date?: string
          description: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          type: Database["pj"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          type?: Database["pj"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "company_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classification_rules: {
        Row: {
          category_id: string
          created_at: string
          id: string
          keyword: string
          priority: number
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          keyword: string
          priority?: number
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          keyword?: string
          priority?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classification_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_costs: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          description: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          description: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_costs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_costs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cnpj: string | null
          company_name: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          monthly_income: number
          updated_at: string
          user_type: Database["pj"]["Enums"]["user_type"]
        }
        Insert: {
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          monthly_income?: number
          updated_at?: string
          user_type: Database["pj"]["Enums"]["user_type"]
        }
        Update: {
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          monthly_income?: number
          updated_at?: string
          user_type?: Database["pj"]["Enums"]["user_type"]
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          payment_method: string | null
          created_at: string
          date: string
          description: string
          fixed_cost_id: string | null
          id: string
          is_fixed_cost: boolean
          type: Database["pj"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          payment_method?: string | null
          created_at?: string
          date?: string
          description: string
          fixed_cost_id?: string | null
          id?: string
          is_fixed_cost?: boolean
          type: Database["pj"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          payment_method?: string | null
          created_at?: string
          date?: string
          description?: string
          fixed_cost_id?: string | null
          id?: string
          is_fixed_cost?: boolean
          type?: Database["pj"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_fixed_cost_id_fkey"
            columns: ["fixed_cost_id"]
            isOneToOne: false
            referencedRelation: "fixed_costs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrypt_sensitive: {
        Args: {
          encrypted_data: string | null
        }
        Returns: string | null
      }
      encrypt_sensitive: {
        Args: {
          data: string | null
        }
        Returns: string | null
      }
    }
    Enums: {
      transaction_type: "receita" | "despesa"
      user_type: "pessoa_fisica" | "pessoa_juridica"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  pj: {
    Tables: {
      companies: {
        Row: {
          activity: string | null
          created_at: string
          created_by: string | null
          cnpj_encrypted: string | null
          email: string | null
          id: string
          metadata: Json | null
          monthly_revenue: number
          name: string
          phone: string | null
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          activity?: string | null
          created_at?: string
          created_by?: string | null
          cnpj_encrypted?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          monthly_revenue?: number
          name: string
          phone?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          activity?: string | null
          created_at?: string
          created_by?: string | null
          cnpj_encrypted?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          monthly_revenue?: number
          name?: string
          phone?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_categories: {
        Row: {
          color: string
          company_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_fixed_costs: {
        Row: {
          amount: number
          category_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          payment_method: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          payment_method?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          payment_method?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_fixed_costs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "company_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_fixed_costs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_fixed_costs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          invited_by: string | null
          profile_id: string
          role: Database["pj"]["Enums"]["member_role"]
        }
        Insert: {
          company_id: string
          created_at?: string
          invited_by?: string | null
          profile_id: string
          role?: Database["pj"]["Enums"]["member_role"]
        }
        Update: {
          company_id?: string
          created_at?: string
          invited_by?: string | null
          profile_id?: string
          role?: Database["pj"]["Enums"]["member_role"]
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_transactions: {
        Row: {
          amount: number
          category_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          date: string
          description: string
          id: string
          notes: string | null
          payment_method: string | null
          type: Database["pj"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          date?: string
          description: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          type: Database["pj"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          type?: Database["pj"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "company_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_company_with_owner: {
        Args: {
          payload: Json
        }
        Returns: string
      }
      pg_create_company_with_owner: {
        Args: {
          payload: Json
        }
        Returns: string
      }
      pg_ensure_company_for_user: {
        Args: {
          payload: Json
        }
        Returns: string
      }
      ensure_company_for_user: {
        Args: {
          payload: Json
        }
        Returns: string
      }
    }
    Enums: {
      member_role: "owner" | "admin" | "member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "pj">]

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
  SchemaCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends SchemaCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[SchemaCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = SchemaCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[SchemaCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : SchemaCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][SchemaCompositeTypeNameOrOptions]
    : never

export const Constants = {
  pj: {
    Enums: {
      transaction_type: ["receita", "despesa"],
      user_type: ["pessoa_fisica", "pessoa_juridica"],
    },
  },
} as const
