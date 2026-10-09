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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          event_type: string | null
          id: string
          page: string | null
          path: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          event_type?: string | null
          id?: string
          page?: string | null
          path?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          event_type?: string | null
          id?: string
          page?: string | null
          path?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ban_requests: {
        Row: {
          admin_id: string | null
          created_at: string
          id: string
          reason: string
          report_id: string | null
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_nick: string | null
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          id?: string
          reason: string
          report_id?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_nick?: string | null
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          id?: string
          reason?: string
          report_id?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_nick?: string | null
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ban_requests_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
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
      custom_roles: {
        Row: {
          color: string | null
          created_at: string
          description: string
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string
          id?: string
          name?: string
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
        Relationships: [
          {
            foreignKeyName: "host_notifications_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "match_lobbies"
            referencedColumns: ["id"]
          },
        ]
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
          ready_check_started_at: string | null
          search_started_at: string
          selected_map: string | null
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
          ready_check_started_at?: string | null
          search_started_at?: string
          selected_map?: string | null
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
          ready_check_started_at?: string | null
          search_started_at?: string
          selected_map?: string | null
          status?: string
          target_players?: number
        }
        Relationships: []
      }
      match_lobby_map_votes: {
        Row: {
          created_at: string
          lobby_id: string
          map_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          lobby_id: string
          map_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          lobby_id?: string
          map_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lobby_map_votes_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "match_lobbies"
            referencedColumns: ["id"]
          },
        ]
      }
      match_lobby_members: {
        Row: {
          id: string
          joined_at: string
          lobby_id: string
          member_kind: string
          ready: boolean
          team: string | null
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          lobby_id: string
          member_kind?: string
          ready?: boolean
          team?: string | null
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          lobby_id?: string
          member_kind?: string
          ready?: boolean
          team?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lobby_members_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "match_lobbies"
            referencedColumns: ["id"]
          },
        ]
      }
      match_result_players: {
        Row: {
          deaths: number
          elo_delta: number
          id: string
          kd: number
          kills: number
          result_id: string
          user_id: string
          won: boolean
        }
        Insert: {
          deaths: number
          elo_delta: number
          id?: string
          kd: number
          kills: number
          result_id: string
          user_id: string
          won?: boolean
        }
        Update: {
          deaths?: number
          elo_delta?: number
          id?: string
          kd?: number
          kills?: number
          result_id?: string
          user_id?: string
          won?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "match_result_players_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "match_results"
            referencedColumns: ["id"]
          },
        ]
      }
      match_results: {
        Row: {
          created_at: string
          id: string
          lobby_id: string
          screenshot_path: string | null
          submitted_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          lobby_id: string
          screenshot_path?: string | null
          submitted_by: string
        }
        Update: {
          created_at?: string
          id?: string
          lobby_id?: string
          screenshot_path?: string | null
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_results_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: true
            referencedRelation: "match_lobbies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar: string | null
          avatar_url: string | null
          ban_reason: string | null
          ban_until: string | null
          banned: boolean
          banner_url: string | null
          created_at: string
          elo: number
          id: string
          last_seen_at: string | null
          losses: number
          nickname: string
          support_priority: boolean
          wins: number
        }
        Insert: {
          avatar?: string | null
          avatar_url?: string | null
          ban_reason?: string | null
          ban_until?: string | null
          banned?: boolean
          banner_url?: string | null
          created_at?: string
          elo?: number
          id: string
          last_seen_at?: string | null
          losses?: number
          nickname: string
          support_priority?: boolean
          wins?: number
        }
        Update: {
          avatar?: string | null
          avatar_url?: string | null
          ban_reason?: string | null
          ban_until?: string | null
          banned?: boolean
          banner_url?: string | null
          created_at?: string
          elo?: number
          id?: string
          last_seen_at?: string | null
          losses?: number
          nickname?: string
          support_priority?: boolean
          wins?: number
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
      security_login_events: {
        Row: {
          browser: string | null
          created_at: string
          device_category: string | null
          event_type: string
          id: string
          ip_address: string | null
          ip_hash: string | null
          os: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_category?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          ip_hash?: string | null
          os?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_category?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          ip_hash?: string | null
          os?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_rate_limits: {
        Row: {
          action: string
          request_count: number
          user_id: string
          window_started_at: string
        }
        Insert: {
          action: string
          request_count?: number
          user_id: string
          window_started_at?: string
        }
        Update: {
          action?: string
          request_count?: number
          user_id?: string
          window_started_at?: string
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
        Relationships: [
          {
            foreignKeyName: "user_custom_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
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
      admin_assign_custom_role: {
        Args: { p_role_id: string; p_user_id: string }
        Returns: boolean
      }
      admin_create_custom_role: {
        Args: { p_color?: string; p_description?: string; p_name: string }
        Returns: string
      }
      admin_delete_custom_role: {
        Args: { p_role_id: string }
        Returns: boolean
      }
      admin_remove_custom_role: {
        Args: { p_role_id: string; p_user_id: string }
        Returns: boolean
      }
      admin_review_host_application: {
        Args: { p_application_id: string; p_approve: boolean }
        Returns: boolean
      }
      admin_set_report_status: {
        Args: {
          p_ban_minutes?: number
          p_ban_reason?: string
          p_report_id: string
          p_status: string
        }
        Returns: boolean
      }
      admin_set_support_priority: {
        Args: { p_enabled: boolean; p_user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_ban: { Args: { p_user_id: string }; Returns: boolean }
      is_recorn_lobby_member: {
        Args: { p_lobby_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_recorn_owner: { Args: { p_user_id: string }; Returns: boolean }
      lobby_public_profiles: {
        Args: { p_lobby_id: string }
        Returns: {
          avatar_url: string
          banner_url: string
          elo: number
          id: string
          losses: number
          nickname: string
          wins: number
        }[]
      }
      log_activity: {
        Args: { p_details?: Json; p_event_type: string; p_path?: string }
        Returns: boolean
      }
      mm_assign_teams: { Args: { p_lobby_id: string }; Returns: boolean }
      mm_create_lobby: { Args: never; Returns: string }
      mm_expire_unready: { Args: { p_lobby_id: string }; Returns: boolean }
      mm_join_lobby: {
        Args: { p_lobby_id: string; p_spectator?: boolean }
        Returns: Json
      }
      mm_leave_lobby: { Args: { p_lobby_id: string }; Returns: boolean }
      mm_open_lobbies: {
        Args: never
        Returns: {
          creator_id: string
          host_user_id: string
          id: string
          player_count: number
          search_started_at: string
          selected_map: string
          spectator_count: number
          status: string
        }[]
      }
      mm_owner_start_lobby: { Args: { p_lobby_id: string }; Returns: boolean }
      mm_search_lobby: { Args: never; Returns: string }
      mm_set_ready: {
        Args: { p_lobby_id: string; p_ready: boolean }
        Returns: boolean
      }
      mm_start_ready_check: { Args: { p_lobby_id: string }; Returns: boolean }
      mm_vote_map: {
        Args: { p_lobby_id: string; p_map_name: string }
        Returns: Json
      }
      owner_grant_admin: { Args: { p_user_id: string }; Returns: boolean }
      public_leaderboard: {
        Args: { p_limit?: number }
        Returns: {
          elo: number
          id: string
          losses: number
          nickname: string
          wins: number
        }[]
      }
      request_report_ban: { Args: { p_report_id: string }; Returns: string }
      review_ban_request: {
        Args: { p_approve: boolean; p_request_id: string }
        Returns: boolean
      }
      submit_match_result: {
        Args: { p_lobby_id: string; p_players: Json; p_screenshot_path: string }
        Returns: string
      }
      touch_presence: { Args: never; Returns: boolean }
      update_profile_media: {
        Args: { p_avatar_url?: string; p_banner_url?: string }
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
} as const
