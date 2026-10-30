export const CANONICAL_VEHICLE_TYPES = [
  'Sedan',
  'SUV',
  'Truck',
  'Coupe',
  'Van',
  'Hybrid',
  'Electric',
  'Luxury',
  'Economy',
  'Exotics',
  'Other',
] as const;

const LEGACY_QUICK_PREFERENCE_TYPES = ['Sedan', 'SUV', 'Truck', 'Coupe', 'Van', 'Other'] as const;
const LEGACY_PREFERENCE_PAGE_TYPES = ['Sedan', 'SUV', 'Truck', 'Hybrid', 'Electric', 'Luxury', 'Economy', 'Exotics'] as const;

const uniqueVehicleTypes = (vehicleTypes?: readonly string[] | null) =>
  Array.from(new Set((vehicleTypes ?? []).filter(Boolean)));

const matchesExactSet = (vehicleTypes: readonly string[], expected: readonly string[]) =>
  vehicleTypes.length === expected.length && expected.every((type) => vehicleTypes.includes(type));

const isUnfilteredSelection = (vehicleTypes: readonly string[]) =>
  vehicleTypes.length === 0
  || matchesExactSet(vehicleTypes, LEGACY_QUICK_PREFERENCE_TYPES)
  || matchesExactSet(vehicleTypes, LEGACY_PREFERENCE_PAGE_TYPES)
  || matchesExactSet(vehicleTypes, CANONICAL_VEHICLE_TYPES);

export const expandVehicleTypeSelection = (vehicleTypes?: readonly string[] | null) => {
  const selected = uniqueVehicleTypes(vehicleTypes);
  return isUnfilteredSelection(selected) ? [...CANONICAL_VEHICLE_TYPES] : selected;
};

export const normalizeVehicleTypeSelectionForSave = (vehicleTypes?: readonly string[] | null) => {
  const selected = uniqueVehicleTypes(vehicleTypes);
  return isUnfilteredSelection(selected) ? [] : selected;
};