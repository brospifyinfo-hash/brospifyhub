// =============================================
// BROSPIFY HUB - VOLLSTÄNDIGE TYPE DEFINITIONEN
// =============================================

// Basis-Enums
export type UserRole = "admin" | "user";
export type SystemRole = "owner" | "admin" | "moderator" | "support" | "vip" | "member" | "guest";
export type ChannelType = "support" | "winning_product" | "standard" | "success_stories";
export type PurchaseType = "initial" | "upsell";
export type PermissionCategory = "system" | "channels" | "messages" | "support" | "moderation" | "content";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type OnlineStatus = "online" | "away" | "dnd" | "offline" | "invisible";
export type NoteType = "info" | "warning" | "positive" | "negative";
export type WarningType = "warning" | "mute" | "ban" | "note";
export type ProfileVisibility = "public" | "members" | "private";
export type Gender = "male" | "female" | "other" | "prefer_not_to_say";

// Channel Settings Interfaces
export interface ChannelSettings {
  posting_enabled: boolean;
}

export interface WinningProductSettings extends ChannelSettings {
  product_id: string;
  description: string;
  pdf_url?: string;
  initial_price: number;
  initial_checkout_url: string;
  upsell_price: number;
  upsell_checkout_url: string;
}

// JSON Type für Supabase
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// =============================================
// DATABASE SCHEMA TYPES
// =============================================
export type Database = {
  public: {
    Tables: {
      // Core User Table
      users: {
        Row: {
          id: string;
          user_number: number | null;
          role: UserRole;
          license_key: string | null;
          display_name: string | null;
          credits: number;
          created_at: string;
          last_activity: string | null;
          is_banned: boolean;
          primary_role_id: string | null;
          badge_text: string | null;
          badge_color: string | null;
          reputation_score: number;
          total_warnings: number;
          muted_until: string | null;
          ban_reason: string | null;
          banned_by: string | null;
          banned_at: string | null;
          verified_at: string | null;
          is_verified: boolean;
          profile_views: number;
          last_seen_at: string | null;
          online_status: OnlineStatus;
        };
        Insert: {
          id: string;
          user_number?: number | null;
          role?: UserRole;
          license_key?: string | null;
          display_name?: string | null;
          credits?: number;
          created_at?: string;
          last_activity?: string | null;
          is_banned?: boolean;
          primary_role_id?: string | null;
          badge_text?: string | null;
          badge_color?: string | null;
          reputation_score?: number;
          total_warnings?: number;
          muted_until?: string | null;
          ban_reason?: string | null;
          banned_by?: string | null;
          banned_at?: string | null;
          verified_at?: string | null;
          is_verified?: boolean;
          profile_views?: number;
          last_seen_at?: string | null;
          online_status?: OnlineStatus;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };

      // Channels
      channels: {
        Row: {
          id: string;
          name: string;
          type: ChannelType;
          settings: Json;
          created_at: string;
          description: string | null;
          show_history_from: string | null;
          rate_limit_seconds: number;
          requires_approval: boolean;
          is_visible: boolean;
          allow_user_text: boolean;
          allow_user_images: boolean;
          allow_user_files: boolean;
          show_download_button: boolean;
          show_copy_button: boolean;
          category_id: string | null;
          order_index: number;
        };
        Insert: {
          id?: string;
          name: string;
          type: ChannelType;
          settings?: Json;
          created_at?: string;
          description?: string | null;
          show_history_from?: string | null;
          rate_limit_seconds?: number;
          requires_approval?: boolean;
          is_visible?: boolean;
          allow_user_text?: boolean;
          allow_user_images?: boolean;
          allow_user_files?: boolean;
          show_download_button?: boolean;
          show_copy_button?: boolean;
          category_id?: string | null;
          order_index?: number;
        };
        Update: Partial<Database["public"]["Tables"]["channels"]["Insert"]>;
        Relationships: [];
      };

      // Messages
      messages: {
        Row: {
          id: string;
          channel_id: string;
          user_id: string;
          content: string;
          created_at: string;
          is_approved: boolean;
          approved_by: string | null;
          approved_at: string | null;
          cta_button_text: string | null;
          cta_button_url: string | null;
          attachment_url: string | null;
          attachment_type: string | null;
          image_bg_color: string | null;
        };
        Insert: {
          id?: string;
          channel_id: string;
          user_id: string;
          content: string;
          created_at?: string;
          is_approved?: boolean;
          approved_by?: string | null;
          approved_at?: string | null;
          cta_button_text?: string | null;
          cta_button_url?: string | null;
          attachment_url?: string | null;
          attachment_type?: string | null;
          image_bg_color?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [];
      };

      // Roles System
      roles: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          description: string | null;
          color: string;
          icon: string;
          hierarchy_level: number;
          is_system: boolean;
          is_assignable: boolean;
          can_send_messages?: boolean;
          can_send_images?: boolean;
          can_send_files?: boolean;
          can_create_channels?: boolean;
          can_moderate?: boolean;
          can_manage_users?: boolean;
          can_access_admin?: boolean;
          permissions_summary: string | null;
          max_file_size_mb: number;
          daily_message_limit: number | null;
          can_use_custom_emojis: boolean;
          can_mention_everyone: boolean;
          priority_support: boolean;
          custom_badge_text: string | null;
          custom_badge_color: string | null;
          can_use_slash_commands: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          description?: string | null;
          color?: string;
          icon?: string;
          hierarchy_level?: number;
          is_system?: boolean;
          is_assignable?: boolean;
          can_send_messages?: boolean;
          can_send_images?: boolean;
          can_send_files?: boolean;
          can_create_channels?: boolean;
          can_moderate?: boolean;
          can_manage_users?: boolean;
          can_access_admin?: boolean;
          permissions_summary?: string | null;
          max_file_size_mb?: number;
          daily_message_limit?: number | null;
          can_use_custom_emojis?: boolean;
          can_mention_everyone?: boolean;
          priority_support?: boolean;
          custom_badge_text?: string | null;
          custom_badge_color?: string | null;
          can_use_slash_commands?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["roles"]["Insert"]>;
        Relationships: [];
      };

      // Permissions
      permissions: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          description: string | null;
          category: PermissionCategory;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          description?: string | null;
          category?: PermissionCategory;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["permissions"]["Insert"]>;
        Relationships: [];
      };

      // Role-Permission Junction
      role_permissions: {
        Row: {
          id: string;
          role_id: string;
          permission_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          role_id: string;
          permission_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["role_permissions"]["Insert"]>;
        Relationships: [];
      };

      // User-Role Junction
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role_id: string;
          assigned_by: string | null;
          assigned_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          role_id: string;
          assigned_by?: string | null;
          assigned_at?: string;
          expires_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
        Relationships: [];
      };

      // Channel-Role Permissions
      channel_role_permissions: {
        Row: {
          id: string;
          channel_id: string;
          role_id: string;
          can_view: boolean;
          can_send_messages: boolean;
          can_send_images: boolean;
          can_send_files: boolean;
          can_delete_messages: boolean;
          can_pin_messages: boolean;
          can_manage_channel: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          channel_id: string;
          role_id: string;
          can_view?: boolean;
          can_send_messages?: boolean;
          can_send_images?: boolean;
          can_send_files?: boolean;
          can_delete_messages?: boolean;
          can_pin_messages?: boolean;
          can_manage_channel?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["channel_role_permissions"]["Insert"]>;
        Relationships: [];
      };

      // Extended User Profiles
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          avatar_url: string | null;
          banner_url: string | null;
          bio: string | null;
          website: string | null;
          location: string | null;
          birthday: string | null;
          gender: Gender | null;
          pronouns: string | null;
          timezone: string;
          about_me: string | null;
          interests: string[] | null;
          skills: string[] | null;
          // Social Links
          social_twitter: string | null;
          social_instagram: string | null;
          social_youtube: string | null;
          social_tiktok: string | null;
          social_discord: string | null;
          social_linkedin: string | null;
          social_github: string | null;
          social_website: string | null;
          // Notification Settings
          notification_email: boolean;
          notification_push: boolean;
          notification_sound: boolean;
          notification_mentions: boolean;
          notification_replies: boolean;
          notification_new_content: boolean;
          // Privacy Settings
          privacy_show_online: boolean;
          privacy_show_activity: boolean;
          privacy_allow_dms: boolean;
          privacy_profile_visibility: ProfileVisibility;
          show_birthday: boolean;
          show_email: boolean;
          show_location: boolean;
          // Customization
          theme_preference: string;
          language: string;
          accent_color: string;
          profile_effect: string | null;
          custom_status: string | null;
          custom_status_emoji: string | null;
          featured_achievement_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          avatar_url?: string | null;
          banner_url?: string | null;
          bio?: string | null;
          website?: string | null;
          location?: string | null;
          birthday?: string | null;
          gender?: Gender | null;
          pronouns?: string | null;
          timezone?: string;
          about_me?: string | null;
          interests?: string[] | null;
          skills?: string[] | null;
          social_twitter?: string | null;
          social_instagram?: string | null;
          social_youtube?: string | null;
          social_tiktok?: string | null;
          social_discord?: string | null;
          social_linkedin?: string | null;
          social_github?: string | null;
          social_website?: string | null;
          notification_email?: boolean;
          notification_push?: boolean;
          notification_sound?: boolean;
          notification_mentions?: boolean;
          notification_replies?: boolean;
          notification_new_content?: boolean;
          privacy_show_online?: boolean;
          privacy_show_activity?: boolean;
          privacy_allow_dms?: boolean;
          privacy_profile_visibility?: ProfileVisibility;
          show_birthday?: boolean;
          show_email?: boolean;
          show_location?: boolean;
          theme_preference?: string;
          language?: string;
          accent_color?: string;
          profile_effect?: string | null;
          custom_status?: string | null;
          custom_status_emoji?: string | null;
          featured_achievement_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_profiles"]["Insert"]>;
        Relationships: [];
      };

      // User Stats (Gamification)
      user_stats: {
        Row: {
          id: string;
          user_id: string;
          total_messages: number;
          total_reactions_given: number;
          total_reactions_received: number;
          total_files_uploaded: number;
          total_login_days: number;
          current_streak: number;
          longest_streak: number;
          last_active_date: string | null;
          level: number;
          experience_points: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          total_messages?: number;
          total_reactions_given?: number;
          total_reactions_received?: number;
          total_files_uploaded?: number;
          total_login_days?: number;
          current_streak?: number;
          longest_streak?: number;
          last_active_date?: string | null;
          level?: number;
          experience_points?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_stats"]["Insert"]>;
        Relationships: [];
      };

      // Achievements
      achievements: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          description: string | null;
          icon: string;
          color: string;
          category: string;
          points: number;
          is_secret: boolean;
          requirements: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          description?: string | null;
          icon?: string;
          color?: string;
          category?: string;
          points?: number;
          is_secret?: boolean;
          requirements?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["achievements"]["Insert"]>;
        Relationships: [];
      };

      // User Achievements Junction
      user_achievements: {
        Row: {
          id: string;
          user_id: string;
          achievement_id: string;
          earned_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          achievement_id: string;
          earned_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_achievements"]["Insert"]>;
        Relationships: [];
      };

      // User Presence (Online Status)
      user_presence: {
        Row: {
          id: string;
          user_id: string;
          status: OnlineStatus;
          custom_status: string | null;
          last_heartbeat: string;
          current_channel_id: string | null;
          is_typing: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: OnlineStatus;
          custom_status?: string | null;
          last_heartbeat?: string;
          current_channel_id?: string | null;
          is_typing?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_presence"]["Insert"]>;
        Relationships: [];
      };

      // Activity Log (Audit Trail)
      activity_log: {
        Row: {
          id: string;
          user_id: string | null;
          action_type: string;
          action_category: string;
          target_type: string | null;
          target_id: string | null;
          details: Json;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action_type: string;
          action_category?: string;
          target_type?: string | null;
          target_id?: string | null;
          details?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["activity_log"]["Insert"]>;
        Relationships: [];
      };

      // User Notes (Admin Private Notes)
      user_notes: {
        Row: {
          id: string;
          user_id: string;
          author_id: string;
          content: string;
          note_type: NoteType;
          is_important: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          author_id: string;
          content: string;
          note_type?: NoteType;
          is_important?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_notes"]["Insert"]>;
        Relationships: [];
      };

      // User Warnings
      user_warnings: {
        Row: {
          id: string;
          user_id: string;
          issued_by: string;
          warning_type: WarningType;
          reason: string;
          expires_at: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          issued_by: string;
          warning_type?: WarningType;
          reason: string;
          expires_at?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_warnings"]["Insert"]>;
        Relationships: [];
      };

      // Channel Stats
      channel_stats: {
        Row: {
          id: string;
          channel_id: string;
          total_messages: number;
          total_members: number;
          active_today: number;
          active_week: number;
          last_message_at: string | null;
          peak_concurrent_users: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          channel_id: string;
          total_messages?: number;
          total_members?: number;
          active_today?: number;
          active_week?: number;
          last_message_at?: string | null;
          peak_concurrent_users?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["channel_stats"]["Insert"]>;
        Relationships: [];
      };

      // Existing Tables (behalten wie zuvor)
      user_favorites: {
        Row: { id: string; user_id: string; message_id: string; created_at: string; };
        Insert: { id?: string; user_id: string; message_id: string; created_at?: string; };
        Update: { id?: string; user_id?: string; message_id?: string; created_at?: string; };
        Relationships: [];
      };
      user_purchases: {
        Row: { id: string; user_id: string; product_id: string; purchase_type: PurchaseType; shopify_order_id: string | null; amount_paid: number | null; purchased_at: string; };
        Insert: { id?: string; user_id: string; product_id: string; purchase_type: PurchaseType; shopify_order_id?: string | null; amount_paid?: number | null; purchased_at?: string; };
        Update: { id?: string; user_id?: string; product_id?: string; purchase_type?: PurchaseType; shopify_order_id?: string | null; amount_paid?: number | null; purchased_at?: string; };
        Relationships: [];
      };
      user_channel_permissions: {
        Row: { id: string; user_id: string; channel_id: string; can_view: boolean; can_write: boolean; can_upload_images: boolean; can_upload_files: boolean; granted_at: string; granted_by: string | null; };
        Insert: { id?: string; user_id: string; channel_id: string; can_view?: boolean; can_write?: boolean; can_upload_images?: boolean; can_upload_files?: boolean; granted_at?: string; granted_by?: string | null; };
        Update: { id?: string; user_id?: string; channel_id?: string; can_view?: boolean; can_write?: boolean; can_upload_images?: boolean; can_upload_files?: boolean; granted_at?: string; granted_by?: string | null; };
        Relationships: [];
      };
      scheduled_posts: {
        Row: { id: string; channel_id: string; user_id: string; content: string; attachment_url: string | null; scheduled_for: string; posted_at: string | null; is_posted: boolean; created_at: string; };
        Insert: { id?: string; channel_id: string; user_id: string; content: string; attachment_url?: string | null; scheduled_for: string; posted_at?: string | null; is_posted?: boolean; created_at?: string; };
        Update: { id?: string; channel_id?: string; user_id?: string; content?: string; attachment_url?: string | null; scheduled_for?: string; posted_at?: string | null; is_posted?: boolean; created_at?: string; };
        Relationships: [];
      };
      custom_emojis: {
        Row: { id: string; name: string; image_url: string; uploaded_by: string | null; created_at: string; };
        Insert: { id?: string; name: string; image_url: string; uploaded_by?: string | null; created_at?: string; };
        Update: { id?: string; name?: string; image_url?: string; uploaded_by?: string | null; created_at?: string; };
        Relationships: [];
      };
      quick_replies: {
        Row: { id: string; title: string; content: string; category: string; created_by: string | null; created_at: string; };
        Insert: { id?: string; title: string; content: string; category?: string; created_by?: string | null; created_at?: string; };
        Update: { id?: string; title?: string; content?: string; category?: string; created_by?: string | null; created_at?: string; };
        Relationships: [];
      };
      tutorial_steps: {
        Row: { id: string; title: string; description: string; target_element: string | null; position: string; order_index: number; is_active: boolean; created_at: string; };
        Insert: { id?: string; title: string; description: string; target_element?: string | null; position?: string; order_index: number; is_active?: boolean; created_at?: string; };
        Update: { id?: string; title?: string; description?: string; target_element?: string | null; position?: string; order_index?: number; is_active?: boolean; created_at?: string; };
        Relationships: [];
      };
      user_tutorial_progress: {
        Row: { id: string; user_id: string; completed_steps: string[]; is_completed: boolean; completed_at: string | null; };
        Insert: { id?: string; user_id: string; completed_steps?: string[]; is_completed?: boolean; completed_at?: string | null; };
        Update: { id?: string; user_id?: string; completed_steps?: string[]; is_completed?: boolean; completed_at?: string | null; };
        Relationships: [];
      };
      internal_keys: {
        Row: { id: string; key_value: string; is_assigned: boolean; assigned_to: string | null; assigned_at: string | null; created_at: string; is_active: boolean; };
        Insert: { id?: string; key_value: string; is_assigned?: boolean; assigned_to?: string | null; assigned_at?: string | null; created_at?: string; is_active?: boolean; };
        Update: { id?: string; key_value?: string; is_assigned?: boolean; assigned_to?: string | null; assigned_at?: string | null; created_at?: string; is_active?: boolean; };
        Relationships: [];
      };
      support_conversations: {
        Row: { id: string; user_id: string; created_at: string; last_message_at: string; is_resolved: boolean; };
        Insert: { id?: string; user_id: string; created_at?: string; last_message_at?: string; is_resolved?: boolean; };
        Update: { id?: string; user_id?: string; created_at?: string; last_message_at?: string; is_resolved?: boolean; };
        Relationships: [];
      };
      support_messages: {
        Row: { id: string; conversation_id: string; sender_id: string; content: string; created_at: string; };
        Insert: { id?: string; conversation_id: string; sender_id: string; content: string; created_at?: string; };
        Update: { id?: string; conversation_id?: string; sender_id?: string; content?: string; created_at?: string; };
        Relationships: [];
      };
      support_helpers: {
        Row: { id: string; user_id: string; added_by: string | null; created_at: string; };
        Insert: { id?: string; user_id: string; added_by?: string | null; created_at?: string; };
        Update: { id?: string; user_id?: string; added_by?: string | null; created_at?: string; };
        Relationships: [];
      };
      app_settings: {
        Row: { id: string; key: string; value: string | null; created_at: string; updated_at: string; };
        Insert: { id?: string; key: string; value?: string | null; created_at?: string; updated_at?: string; };
        Update: { id?: string; key?: string; value?: string | null; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      tickets: {
        Row: {
          id: string;
          ticket_number: number;
          user_id: string;
          subject: string;
          status: TicketStatus;
          priority: TicketPriority;
          category_id: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
          closed_at: string | null;
          closed_by: string | null;
        };
        Insert: {
          id?: string;
          ticket_number?: number;
          user_id: string;
          subject: string;
          status?: TicketStatus;
          priority?: TicketPriority;
          category_id?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
          closed_at?: string | null;
          closed_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["tickets"]["Insert"]>;
        Relationships: [];
      };
      ticket_messages: {
        Row: { id: string; ticket_id: string; sender_id: string; content: string; created_at: string; is_internal: boolean; };
        Insert: { id?: string; ticket_id: string; sender_id: string; content: string; created_at?: string; is_internal?: boolean; };
        Update: { id?: string; ticket_id?: string; sender_id?: string; content?: string; created_at?: string; is_internal?: boolean; };
        Relationships: [];
      };
      ticket_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          color: string;
          icon: string;
          order_index: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          color?: string;
          icon?: string;
          order_index?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ticket_categories"]["Insert"]>;
        Relationships: [];
      };
      slash_commands: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          trigger: string;
          action_type: "url" | "route" | "text" | "modal";
          action_value: Json;
          icon: string;
          category: string | null;
          is_active: boolean;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          trigger: string;
          action_type: "url" | "route" | "text" | "modal";
          action_value?: Json;
          icon?: string;
          category?: string | null;
          is_active?: boolean;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["slash_commands"]["Insert"]>;
        Relationships: [];
      };
      slash_command_roles: {
        Row: {
          id: string;
          command_id: string;
          role_id: string;
        };
        Insert: {
          id?: string;
          command_id: string;
          role_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["slash_command_roles"]["Insert"]>;
        Relationships: [];
      };
      channel_categories: {
        Row: { id: string; name: string; description: string | null; order_index: number; is_collapsed: boolean; created_at: string; };
        Insert: { id?: string; name: string; description?: string | null; order_index?: number; is_collapsed?: boolean; created_at?: string; };
        Update: { id?: string; name?: string; description?: string | null; order_index?: number; is_collapsed?: boolean; created_at?: string; };
        Relationships: [];
      };
      user_devices: {
        Row: { id: string; user_id: string; license_key: string; device_fingerprint: string; device_name: string | null; ip_address: string | null; city: string | null; country: string | null; user_agent: string | null; last_active: string; created_at: string; is_blocked: boolean; };
        Insert: { id?: string; user_id: string; license_key: string; device_fingerprint: string; device_name?: string | null; ip_address?: string | null; city?: string | null; country?: string | null; user_agent?: string | null; last_active?: string; created_at?: string; is_blocked?: boolean; };
        Update: { id?: string; user_id?: string; license_key?: string; device_fingerprint?: string; device_name?: string | null; ip_address?: string | null; city?: string | null; country?: string | null; user_agent?: string | null; last_active?: string; created_at?: string; is_blocked?: boolean; };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      user_has_permission: {
        Args: { user_uuid: string; permission_name: string };
        Returns: boolean;
      };
      get_user_highest_role: {
        Args: { user_uuid: string };
        Returns: { role_name: string; hierarchy_level: number; color: string; icon: string }[];
      };
      get_user_permissions: {
        Args: { user_uuid: string };
        Returns: { permission_name: string; category: string }[];
      };
      user_can_in_channel: {
        Args: { user_uuid: string; channel_uuid: string; permission_type: string };
        Returns: boolean;
      };
      log_activity: {
        Args: { p_user_id: string; p_action_type: string; p_action_category?: string; p_target_type?: string; p_target_id?: string; p_details?: Json };
        Returns: string;
      };
      update_user_stats: {
        Args: { p_user_id: string; p_stat_type: string; p_increment?: number };
        Returns: void;
      };
      check_achievements: {
        Args: { p_user_id: string };
        Returns: string[];
      };
      update_presence: {
        Args: { p_user_id: string; p_status?: string };
        Returns: void;
      };
      get_user_full_profile: {
        Args: { p_user_id: string };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// =============================================
// EXPORTED TYPE ALIASES
// =============================================
export type User = Database["public"]["Tables"]["users"]["Row"];
export type Channel = Database["public"]["Tables"]["channels"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type Role = Database["public"]["Tables"]["roles"]["Row"];
export type Permission = Database["public"]["Tables"]["permissions"]["Row"];
export type RolePermission = Database["public"]["Tables"]["role_permissions"]["Row"];
export type UserRoleAssignment = Database["public"]["Tables"]["user_roles"]["Row"];
export type ChannelRolePermission = Database["public"]["Tables"]["channel_role_permissions"]["Row"];
export type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];
export type UserStats = Database["public"]["Tables"]["user_stats"]["Row"];
export type Achievement = Database["public"]["Tables"]["achievements"]["Row"];
export type UserAchievement = Database["public"]["Tables"]["user_achievements"]["Row"];
export type UserPresence = Database["public"]["Tables"]["user_presence"]["Row"];
export type ActivityLog = Database["public"]["Tables"]["activity_log"]["Row"];
export type UserNote = Database["public"]["Tables"]["user_notes"]["Row"];
export type UserWarning = Database["public"]["Tables"]["user_warnings"]["Row"];
export type ChannelStats = Database["public"]["Tables"]["channel_stats"]["Row"];
export type UserPurchase = Database["public"]["Tables"]["user_purchases"]["Row"];
export type UserChannelPermission = Database["public"]["Tables"]["user_channel_permissions"]["Row"];
export type ScheduledPost = Database["public"]["Tables"]["scheduled_posts"]["Row"];
export type CustomEmoji = Database["public"]["Tables"]["custom_emojis"]["Row"];
export type QuickReply = Database["public"]["Tables"]["quick_replies"]["Row"];
export type TutorialStep = Database["public"]["Tables"]["tutorial_steps"]["Row"];
export type UserTutorialProgress = Database["public"]["Tables"]["user_tutorial_progress"]["Row"];
export type InternalKey = Database["public"]["Tables"]["internal_keys"]["Row"];
export type SupportConversation = Database["public"]["Tables"]["support_conversations"]["Row"];
export type SupportMessage = Database["public"]["Tables"]["support_messages"]["Row"];
export type SupportHelper = Database["public"]["Tables"]["support_helpers"]["Row"];
export type AppSetting = Database["public"]["Tables"]["app_settings"]["Row"];
export type Ticket = Database["public"]["Tables"]["tickets"]["Row"];
export type TicketMessage = Database["public"]["Tables"]["ticket_messages"]["Row"];
export type TicketCategory = Database["public"]["Tables"]["ticket_categories"]["Row"];
export type SlashCommand = Database["public"]["Tables"]["slash_commands"]["Row"];
export type SlashCommandRole = Database["public"]["Tables"]["slash_command_roles"]["Row"];
export type ChannelCategory = Database["public"]["Tables"]["channel_categories"]["Row"];
export type UserDevice = Database["public"]["Tables"]["user_devices"]["Row"];
export type UserFavorite = Database["public"]["Tables"]["user_favorites"]["Row"];

// =============================================
// EXTENDED INTERFACES (für Joins)
// =============================================
export interface RoleWithPermissions extends Role {
  permissions: Permission[];
  permissionNames: string[];
}

export interface UserWithRoles extends User {
  roles: Role[];
  highestRole: Role | null;
  profile: UserProfile | null;
  stats: UserStats | null;
  achievements: Achievement[];
  presence: UserPresence | null;
}

export interface UserWithFullData extends UserWithRoles {
  notes: UserNote[];
  warnings: UserWarning[];
  devices: UserDevice[];
}

export interface ChannelWithPermissions extends Channel {
  rolePermissions: ChannelRolePermission[];
  stats: ChannelStats | null;
  category: ChannelCategory | null;
}

export interface MessageWithUser extends Message {
  user: User | null;
  userProfile: UserProfile | null;
  userHighestRole: Role | null;
}

export interface TicketWithUser extends Ticket {
  user: User | null;
  messages: TicketMessage[];
}

export interface AchievementWithProgress extends Achievement {
  earned: boolean;
  earnedAt: string | null;
  progress: number;
}

// =============================================
// UI HELPER TYPES
// =============================================
export interface PermissionGroup {
  category: PermissionCategory;
  displayName: string;
  permissions: Permission[];
}

export interface RoleFormData {
  name: string;
  display_name: string;
  description: string;
  color: string;
  icon: string;
  hierarchy_level: number;
  is_assignable: boolean;
  permissions: string[];
  max_file_size_mb: number;
  daily_message_limit: number | null;
  can_use_custom_emojis: boolean;
  can_mention_everyone: boolean;
  priority_support: boolean;
  custom_badge_text: string | null;
  custom_badge_color: string | null;
}

export interface ProfileFormData {
  display_name: string;
  bio: string;
  about_me: string;
  location: string;
  website: string;
  birthday: string | null;
  gender: Gender | null;
  pronouns: string;
  timezone: string;
  interests: string[];
  skills: string[];
  social_twitter: string;
  social_instagram: string;
  social_youtube: string;
  social_tiktok: string;
  social_discord: string;
  social_linkedin: string;
  social_github: string;
  accent_color: string;
  custom_status: string;
  custom_status_emoji: string;
}

export interface NotificationSettings {
  notification_email: boolean;
  notification_push: boolean;
  notification_sound: boolean;
  notification_mentions: boolean;
  notification_replies: boolean;
  notification_new_content: boolean;
}

export interface PrivacySettings {
  privacy_show_online: boolean;
  privacy_show_activity: boolean;
  privacy_allow_dms: boolean;
  privacy_profile_visibility: ProfileVisibility;
  show_birthday: boolean;
  show_email: boolean;
  show_location: boolean;
}

// =============================================
// CONSTANTS
// =============================================
export const ROLE_COLORS: Record<SystemRole, string> = {
  owner: "#FFD700",
  admin: "#FF4444",
  moderator: "#9B59B6",
  support: "#3498DB",
  vip: "#F39C12",
  member: "#95BF47",
  guest: "#808080",
};

export const ROLE_ICONS: Record<SystemRole, string> = {
  owner: "crown",
  admin: "shield",
  moderator: "shield-check",
  support: "headphones",
  vip: "star",
  member: "user",
  guest: "eye",
};

export const PERMISSION_CATEGORY_LABELS: Record<PermissionCategory, string> = {
  system: "System",
  channels: "Channels",
  messages: "Nachrichten",
  support: "Support",
  moderation: "Moderation",
  content: "Inhalte",
};

export const ONLINE_STATUS_COLORS: Record<OnlineStatus, string> = {
  online: "#22C55E",
  away: "#F59E0B",
  dnd: "#EF4444",
  offline: "#6B7280",
  invisible: "#6B7280",
};

export const ONLINE_STATUS_LABELS: Record<OnlineStatus, string> = {
  online: "Online",
  away: "Abwesend",
  dnd: "Nicht stören",
  offline: "Offline",
  invisible: "Unsichtbar",
};

// =============================================
// PRODUCT SYSTEM TYPES
// =============================================
export type PaymentMethodType = "external_link" | "credits" | "stripe" | "paypal";
export type PurchaseStatus = "pending" | "completed" | "refunded" | "cancelled";
export type ProductContentType = "download" | "video" | "link" | "text" | "embed";

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  image_url: string | null;
  video_url: string | null;
  pdf_url: string | null;
  badge_text: string | null;
  badge_color: string;
  is_active: boolean;
  is_featured: boolean;
  order_index: number;
  show_in_menu: boolean;
  show_variant_selector: boolean;
  show_price_comparison: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  image_url: string | null;
  is_active: boolean;
  order_index: number;
  created_at: string;
}

export interface ProductPriceTier {
  id: string;
  product_id: string;
  tier_name: string;
  tier_order: number;
  price_amount: number;
  price_currency: string;
  compare_price: number | null;
  credits_price: number | null;
  allow_credits: boolean;
  button_text: string;
  button_color: string;
  button_icon: string;
  requires_previous_tier: boolean;
  previous_tier_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface VariantPriceLink {
  id: string;
  variant_id: string;
  price_tier_id: string;
  checkout_url: string;
  is_active: boolean;
  click_count: number;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  icon: string;
  color: string;
  method_type: PaymentMethodType;
  config: Record<string, any>;
  is_active: boolean;
  order_index: number;
  created_at: string;
}

export interface ProductPaymentMethod {
  id: string;
  product_id: string;
  payment_method_id: string;
  is_active: boolean;
}

export interface ProductContent {
  id: string;
  product_id: string;
  variant_id: string | null;
  price_tier_id: string | null;
  title: string;
  description: string | null;
  content_type: ProductContentType;
  content_url: string | null;
  content_data: Record<string, any>;
  requires_purchase: boolean;
  min_tier_order: number;
  icon: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
}

// Extended Product interfaces
export interface ProductWithDetails extends Product {
  variants: ProductVariant[];
  priceTiers: ProductPriceTier[];
  paymentMethods: PaymentMethod[];
  content: ProductContent[];
}

export interface ProductVariantWithLinks extends ProductVariant {
  links: VariantPriceLink[];
}

export interface UserProductPurchase {
  id: string;
  user_id: string;
  product_id: string;
  variant_id: string | null;
  price_tier_id: string | null;
  payment_method: string | null;
  credits_used: number;
  purchase_type: PurchaseType;
  status: PurchaseStatus;
  amount_paid: number | null;
  shopify_order_id: string | null;
  transaction_id: string | null;
  metadata: Record<string, any>;
  purchased_at: string;
}

export interface UserProductAccess {
  product: Product;
  variant: ProductVariant | null;
  highestTier: ProductPriceTier | null;
  purchases: UserProductPurchase[];
  hasAccess: boolean;
  canUpgrade: boolean;
  nextTier: ProductPriceTier | null;
}
