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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_insights: {
        Row: {
          created_at: string
          description: string
          id: string
          insight_type: string
          monthly_data_id: string | null
          organization_id: string
          severity: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          insight_type: string
          monthly_data_id?: string | null
          organization_id: string
          severity?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          insight_type?: string
          monthly_data_id?: string | null
          organization_id?: string
          severity?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_monthly_data_id_fkey"
            columns: ["monthly_data_id"]
            isOneToOne: false
            referencedRelation: "monthly_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_run_lists: {
        Row: {
          auction_date: string | null
          auction_name: string | null
          auction_source: string | null
          created_at: string
          created_by: string | null
          file_name: string
          file_path: string | null
          id: string
          organization_id: string
          parse_error: string | null
          parse_status: string | null
          status: string
        }
        Insert: {
          auction_date?: string | null
          auction_name?: string | null
          auction_source?: string | null
          created_at?: string
          created_by?: string | null
          file_name: string
          file_path?: string | null
          id?: string
          organization_id: string
          parse_error?: string | null
          parse_status?: string | null
          status?: string
        }
        Update: {
          auction_date?: string | null
          auction_name?: string | null
          auction_source?: string | null
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_path?: string | null
          id?: string
          organization_id?: string
          parse_error?: string | null
          parse_status?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_run_lists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_vehicles: {
        Row: {
          ai_recommendation: string | null
          ai_insight: string | null
          ai_summary: string | null
          body_condition: string | null
          brand_match: boolean | null
          buy_now: number | null
          condition_notes: string | null
          cr_score: number | null
          created_at: string
          current_bid: number | null
          damage_location: string | null
          damage_type: string | null
          data_confidence_score: number | null
          dealer_demand_score: number | null
          drive_condition: string | null
          enrichment_sources: string[] | null
          estimated_auction_fee: number | null
          estimated_profit: number | null
          estimated_recon_cost: number | null
          estimated_retail_value: number | null
          estimated_transport_cost: number | null
          has_cr: boolean | null
          id: string
          key_status: string | null
          lane: string | null
          make: string | null
          market_avg_mileage: number | null
          market_avg_price: number | null
          market_comp_count: number | null
          market_day_supply: number | null
          avg_days_to_sell: number | null
          dom_sample_count: number | null
          mileage: number | null
          mmr_value: number | null
          model: string | null
          model_match: boolean | null
          organization_id: string
          price_estimate: number | null
          profit_score: number | null
          recommendation_reason: string | null
          recommended_max_bid: number | null
          recon_age_adj: number | null
          recon_base: number | null
          recon_brand_adj: number | null
          recon_cr_adj: number | null
          recon_damage_adj: number | null
          recon_mileage_adj: number | null
          recon_override: number | null
          recon_risk_adj: number | null
          recon_type_adj: number | null
          retail_base_market_value: number | null
          retail_cr_adjustment: number | null
          retail_data_source: string | null
          retail_dealer_margin: number | null
          retail_market_position: string | null
          retail_mileage_adjustment: number | null
          risk_flags: string[] | null
          run_list_id: string
          run_order: number | null
          scoring_reasons: string[] | null
          seller_type: string | null
          title_status: string | null
          total_estimated_cost: number | null
          trim: string | null
          vehicle_type: string | null
          vin: string | null
          vin_decoded: boolean | null
          year: number | null
        }
        Insert: {
          ai_insight?: string | null
          ai_recommendation?: string | null
          ai_summary?: string | null
          body_condition?: string | null
          brand_match?: boolean | null
          buy_now?: number | null
          condition_notes?: string | null
          cr_score?: number | null
          created_at?: string
          current_bid?: number | null
          damage_location?: string | null
          damage_type?: string | null
          data_confidence_score?: number | null
          dealer_demand_score?: number | null
          drive_condition?: string | null
          enrichment_sources?: string[] | null
          estimated_auction_fee?: number | null
          estimated_profit?: number | null
          estimated_recon_cost?: number | null
          estimated_retail_value?: number | null
          estimated_transport_cost?: number | null
          has_cr?: boolean | null
          id?: string
          key_status?: string | null
          lane?: string | null
          make?: string | null
          mileage?: number | null
          mmr_value?: number | null
          model?: string | null
          model_match?: boolean | null
          organization_id: string
          price_estimate?: number | null
          profit_score?: number | null
          recommendation_reason?: string | null
          recommended_max_bid?: number | null
          recon_age_adj?: number | null
          recon_base?: number | null
          recon_brand_adj?: number | null
          recon_cr_adj?: number | null
          recon_damage_adj?: number | null
          recon_mileage_adj?: number | null
          recon_override?: number | null
          recon_risk_adj?: number | null
          recon_type_adj?: number | null
          retail_base_market_value?: number | null
          retail_cr_adjustment?: number | null
          retail_data_source?: string | null
          retail_dealer_margin?: number | null
          retail_market_position?: string | null
          retail_mileage_adjustment?: number | null
          risk_flags?: string[] | null
          run_list_id: string
          run_order?: number | null
          scoring_reasons?: string[] | null
          seller_type?: string | null
          title_status?: string | null
          total_estimated_cost?: number | null
          trim?: string | null
          vehicle_type?: string | null
          vin?: string | null
          vin_decoded?: boolean | null
          year?: number | null
        }
        Update: {
          ai_insight?: string | null
          ai_recommendation?: string | null
          ai_summary?: string | null
          body_condition?: string | null
          brand_match?: boolean | null
          buy_now?: number | null
          condition_notes?: string | null
          cr_score?: number | null
          created_at?: string
          current_bid?: number | null
          damage_location?: string | null
          damage_type?: string | null
          data_confidence_score?: number | null
          dealer_demand_score?: number | null
          drive_condition?: string | null
          enrichment_sources?: string[] | null
          estimated_auction_fee?: number | null
          estimated_profit?: number | null
          estimated_recon_cost?: number | null
          estimated_retail_value?: number | null
          estimated_transport_cost?: number | null
          has_cr?: boolean | null
          id?: string
          key_status?: string | null
          lane?: string | null
          make?: string | null
          mileage?: number | null
          mmr_value?: number | null
          model?: string | null
          model_match?: boolean | null
          organization_id?: string
          price_estimate?: number | null
          profit_score?: number | null
          recommendation_reason?: string | null
          recommended_max_bid?: number | null
          recon_age_adj?: number | null
          recon_base?: number | null
          recon_brand_adj?: number | null
          recon_cr_adj?: number | null
          recon_damage_adj?: number | null
          recon_mileage_adj?: number | null
          recon_override?: number | null
          recon_risk_adj?: number | null
          recon_type_adj?: number | null
          retail_base_market_value?: number | null
          retail_cr_adjustment?: number | null
          retail_data_source?: string | null
          retail_dealer_margin?: number | null
          retail_market_position?: string | null
          retail_mileage_adjustment?: number | null
          risk_flags?: string[] | null
          run_list_id?: string
          run_order?: number | null
          scoring_reasons?: string[] | null
          seller_type?: string | null
          title_status?: string | null
          total_estimated_cost?: number | null
          trim?: string | null
          vehicle_type?: string | null
          vin?: string | null
          vin_decoded?: boolean | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auction_vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_vehicles_run_list_id_fkey"
            columns: ["run_list_id"]
            isOneToOne: false
            referencedRelation: "auction_run_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      bidding_map_items: {
        Row: {
          auction_vehicle_id: string
          bidding_map_id: string
          bidding_notes: string | null
          created_at: string
          estimated_time_until_run: string | null
          id: string
          lane: string | null
          outcome: string | null
          passed: boolean | null
          passed_at: string | null
          purchase_price: number | null
          purchased: boolean | null
          purchased_at: string | null
          recommended_bid: number | null
          run_order: number | null
          sort_order: number | null
        }
        Insert: {
          auction_vehicle_id: string
          bidding_map_id: string
          bidding_notes?: string | null
          created_at?: string
          estimated_time_until_run?: string | null
          id?: string
          lane?: string | null
          outcome?: string | null
          passed?: boolean | null
          passed_at?: string | null
          purchase_price?: number | null
          purchased?: boolean | null
          purchased_at?: string | null
          recommended_bid?: number | null
          run_order?: number | null
          sort_order?: number | null
        }
        Update: {
          auction_vehicle_id?: string
          bidding_map_id?: string
          bidding_notes?: string | null
          created_at?: string
          estimated_time_until_run?: string | null
          id?: string
          lane?: string | null
          outcome?: string | null
          passed?: boolean | null
          passed_at?: string | null
          purchase_price?: number | null
          purchased?: boolean | null
          purchased_at?: string | null
          recommended_bid?: number | null
          run_order?: number | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bidding_map_items_auction_vehicle_id_fkey"
            columns: ["auction_vehicle_id"]
            isOneToOne: false
            referencedRelation: "auction_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bidding_map_items_auction_vehicle_id_fkey"
            columns: ["auction_vehicle_id"]
            isOneToOne: false
            referencedRelation: "lane_strategy_view"
            referencedColumns: ["auction_vehicle_id"]
          },
          {
            foreignKeyName: "bidding_map_items_bidding_map_id_fkey"
            columns: ["bidding_map_id"]
            isOneToOne: false
            referencedRelation: "auction_performance_report"
            referencedColumns: ["bidding_map_id"]
          },
          {
            foreignKeyName: "bidding_map_items_bidding_map_id_fkey"
            columns: ["bidding_map_id"]
            isOneToOne: false
            referencedRelation: "bidding_maps"
            referencedColumns: ["id"]
          },
        ]
      }
      bidding_maps: {
        Row: {
          auction_completed_at: string | null
          auction_date: string | null
          auction_started_at: string | null
          auction_status: string | null
          buy_list_id: string
          created_at: string
          created_by: string | null
          current_vehicle_index: number | null
          id: string
          intelligence_status: string
          mode: string
          name: string
          organization_id: string
        }
        Insert: {
          auction_completed_at?: string | null
          auction_date?: string | null
          auction_started_at?: string | null
          auction_status?: string | null
          buy_list_id: string
          created_at?: string
          created_by?: string | null
          current_vehicle_index?: number | null
          id?: string
          intelligence_status?: string
          mode?: string
          name?: string
          organization_id: string
        }
        Update: {
          auction_completed_at?: string | null
          auction_date?: string | null
          auction_started_at?: string | null
          auction_status?: string | null
          buy_list_id?: string
          created_at?: string
          created_by?: string | null
          current_vehicle_index?: number | null
          id?: string
          intelligence_status?: string
          mode?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bidding_maps_buy_list_id_fkey"
            columns: ["buy_list_id"]
            isOneToOne: false
            referencedRelation: "buy_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bidding_maps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      buy_list_generation_logs: {
        Row: {
          created_at: string
          eligible_after_filters: number | null
          excluded_by_brand: number | null
          excluded_by_cr: number | null
          excluded_by_mileage: number | null
          excluded_by_price: number | null
          excluded_by_recon: number | null
          excluded_by_risk: number | null
          excluded_by_tmu: number | null
          excluded_by_vehicle_type: number | null
          excluded_by_year: number | null
          id: string
          organization_id: string
          preferences_snapshot: Json | null
          recommended_saved: number | null
          run_list_id: string
          total_vehicles: number | null
        }
        Insert: {
          created_at?: string
          eligible_after_filters?: number | null
          excluded_by_brand?: number | null
          excluded_by_cr?: number | null
          excluded_by_mileage?: number | null
          excluded_by_price?: number | null
          excluded_by_recon?: number | null
          excluded_by_risk?: number | null
          excluded_by_tmu?: number | null
          excluded_by_vehicle_type?: number | null
          excluded_by_year?: number | null
          id?: string
          organization_id: string
          preferences_snapshot?: Json | null
          recommended_saved?: number | null
          run_list_id: string
          total_vehicles?: number | null
        }
        Update: {
          created_at?: string
          eligible_after_filters?: number | null
          excluded_by_brand?: number | null
          excluded_by_cr?: number | null
          excluded_by_mileage?: number | null
          excluded_by_price?: number | null
          excluded_by_recon?: number | null
          excluded_by_risk?: number | null
          excluded_by_tmu?: number | null
          excluded_by_vehicle_type?: number | null
          excluded_by_year?: number | null
          id?: string
          organization_id?: string
          preferences_snapshot?: Json | null
          recommended_saved?: number | null
          run_list_id?: string
          total_vehicles?: number | null
        }
        Relationships: []
      }
      buy_list_items: {
        Row: {
          auction_vehicle_id: string
          buy_list_id: string
          created_at: string
          custom_max_bid: number | null
          dealer_notes: string | null
          id: string
          selected_for_bidding_map: boolean | null
        }
        Insert: {
          auction_vehicle_id: string
          buy_list_id: string
          created_at?: string
          custom_max_bid?: number | null
          dealer_notes?: string | null
          id?: string
          selected_for_bidding_map?: boolean | null
        }
        Update: {
          auction_vehicle_id?: string
          buy_list_id?: string
          created_at?: string
          custom_max_bid?: number | null
          dealer_notes?: string | null
          id?: string
          selected_for_bidding_map?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "buy_list_items_auction_vehicle_id_fkey"
            columns: ["auction_vehicle_id"]
            isOneToOne: false
            referencedRelation: "auction_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buy_list_items_auction_vehicle_id_fkey"
            columns: ["auction_vehicle_id"]
            isOneToOne: false
            referencedRelation: "lane_strategy_view"
            referencedColumns: ["auction_vehicle_id"]
          },
          {
            foreignKeyName: "buy_list_items_buy_list_id_fkey"
            columns: ["buy_list_id"]
            isOneToOne: false
            referencedRelation: "buy_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      buy_list_override_preferences: {
        Row: {
          allow_exotics: boolean | null
          allow_frame_damage: boolean | null
          allow_no_cr: boolean | null
          allow_salvage: boolean | null
          allow_tmu: boolean | null
          buy_list_id: string
          created_at: string
          id: string
          max_mileage: number | null
          max_price: number | null
          max_recon_cost: number | null
          max_year: number | null
          min_cr_score: number | null
          min_mileage: number | null
          min_price: number | null
          min_year: number | null
          no_brand_preference: boolean | null
          no_targeted_profit: boolean | null
          organization_id: string
          preferred_brands: string[] | null
          preferred_models: string[] | null
          target_profit: number | null
          updated_at: string
          vehicle_types: string[] | null
        }
        Insert: {
          allow_exotics?: boolean | null
          allow_frame_damage?: boolean | null
          allow_no_cr?: boolean | null
          allow_salvage?: boolean | null
          allow_tmu?: boolean | null
          buy_list_id: string
          created_at?: string
          id?: string
          max_mileage?: number | null
          max_price?: number | null
          max_recon_cost?: number | null
          max_year?: number | null
          min_cr_score?: number | null
          min_mileage?: number | null
          min_price?: number | null
          min_year?: number | null
          no_brand_preference?: boolean | null
          no_targeted_profit?: boolean | null
          organization_id: string
          preferred_brands?: string[] | null
          preferred_models?: string[] | null
          target_profit?: number | null
          updated_at?: string
          vehicle_types?: string[] | null
        }
        Update: {
          allow_exotics?: boolean | null
          allow_frame_damage?: boolean | null
          allow_no_cr?: boolean | null
          allow_salvage?: boolean | null
          allow_tmu?: boolean | null
          buy_list_id?: string
          created_at?: string
          id?: string
          max_mileage?: number | null
          max_price?: number | null
          max_recon_cost?: number | null
          max_year?: number | null
          min_cr_score?: number | null
          min_mileage?: number | null
          min_price?: number | null
          min_year?: number | null
          no_brand_preference?: boolean | null
          no_targeted_profit?: boolean | null
          organization_id?: string
          preferred_brands?: string[] | null
          preferred_models?: string[] | null
          target_profit?: number | null
          updated_at?: string
          vehicle_types?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "buy_list_override_preferences_buy_list_id_fkey"
            columns: ["buy_list_id"]
            isOneToOne: true
            referencedRelation: "buy_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buy_list_override_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      buy_lists: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          run_list_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id: string
          run_list_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          run_list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buy_lists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buy_lists_run_list_id_fkey"
            columns: ["run_list_id"]
            isOneToOne: false
            referencedRelation: "auction_run_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_data: {
        Row: {
          appointments: number | null
          channel_id: string
          conversion_rate: number | null
          cost: number | null
          created_at: string
          created_by: string | null
          id: string
          leads: number | null
          manual_cps: number | null
          month: string
          notes: string | null
          organization_id: string
          sold_units: number | null
          updated_at: string
        }
        Insert: {
          appointments?: number | null
          channel_id: string
          conversion_rate?: number | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          leads?: number | null
          manual_cps?: number | null
          month: string
          notes?: string | null
          organization_id: string
          sold_units?: number | null
          updated_at?: string
        }
        Update: {
          appointments?: number | null
          channel_id?: string
          conversion_rate?: number | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          leads?: number | null
          manual_cps?: number | null
          month?: string
          notes?: string | null
          organization_id?: string
          sold_units?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_data_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_data_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_preferences: {
        Row: {
          allow_accident_history: boolean | null
          allow_exotics: boolean | null
          allow_frame_damage: boolean | null
          allow_no_cr: boolean | null
          allow_salvage: boolean | null
          allow_tmu: boolean | null
          created_at: string
          excluded_brands: string[] | null
          id: string
          max_mileage: number | null
          max_price: number | null
          max_recon_cost: number | null
          max_year: number | null
          min_cr_score: number | null
          min_mileage: number | null
          min_price: number | null
          min_profit: number | null
          min_year: number | null
          organization_id: string
          preferred_auction_locations: string[] | null
          preferred_brands: string[] | null
          preferred_models: string[] | null
          sales_history_file_path: string | null
          sales_history_parse_error: string | null
          sales_history_parse_status: string | null
          target_profit: number | null
          updated_at: string
          vehicle_types: string[] | null
        }
        Insert: {
          allow_accident_history?: boolean | null
          allow_exotics?: boolean | null
          allow_frame_damage?: boolean | null
          allow_no_cr?: boolean | null
          allow_salvage?: boolean | null
          allow_tmu?: boolean | null
          created_at?: string
          excluded_brands?: string[] | null
          id?: string
          max_mileage?: number | null
          max_price?: number | null
          max_recon_cost?: number | null
          max_year?: number | null
          min_cr_score?: number | null
          min_mileage?: number | null
          min_price?: number | null
          min_profit?: number | null
          min_year?: number | null
          organization_id: string
          preferred_auction_locations?: string[] | null
          preferred_brands?: string[] | null
          preferred_models?: string[] | null
          sales_history_file_path?: string | null
          sales_history_parse_error?: string | null
          sales_history_parse_status?: string | null
          target_profit?: number | null
          updated_at?: string
          vehicle_types?: string[] | null
        }
        Update: {
          allow_accident_history?: boolean | null
          allow_exotics?: boolean | null
          allow_frame_damage?: boolean | null
          allow_no_cr?: boolean | null
          allow_salvage?: boolean | null
          allow_tmu?: boolean | null
          created_at?: string
          excluded_brands?: string[] | null
          id?: string
          max_mileage?: number | null
          max_price?: number | null
          max_recon_cost?: number | null
          max_year?: number | null
          min_cr_score?: number | null
          min_mileage?: number | null
          min_price?: number | null
          min_profit?: number | null
          min_year?: number | null
          organization_id?: string
          preferred_auction_locations?: string[] | null
          preferred_brands?: string[] | null
          preferred_models?: string[] | null
          sales_history_file_path?: string | null
          sales_history_parse_error?: string | null
          sales_history_parse_status?: string | null
          target_profit?: number | null
          updated_at?: string
          vehicle_types?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dealership_sales_history: {
        Row: {
          created_at: string | null
          created_by: string | null
          days_to_sale: number | null
          gross_profit: number | null
          id: string
          make: string | null
          mileage: number | null
          model: string | null
          organization_id: string
          sale_date: string | null
          sold_price: number | null
          trim: string | null
          vin: string | null
          year: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          days_to_sale?: number | null
          gross_profit?: number | null
          id?: string
          make?: string | null
          mileage?: number | null
          model?: string | null
          organization_id: string
          sale_date?: string | null
          sold_price?: number | null
          trim?: string | null
          vin?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          days_to_sale?: number | null
          gross_profit?: number | null
          id?: string
          make?: string | null
          mileage?: number | null
          model?: string | null
          organization_id?: string
          sale_date?: string | null
          sold_price?: number | null
          trim?: string | null
          vin?: string | null
          year?: number | null
        }
        Relationships: []
      }
      monthly_data: {
        Row: {
          avg_front_gross: number | null
          created_at: string
          created_by: string | null
          google_ads_spend: number | null
          id: string
          inventory_count: number | null
          leads_generated: number | null
          marketplace_spend: number | null
          meta_spend: number | null
          month: string
          organization_id: string
          other_spend: number | null
          retail_units_sold: number | null
          seo_spend: number | null
          updated_at: string
        }
        Insert: {
          avg_front_gross?: number | null
          created_at?: string
          created_by?: string | null
          google_ads_spend?: number | null
          id?: string
          inventory_count?: number | null
          leads_generated?: number | null
          marketplace_spend?: number | null
          meta_spend?: number | null
          month: string
          organization_id: string
          other_spend?: number | null
          retail_units_sold?: number | null
          seo_spend?: number | null
          updated_at?: string
        }
        Update: {
          avg_front_gross?: number | null
          created_at?: string
          created_by?: string | null
          google_ads_spend?: number | null
          id?: string
          inventory_count?: number | null
          leads_generated?: number | null
          marketplace_spend?: number | null
          meta_spend?: number | null
          month?: string
          organization_id?: string
          other_spend?: number | null
          retail_units_sold?: number | null
          seo_spend?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_data_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          avg_front_gross: number | null
          city: string | null
          created_at: string
          crm_dms_name: string | null
          google_rating: number | null
          google_review_count: number | null
          id: string
          inventory_count: number | null
          market_size: Database["public"]["Enums"]["market_size"] | null
          monthly_budget: number | null
          name: string
          onboarding_completed: boolean | null
          phone: string | null
          state: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          address?: string | null
          avg_front_gross?: number | null
          city?: string | null
          created_at?: string
          crm_dms_name?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          id?: string
          inventory_count?: number | null
          market_size?: Database["public"]["Enums"]["market_size"] | null
          monthly_budget?: number | null
          name: string
          onboarding_completed?: boolean | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          address?: string | null
          avg_front_gross?: number | null
          city?: string | null
          created_at?: string
          crm_dms_name?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          id?: string
          inventory_count?: number | null
          market_size?: Database["public"]["Enums"]["market_size"] | null
          monthly_budget?: number | null
          name?: string
          onboarding_completed?: boolean | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          onboarding_tour_completed: boolean | null
          organization_id: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          onboarding_tour_completed?: boolean | null
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          onboarding_tour_completed?: boolean | null
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      run_list_vehicles: {
        Row: {
          cr_score: number | null
          created_at: string
          dealer_max_bid_override: number | null
          dealer_notes: string | null
          estimated_profit: number | null
          estimated_recon_cost: number | null
          estimated_retail_value: number | null
          id: string
          in_buy_list: boolean | null
          lane_number: number | null
          make: string | null
          mileage: number | null
          model: string | null
          organization_id: string
          recommended_max_bid: number | null
          run_list_id: string
          run_order: number | null
          vin: string | null
          year: number | null
        }
        Insert: {
          cr_score?: number | null
          created_at?: string
          dealer_max_bid_override?: number | null
          dealer_notes?: string | null
          estimated_profit?: number | null
          estimated_recon_cost?: number | null
          estimated_retail_value?: number | null
          id?: string
          in_buy_list?: boolean | null
          lane_number?: number | null
          make?: string | null
          mileage?: number | null
          model?: string | null
          organization_id: string
          recommended_max_bid?: number | null
          run_list_id: string
          run_order?: number | null
          vin?: string | null
          year?: number | null
        }
        Update: {
          cr_score?: number | null
          created_at?: string
          dealer_max_bid_override?: number | null
          dealer_notes?: string | null
          estimated_profit?: number | null
          estimated_recon_cost?: number | null
          estimated_retail_value?: number | null
          id?: string
          in_buy_list?: boolean | null
          lane_number?: number | null
          make?: string | null
          mileage?: number | null
          model?: string | null
          organization_id?: string
          recommended_max_bid?: number | null
          run_list_id?: string
          run_order?: number | null
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "run_list_vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_list_vehicles_run_list_id_fkey"
            columns: ["run_list_id"]
            isOneToOne: false
            referencedRelation: "run_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      run_lists: {
        Row: {
          auction_date: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          auction_date?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          auction_date?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_lists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_history_uploads: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          organization_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          organization_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          organization_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_history_uploads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      spend_entries: {
        Row: {
          amount: number
          channel: string
          created_at: string
          date: string
          id: string
          leads: number | null
          organization_id: string
          revenue: number | null
        }
        Insert: {
          amount?: number
          channel: string
          created_at?: string
          date: string
          id?: string
          leads?: number | null
          organization_id: string
          revenue?: number | null
        }
        Update: {
          amount?: number
          channel?: string
          created_at?: string
          date?: string
          id?: string
          leads?: number | null
          organization_id?: string
          revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "spend_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          description: string
          id: string
          organization_id: string | null
          page_or_feature: string | null
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          organization_id?: string | null
          page_or_feature?: string | null
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          organization_id?: string | null
          page_or_feature?: string | null
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          role?: Database["public"]["Enums"]["app_role"]
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
      auction_performance_report: {
        Row: {
          auction_started_at: string | null
          auction_status: string | null
          avg_profit_score_purchased: number | null
          bidding_map_id: string | null
          lane_strategy_name: string | null
          passed_units: number | null
          projected_profit_on_purchased_units: number | null
          purchased_units: number | null
          total_purchase_spend: number | null
          total_selected_units: number | null
        }
        Relationships: []
      }
      dealer_sales_insights: {
        Row: {
          avg_days_to_sale: number | null
          avg_mileage: number | null
          avg_sale_price: number | null
          make: string | null
          model: string | null
          organization_id: string | null
          units_sold: number | null
        }
        Relationships: []
      }
      lane_strategy_view: {
        Row: {
          ai_recommendation: string | null
          ai_summary: string | null
          auction_vehicle_id: string | null
          bidding_map_id: string | null
          estimated_profit: number | null
          lane: string | null
          lane_strategy_name: string | null
          make: string | null
          mileage: number | null
          model: string | null
          profit_score: number | null
          recommended_max_bid: number | null
          risk_flags: string[] | null
          run_list_id: string | null
          run_order: number | null
          scoring_reasons: string[] | null
          trim: string | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auction_vehicles_run_list_id_fkey"
            columns: ["run_list_id"]
            isOneToOne: false
            referencedRelation: "auction_run_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bidding_map_items_bidding_map_id_fkey"
            columns: ["bidding_map_id"]
            isOneToOne: false
            referencedRelation: "auction_performance_report"
            referencedColumns: ["bidding_map_id"]
          },
          {
            foreignKeyName: "bidding_map_items_bidding_map_id_fkey"
            columns: ["bidding_map_id"]
            isOneToOne: false
            referencedRelation: "bidding_maps"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_vehicles_to_bid_map: {
        Args: { p_bidding_map_id: string; p_vehicle_ids: string[] }
        Returns: undefined
      }
      apply_dealer_demand_scoring: {
        Args: { p_run_list_id: string }
        Returns: undefined
      }
      apply_hard_preference_filters: {
        Args: { p_run_list_id: string }
        Returns: undefined
      }
      apply_recommendation_from_score: {
        Args: { p_run_list_id: string }
        Returns: undefined
      }
      finalize_run_list_scoring: {
        Args: { p_run_list_id: string }
        Returns: undefined
      }
      ensure_run_list_recommendations: {
        Args: { p_run_list_id: string }
        Returns: undefined
      }
      apply_vehicle_scoring: {
        Args: { p_run_list_id: string }
        Returns: undefined
      }
      calculate_run_list_profit_engine: {
        Args: { p_run_list_id: string }
        Returns: undefined
      }
      create_org_and_make_owner: {
        Args: { _org_name: string }
        Returns: string
      }
      generate_buy_list_from_profit: {
        Args: { p_run_list_id: string }
        Returns: undefined
      }
      generate_vehicle_recommendation_reason: {
        Args: { p_run_list_id: string }
        Returns: undefined
      }
      get_user_organization: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      infer_vehicle_types: {
        Args: { p_run_list_id: string }
        Returns: undefined
      }
      mark_vehicle_passed: {
        Args: { p_bidding_map_item_id: string }
        Returns: undefined
      }
      mark_vehicle_purchased: {
        Args: { p_bidding_map_item_id: string; p_purchase_price?: number }
        Returns: undefined
      }
      start_auction_intelligence: {
        Args: { p_bidding_map_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "dealer_principal"
        | "general_manager"
        | "marketing_manager"
        | "controller"
        | "admin"
      market_size: "small" | "mid_size" | "large"
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
      app_role: [
        "dealer_principal",
        "general_manager",
        "marketing_manager",
        "controller",
        "admin",
      ],
      market_size: ["small", "mid_size", "large"],
    },
  },
} as const
