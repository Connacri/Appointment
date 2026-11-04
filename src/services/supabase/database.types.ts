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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          payload: Json
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          payload?: Json
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          payload?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          method: string
          note: string | null
          paid_at: string
          reference: string | null
          workspace_id: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id: string
          method: string
          note?: string | null
          paid_at?: string
          reference?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          method?: string
          note?: string | null
          paid_at?: string
          reference?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_booking_tenant_fk"
            columns: ["booking_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      bookings: {
        Row: {
          adults: number
          children: number
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          domain: string
          end_date: string
          establishment_id: string
          extras: Json
          guest_email: string | null
          guest_id: string | null
          guest_metadata: Json
          guest_name: string
          guest_phone: string | null
          id: string
          meal_plan: string | null
          notes: string | null
          occupants: Json
          origin_channel: string | null
          payment_status: string
          payments_summary: Json
          resource_id: string
          resource_name: string
          start_date: string
          status: string
          total_price: number
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          adults?: number
          children?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          domain: string
          end_date: string
          establishment_id: string
          extras?: Json
          guest_email?: string | null
          guest_id?: string | null
          guest_metadata?: Json
          guest_name: string
          guest_phone?: string | null
          id: string
          meal_plan?: string | null
          notes?: string | null
          occupants?: Json
          origin_channel?: string | null
          payment_status?: string
          payments_summary?: Json
          resource_id: string
          resource_name: string
          start_date: string
          status?: string
          total_price?: number
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          adults?: number
          children?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          domain?: string
          end_date?: string
          establishment_id?: string
          extras?: Json
          guest_email?: string | null
          guest_id?: string | null
          guest_metadata?: Json
          guest_name?: string
          guest_phone?: string | null
          id?: string
          meal_plan?: string | null
          notes?: string | null
          occupants?: Json
          origin_channel?: string | null
          payment_status?: string
          payments_summary?: Json
          resource_id?: string
          resource_name?: string
          start_date?: string
          status?: string
          total_price?: number
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_establishment_tenant_fk"
            columns: ["establishment_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "bookings_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_guest_tenant_fk"
            columns: ["guest_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "bookings_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_resource_tenant_fk"
            columns: ["resource_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "bookings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dynamic_rates: {
        Row: {
          created_at: string
          currency: string
          deleted_at: string | null
          establishment_id: string
          id: string
          price: number
          rate_date: string
          resource_type: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          deleted_at?: string | null
          establishment_id: string
          id?: string
          price: number
          rate_date: string
          resource_type: string
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          deleted_at?: string | null
          establishment_id?: string
          id?: string
          price?: number
          rate_date?: string
          resource_type?: string
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dynamic_rates_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dynamic_rates_establishment_tenant_fk"
            columns: ["establishment_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "dynamic_rates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      establishments: {
        Row: {
          address: string | null
          check_in_time: string
          check_out_time: string
          city: string | null
          code: string
          country: string
          created_at: string
          currency: string
          deleted_at: string | null
          domain: string
          establishment_type: string
          facilities: Json
          id: string
          is_active: boolean
          name: string
          settings: Json
          stars: number
          tax_rate: number
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          address?: string | null
          check_in_time?: string
          check_out_time?: string
          city?: string | null
          code: string
          country?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          domain?: string
          establishment_type?: string
          facilities?: Json
          id: string
          is_active?: boolean
          name: string
          settings?: Json
          stars?: number
          tax_rate?: number
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          address?: string | null
          check_in_time?: string
          check_out_time?: string
          city?: string | null
          code?: string
          country?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          domain?: string
          establishment_type?: string
          facilities?: Json
          id?: string
          is_active?: boolean
          name?: string
          settings?: Json
          stars?: number
          tax_rate?: number
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          address: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          establishment_id: string | null
          full_name: string
          guest_type: string | null
          id: string
          identity_number: string | null
          identity_type: string | null
          metadata: Json
          nationality: string | null
          passport_number: string | null
          phone: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          establishment_id?: string | null
          full_name: string
          guest_type?: string | null
          id: string
          identity_number?: string | null
          identity_type?: string | null
          metadata?: Json
          nationality?: string | null
          passport_number?: string | null
          phone?: string | null
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          establishment_id?: string | null
          full_name?: string
          guest_type?: string | null
          id?: string
          identity_number?: string | null
          identity_type?: string | null
          metadata?: Json
          nationality?: string | null
          passport_number?: string | null
          phone?: string | null
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_establishment_tenant_fk"
            columns: ["establishment_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "guests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          description: string
          id: string
          invoice_id: string
          quantity: number
          sort_order: number
          total: number
          unit_price: number
          vat_rate: number
          workspace_id: string
        }
        Insert: {
          description: string
          id: string
          invoice_id: string
          quantity?: number
          sort_order?: number
          total?: number
          unit_price?: number
          vat_rate?: number
          workspace_id: string
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          sort_order?: number
          total?: number
          unit_price?: number
          vat_rate?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_tenant_fk"
            columns: ["invoice_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "invoice_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          balance_due: number
          booking_id: string | null
          city_tourist_tax: number
          created_at: string
          currency: string
          customer_address: string | null
          customer_company: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          customer_tax_id: string | null
          deleted_at: string | null
          deposit_paid: number
          discount_amount: number
          discount_code: string | null
          discount_type: string
          discount_value: number
          doc_number: string
          doc_type: string
          domain: string
          due_date: string
          establishment_id: string
          id: string
          issue_date: string
          payment_method: string | null
          status: string
          subtotal_ht: number
          terms_and_notes: string | null
          total_ttc: number
          updated_at: string
          vat_amount: number
          version: number
          workspace_id: string
        }
        Insert: {
          balance_due?: number
          booking_id?: string | null
          city_tourist_tax?: number
          created_at?: string
          currency?: string
          customer_address?: string | null
          customer_company?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_tax_id?: string | null
          deleted_at?: string | null
          deposit_paid?: number
          discount_amount?: number
          discount_code?: string | null
          discount_type?: string
          discount_value?: number
          doc_number: string
          doc_type: string
          domain: string
          due_date: string
          establishment_id: string
          id: string
          issue_date: string
          payment_method?: string | null
          status?: string
          subtotal_ht?: number
          terms_and_notes?: string | null
          total_ttc?: number
          updated_at?: string
          vat_amount?: number
          version?: number
          workspace_id: string
        }
        Update: {
          balance_due?: number
          booking_id?: string | null
          city_tourist_tax?: number
          created_at?: string
          currency?: string
          customer_address?: string | null
          customer_company?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_tax_id?: string | null
          deleted_at?: string | null
          deposit_paid?: number
          discount_amount?: number
          discount_code?: string | null
          discount_type?: string
          discount_value?: number
          doc_number?: string
          doc_type?: string
          domain?: string
          due_date?: string
          establishment_id?: string
          id?: string
          issue_date?: string
          payment_method?: string | null
          status?: string
          subtotal_ht?: number
          terms_and_notes?: string | null
          total_ttc?: number
          updated_at?: string
          vat_amount?: number
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_booking_tenant_fk"
            columns: ["booking_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "invoices_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_establishment_tenant_fk"
            columns: ["establishment_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pms_tasks: {
        Row: {
          assignee: string | null
          category: string
          completed_at: string | null
          completed_by: string | null
          consumed_items: Json
          created_at: string
          deleted_at: string | null
          establishment_id: string
          id: string
          note: string | null
          priority: string
          resource_id: string | null
          room: string | null
          status: string
          subtasks: Json
          task_date: string
          tools: Json
          type_id: string | null
          type_name: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          assignee?: string | null
          category: string
          completed_at?: string | null
          completed_by?: string | null
          consumed_items?: Json
          created_at?: string
          deleted_at?: string | null
          establishment_id: string
          id: string
          note?: string | null
          priority?: string
          resource_id?: string | null
          room?: string | null
          status?: string
          subtasks?: Json
          task_date: string
          tools?: Json
          type_id?: string | null
          type_name: string
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          assignee?: string | null
          category?: string
          completed_at?: string | null
          completed_by?: string | null
          consumed_items?: Json
          created_at?: string
          deleted_at?: string | null
          establishment_id?: string
          id?: string
          note?: string | null
          priority?: string
          resource_id?: string | null
          room?: string | null
          status?: string
          subtasks?: Json
          task_date?: string
          tools?: Json
          type_id?: string | null
          type_name?: string
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pms_tasks_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pms_tasks_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pms_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_establishment_tenant_fk"
            columns: ["establishment_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "tasks_resource_tenant_fk"
            columns: ["resource_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          locale: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      resource_groups: {
        Row: {
          created_at: string
          deleted_at: string | null
          domain: string
          establishment_id: string
          icon: string | null
          id: string
          name: Json
          sort_order: number
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          domain: string
          establishment_id: string
          icon?: string | null
          id: string
          name: Json
          sort_order?: number
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          domain?: string
          establishment_id?: string
          icon?: string | null
          id?: string
          name?: Json
          sort_order?: number
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_groups_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_groups_establishment_tenant_fk"
            columns: ["establishment_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "resource_groups_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          amenities: Json
          beds: string | null
          building: string | null
          capacity: number | null
          created_at: string
          deleted_at: string | null
          domain: string
          establishment_id: string
          floor: string | null
          group_id: string | null
          housekeeping_status: string
          id: string
          is_active: boolean
          name: string
          price_per_day: number
          resource_type: string
          size_m2: number | null
          updated_at: string
          version: number
          view: string | null
          workspace_id: string
        }
        Insert: {
          amenities?: Json
          beds?: string | null
          building?: string | null
          capacity?: number | null
          created_at?: string
          deleted_at?: string | null
          domain: string
          establishment_id: string
          floor?: string | null
          group_id?: string | null
          housekeeping_status?: string
          id: string
          is_active?: boolean
          name: string
          price_per_day?: number
          resource_type: string
          size_m2?: number | null
          updated_at?: string
          version?: number
          view?: string | null
          workspace_id: string
        }
        Update: {
          amenities?: Json
          beds?: string | null
          building?: string | null
          capacity?: number | null
          created_at?: string
          deleted_at?: string | null
          domain?: string
          establishment_id?: string
          floor?: string | null
          group_id?: string | null
          housekeeping_status?: string
          id?: string
          is_active?: boolean
          name?: string
          price_per_day?: number
          resource_type?: string
          size_m2?: number | null
          updated_at?: string
          version?: number
          view?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_establishment_tenant_fk"
            columns: ["establishment_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "resources_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "resource_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_group_tenant_fk"
            columns: ["group_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "resource_groups"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "resources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          category: string
          created_at: string
          deleted_at: string | null
          establishment_id: string
          id: string
          min_threshold: number
          name: string
          quantity: number
          unit: string
          unit_cost: number
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          category: string
          created_at?: string
          deleted_at?: string | null
          establishment_id: string
          id: string
          min_threshold?: number
          name: string
          quantity?: number
          unit: string
          unit_cost?: number
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          establishment_id?: string
          id?: string
          min_threshold?: number
          name?: string
          quantity?: number
          unit?: string
          unit_cost?: number
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_establishment_tenant_fk"
            columns: ["establishment_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "stock_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          actor_name: string | null
          created_at: string
          created_by: string | null
          delta: number
          establishment_id: string
          id: string
          item_id: string
          reason: string
          room: string | null
          timestamp: string
          workspace_id: string
        }
        Insert: {
          actor_name?: string | null
          created_at?: string
          created_by?: string | null
          delta: number
          establishment_id: string
          id: string
          item_id: string
          reason: string
          room?: string | null
          timestamp?: string
          workspace_id: string
        }
        Update: {
          actor_name?: string | null
          created_at?: string
          created_by?: string | null
          delta?: number
          establishment_id?: string
          id?: string
          item_id?: string
          reason?: string
          room?: string | null
          timestamp?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_establishment_tenant_fk"
            columns: ["establishment_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_item_tenant_fk"
            columns: ["item_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "stock_movements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
