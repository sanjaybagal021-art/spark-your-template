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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      account_recovery_requests: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          type: string
          user_email: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          type?: string
          user_email: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          type?: string
          user_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      affiliates: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
        }
        Relationships: []
      }
      bet_limits: {
        Row: {
          id: string
          market_name: string
          max_stake: number
          max_win: number
          min_stake: number
          updated_at: string
        }
        Insert: {
          id?: string
          market_name?: string
          max_stake?: number
          max_win?: number
          min_stake?: number
          updated_at?: string
        }
        Update: {
          id?: string
          market_name?: string
          max_stake?: number
          max_win?: number
          min_stake?: number
          updated_at?: string
        }
        Relationships: []
      }
      bets: {
        Row: {
          id: string
          market_name: string
          match_id: string
          match_title: string
          odds: number
          placed_at: string
          potential_win: number
          profit_loss: number | null
          selection_label: string
          settled_at: string | null
          stake: number
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          market_name: string
          match_id: string
          match_title: string
          odds: number
          placed_at?: string
          potential_win: number
          profit_loss?: number | null
          selection_label: string
          settled_at?: string | null
          stake: number
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          market_name?: string
          match_id?: string
          match_title?: string
          odds?: number
          placed_at?: string
          potential_win?: number
          profit_loss?: number | null
          selection_label?: string
          settled_at?: string | null
          stake?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      kyc_documents: {
        Row: {
          created_at: string
          doc_type: string
          file_name: string
          file_url: string
          id: string
          reject_reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_name: string
          file_url: string
          id?: string
          reject_reason?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_name?: string
          file_url?: string
          id?: string
          reject_reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      linked_accounts: {
        Row: {
          account_a: string
          account_b: string
          action_at: string | null
          action_by: string | null
          action_taken: string
          confidence_score: number
          detected_at: string
          id: string
          link_type: string
          notes: string | null
        }
        Insert: {
          account_a: string
          account_b: string
          action_at?: string | null
          action_by?: string | null
          action_taken?: string
          confidence_score?: number
          detected_at?: string
          id?: string
          link_type: string
          notes?: string | null
        }
        Update: {
          account_a?: string
          account_b?: string
          action_at?: string | null
          action_by?: string | null
          action_taken?: string
          confidence_score?: number
          detected_at?: string
          id?: string
          link_type?: string
          notes?: string | null
        }
        Relationships: []
      }
      locked_funds: {
        Row: {
          amount: number
          id: string
          locked_at: string
          notes: string | null
          reason: string
          released_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          id?: string
          locked_at?: string
          notes?: string | null
          reason: string
          released_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          id?: string
          locked_at?: string
          notes?: string | null
          reason?: string
          released_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      login_events: {
        Row: {
          created_at: string
          device_fingerprint: string | null
          event_type: string
          id: string
          ip_address: string | null
          is_new_device: boolean
          is_new_ip: boolean
          risk_flags: string[]
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          is_new_device?: boolean
          is_new_ip?: boolean
          risk_flags?: string[]
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          is_new_device?: boolean
          is_new_ip?: boolean
          risk_flags?: string[]
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      market_suspensions: {
        Row: {
          id: string
          market_name: string
          match_id: string
          reason: string | null
          suspended_at: string
          suspended_by: string | null
        }
        Insert: {
          id?: string
          market_name: string
          match_id: string
          reason?: string | null
          suspended_at?: string
          suspended_by?: string | null
        }
        Update: {
          id?: string
          market_name?: string
          match_id?: string
          reason?: string | null
          suspended_at?: string
          suspended_by?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          category: string
          channel: string
          enabled: boolean
          id: string
          user_id: string
        }
        Insert: {
          category: string
          channel: string
          enabled?: boolean
          id?: string
          user_id: string
        }
        Update: {
          category?: string
          channel?: string
          enabled?: boolean
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          read: boolean
          reference_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          reference_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          created_at: string
          details: Json
          id: string
          is_default: boolean
          is_verified: boolean
          label: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          is_default?: boolean
          is_verified?: boolean
          label: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          is_default?: boolean
          is_verified?: boolean
          label?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          aadhaar_number: string | null
          balance: number
          bonus_balance: number
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          id: string
          kyc_level: number
          kyc_reject_reason: string | null
          kyc_reviewed_at: string | null
          kyc_status: string
          kyc_submitted_at: string | null
          pan_number: string | null
          phone: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          aadhaar_number?: string | null
          balance?: number
          bonus_balance?: number
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          id?: string
          kyc_level?: number
          kyc_reject_reason?: string | null
          kyc_reviewed_at?: string | null
          kyc_status?: string
          kyc_submitted_at?: string | null
          pan_number?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          aadhaar_number?: string | null
          balance?: number
          bonus_balance?: number
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          id?: string
          kyc_level?: number
          kyc_reject_reason?: string | null
          kyc_reviewed_at?: string | null
          kyc_status?: string
          kyc_submitted_at?: string | null
          pan_number?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string
          currency: string
          description: string | null
          id: string
          idempotency_key: string | null
          metadata: Json | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_behavior_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          event_data: Json | null
          event_type: string
          id: string
          page_path: string | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          event_data?: Json | null
          event_type: string
          id?: string
          page_path?: string | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          event_data?: Json | null
          event_type?: string
          id?: string
          page_path?: string | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_device_sessions: {
        Row: {
          created_at: string
          device_fingerprint: string
          id: string
          last_seen_at: string
          screen_resolution: string | null
          timezone: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint: string
          id?: string
          last_seen_at?: string
          screen_resolution?: string | null
          timezone?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string
          id?: string
          last_seen_at?: string
          screen_resolution?: string | null
          timezone?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_referrals: {
        Row: {
          affiliate_id: string | null
          created_at: string
          id: string
          landing_url: string | null
          referral_code: string | null
          referred_by: string | null
          source: string | null
          user_id: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          affiliate_id?: string | null
          created_at?: string
          id?: string
          landing_url?: string | null
          referral_code?: string | null
          referred_by?: string | null
          source?: string | null
          user_id: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          affiliate_id?: string | null
          created_at?: string
          id?: string
          landing_url?: string | null
          referral_code?: string | null
          referred_by?: string | null
          source?: string | null
          user_id?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_risk_profiles: {
        Row: {
          account_status: string
          blocked_markets: string[]
          bonuses_disabled: boolean
          created_at: string
          flags: string[]
          id: string
          last_calculated_at: string | null
          max_bet_override: number | null
          risk_level: string
          risk_score: number
          user_id: string
          withdrawal_delay_hours: number
        }
        Insert: {
          account_status?: string
          blocked_markets?: string[]
          bonuses_disabled?: boolean
          created_at?: string
          flags?: string[]
          id?: string
          last_calculated_at?: string | null
          max_bet_override?: number | null
          risk_level?: string
          risk_score?: number
          user_id: string
          withdrawal_delay_hours?: number
        }
        Update: {
          account_status?: string
          blocked_markets?: string[]
          bonuses_disabled?: boolean
          created_at?: string
          flags?: string[]
          id?: string
          last_calculated_at?: string | null
          max_bet_override?: number | null
          risk_level?: string
          risk_score?: number
          user_id?: string
          withdrawal_delay_hours?: number
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_balances: {
        Row: {
          id: string
          locked_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          locked_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          locked_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      detect_multi_accounts: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      place_bet_atomic: {
        Args: {
          p_market_name: string
          p_match_id: string
          p_match_title: string
          p_odds: number
          p_potential_win: number
          p_selection_label: string
          p_stake: number
        }
        Returns: Json
      }
      wallet_credit: {
        Args: {
          p_amount: number
          p_description: string
          p_idempotency_key: string
          p_type: string
          p_user_id: string
        }
        Returns: Json
      }
      wallet_debit: {
        Args: {
          p_amount: number
          p_description: string
          p_idempotency_key: string
          p_type: string
          p_user_id: string
        }
        Returns: Json
      }
      wallet_get_balance: { Args: { p_user_id: string }; Returns: Json }
      wallet_withdraw_with_checks: {
        Args: {
          p_amount: number
          p_description: string
          p_idempotency_key: string
          p_user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      account_status_enum:
        | "active"
        | "restricted"
        | "suspended"
        | "under_review"
        | "blocked"
      app_role: "admin" | "moderator" | "user"
      kyc_status_enum: "unverified" | "pending" | "verified" | "rejected"
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
      account_status_enum: [
        "active",
        "restricted",
        "suspended",
        "under_review",
        "blocked",
      ],
      app_role: ["admin", "moderator", "user"],
      kyc_status_enum: ["unverified", "pending", "verified", "rejected"],
    },
  },
} as const
