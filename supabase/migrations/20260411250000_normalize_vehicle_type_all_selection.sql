DO $$
DECLARE
  legacy_quick_types text[] := ARRAY['Sedan', 'SUV', 'Truck', 'Coupe', 'Van', 'Other'];
  legacy_preference_types text[] := ARRAY['Sedan', 'SUV', 'Truck', 'Hybrid', 'Electric', 'Luxury', 'Economy', 'Exotics'];
  canonical_types text[] := ARRAY['Sedan', 'SUV', 'Truck', 'Coupe', 'Van', 'Hybrid', 'Electric', 'Luxury', 'Economy', 'Exotics', 'Other'];
BEGIN
  UPDATE public.dealer_preferences
  SET vehicle_types = '{}'::text[]
  WHERE vehicle_types IS NOT NULL
    AND (
      (vehicle_types <@ legacy_quick_types AND vehicle_types @> legacy_quick_types AND cardinality(vehicle_types) = cardinality(legacy_quick_types))
      OR (vehicle_types <@ legacy_preference_types AND vehicle_types @> legacy_preference_types AND cardinality(vehicle_types) = cardinality(legacy_preference_types))
      OR (vehicle_types <@ canonical_types AND vehicle_types @> canonical_types AND cardinality(vehicle_types) = cardinality(canonical_types))
    );

  UPDATE public.buy_list_override_preferences
  SET vehicle_types = '{}'::text[]
  WHERE vehicle_types IS NOT NULL
    AND (
      (vehicle_types <@ legacy_quick_types AND vehicle_types @> legacy_quick_types AND cardinality(vehicle_types) = cardinality(legacy_quick_types))
      OR (vehicle_types <@ legacy_preference_types AND vehicle_types @> legacy_preference_types AND cardinality(vehicle_types) = cardinality(legacy_preference_types))
      OR (vehicle_types <@ canonical_types AND vehicle_types @> canonical_types AND cardinality(vehicle_types) = cardinality(canonical_types))
    );
END $$;