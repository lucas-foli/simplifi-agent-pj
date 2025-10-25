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
      users: {
        Row: {
          id: string
          email: string
          name: string
          user_type: 'pf' | 'pj'
          company_name: string | null
          cnpj: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          user_type: 'pf' | 'pj'
          company_name?: string | null
          cnpj?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          user_type?: 'pf' | 'pj'
          company_name?: string | null
          cnpj?: string | null
          updated_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          user_id: string
          name: string
          cnpj: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          cnpj?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          cnpj?: string | null
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          company_id: string | null
          description: string
          amount: number
          category: string
          payment_method: string | null
          date: string
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id?: string | null
          description: string
          amount: number
          category: string
          payment_method?: string | null
          date: string
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string | null
          description?: string
          amount?: number
          category?: string
          payment_method?: string | null
          date?: string
          notes?: string | null
          updated_at?: string
        }
      }
      fixed_costs: {
        Row: {
          id: string
          user_id: string
          company_id: string | null
          name: string
          amount: number
          recurrence: 'monthly' | 'quarterly' | 'annual'
          month: number
          year: number
          replicate: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id?: string | null
          name: string
          amount: number
          recurrence?: 'monthly' | 'quarterly' | 'annual'
          month: number
          year: number
          replicate?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string | null
          name?: string
          amount?: number
          recurrence?: 'monthly' | 'quarterly' | 'annual'
          month?: number
          year?: number
          replicate?: boolean
          updated_at?: string
        }
      }
      monthly_income: {
        Row: {
          id: string
          user_id: string
          company_id: string | null
          amount: number
          month: number
          year: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id?: string | null
          amount: number
          month: number
          year: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string | null
          amount?: number
          month?: number
          year?: number
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          parent_id: string | null
          color: string | null
          icon: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          parent_id?: string | null
          color?: string | null
          icon?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          parent_id?: string | null
          color?: string | null
          icon?: string | null
          updated_at?: string
        }
      }
      classification_rules: {
        Row: {
          id: string
          user_id: string
          category: string
          keywords: string[]
          regex: string | null
          mcc: string | null
          merchant_name: string | null
          priority: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category: string
          keywords?: string[]
          regex?: string | null
          mcc?: string | null
          merchant_name?: string | null
          priority?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category?: string
          keywords?: string[]
          regex?: string | null
          mcc?: string | null
          merchant_name?: string | null
          priority?: number
          updated_at?: string
        }
      }
      chat_history: {
        Row: {
          id: string
          user_id: string
          message: string
          role: 'user' | 'assistant'
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          message: string
          role: 'user' | 'assistant'
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          message?: string
          role?: 'user' | 'assistant'
          metadata?: Json | null
        }
      }
      audit_log: {
        Row: {
          id: string
          user_id: string
          action: string
          table_name: string
          record_id: string
          old_values: Json | null
          new_values: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action: string
          table_name: string
          record_id: string
          old_values?: Json | null
          new_values?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action?: string
          table_name?: string
          record_id?: string
          old_values?: Json | null
          new_values?: Json | null
        }
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
  }
}
