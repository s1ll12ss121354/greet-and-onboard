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
      coach_sessions: {
        Row: {
          advice: string
          created_at: string
          goal: string
          id: string
          stats: Json
          user_id: string
        }
        Insert: {
          advice: string
          created_at?: string
          goal: string
          id?: string
          stats: Json
          user_id: string
        }
        Update: {
          advice?: string
          created_at?: string
          goal?: string
          id?: string
          stats?: Json
          user_id?: string
        }
        Relationships: []
      }
      host_applications: {
        Row: {
          accepted_rules: boolean
          created_at: string
          discord_contact: string | null
          has_vip: boolean
          id: string
          priority: boolean
          reason: string
          roblox_nick: string
          status: string
          telegram_contact: string | null
          user_id: string
        }
        Insert: {
          accepted_rules?: boolean
          created_at?: string
          discord_contact?: string | null
          has_vip: boolean
          id?: string
          priority?: boolean
          reason: string
          roblox_nick: string
          status?: string
          telegram_contact?: string | null
          user_id: string
        }
        Update: {
          accepted_rules?: boolean
          created_at?: string
          discord_contact?: string | null
          has_vip?: boolean
          id?: string
          priority?: boolean
          reason?: string
          roblox_nick?: string
          status?: string
          telegram_contact?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          banned: boolean
          created_at: string
          elo: number
          id: string
          losses: number
          nickname: string
          last_seen_at: string | null
          support_priority: boolean
          wins: number
        }
        Insert: {
          banned?: boolean
          created_at?: string
          elo?: number
          id: string
          losses?: number
          nickname: string
          last_seen_at?: string | null
          support_priority?: boolean
          wins?: number
        }
        Update: {
          banned?: boolean
          created_at?: string
          elo?: number
          id?: string
          losses?: number
          nickname?: string
          last_seen_at?: string | null
          wins?: number
        }
        Relationships: []
      }
      match_lobbies: {
        Row: {
          created_at: string
          creator_id: string
          host_needed_notified_at: string | null
          host_user_id: string | null
          id: string
          last_activity_at: string
          max_players: number
          search_started_at: string
          status: string
          target_players: number
        }
        Insert: {
          created_at?: string
          creator_id: string
          host_needed_notified_at?: string | null
          host_user_id?: string | null
          id?: string
          last_activity_at?: string
          max_players?: number
          search_started_at?: string
          status?: string
          target_players?: number
        }
        Update: {
          created_at?: string
          creator_id?: string
          host_needed_notified_at?: string | null
          host_user_id?: string | null
          id?: string
          last_activity_at?: string
          max_players?: number
          search_started_at?: string
          status?: string
          target_players?: number
        }
        Relationships: []
      }
      match_lobby_members: {
        Row: {
          id: string
          joined_at: string
          lobby_id: string
          member_kind: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          lobby_id: string
          member_kind?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          lobby_id?: string
          member_kind?: string
          user_id?: string
        }
        Relationships: []
      }
      host_notifications: {
        Row: {
          created_at: string
          host_user_id: string
          id: string
          lobby_id: string
          message: string
          status: string
        }
        Insert: {
          created_at?: string
          host_user_id: string
          id?: string
          lobby_id: string
          message: string
          status?: string
        }
        Update: {
          created_at?: string
          host_user_id?: string
          id?: string
          lobby_id?: string
          message?: string
          status?: string
        }
        Relationships: []
      }
      security_login_events: {
        Row: {
          browser: string | null
          created_at: string
          device_category: string
          id: string
          ip_hash: string | null
          os: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_category: string
          id?: string
          ip_hash?: string | null
          os?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_category?: string
          id?: string
          ip_hash?: string | null
          os?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string
          id: string
          priority: boolean
          reason: string
          status: string
          target_nick: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string
          id?: string
          priority?: boolean
          reason: string
          status?: string
          target_nick: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          priority?: boolean
          reason?: string
          status?: string
          target_nick?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          created_at: string
          details: Json
          event_type: string
          id: string
          path: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          path?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          path?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ban_requests: {
        Row: {
          created_at: string
          id: string
          report_id: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_nick: string
        }
        Insert: {
          created_at?: string
          id?: string
          report_id: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_nick: string
        }
        Update: {
          created_at?: string
          id?: string
          report_id?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_nick?: string
        }
        Relationships: []
      }
      custom_roles: {
        Row: {
          color: string
          created_at: string
          created_by: string
          description: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          description?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_custom_roles: {
        Row: {
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      log_activity: {
        Args: {
          p_event_type: string
          p_path?: string | null
          p_details?: Json
        }
        Returns: string
      }
      request_report_ban: {
        Args: {
          p_report_id: string
        }
        Returns: string
      }
      review_ban_request: {
        Args: {
          p_request_id: string
          p_approve: boolean
        }
        Returns: boolean
      }
      admin_create_custom_role: {
        Args: {
          p_name: string
          p_color?: string
          p_description?: string
        }
        Returns: string
      }
      admin_assign_custom_role: {
        Args: {
          p_user_id: string
          p_role_id: string
        }
        Returns: boolean
      }
      admin_remove_custom_role: {
        Args: {
          p_user_id: string
          p_role_id: string
        }
        Returns: boolean
      }
      admin_delete_custom_role: {
        Args: {
          p_role_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "host" | "moderator" | "admin"
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
    Enums: {
      app_role: ["host", "moderator", "admin"],
    },
  },
} as const        mm_create_lobby: {
          Args: Record<PropertyKey, never>
          Returns: string
        }
        mm_leave_lobby: {
          Args: { p_lobby_id: string }
          Returns: boolean
        }
        mm_open_lobbies: {
          Args: Record<PropertyKey, never>
          Returns: {
            id: string
            status: string
            creator_id: string
            player_count: number
            spectator_count: number
            search_started_at: string
            host_user_id: string | null
          }[]
        }
        mm_search_lobby: {
          Args: Record<PropertyKey, never>
          Returns: string
        }
        mm_join_lobby: {
          Args: { p_lobby_id: string; p_spectator?: boolean }
          Returns: Json
        }

