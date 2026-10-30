CREATE OR REPLACE FUNCTION public.infer_vehicle_types(p_run_list_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_suv_models text[] := ARRAY[
    'CR-V','CRV','RAV4','HIGHLANDER','4RUNNER','PILOT','PASSPORT','HR-V','HRV',
    'TUCSON','SANTA FE','PALISADE','KONA','VENUE','IONIQ 5','IONIQ 6',
    'SORENTO','TELLURIDE','SPORTAGE','SELTOS','NIRO','EV6','EV9',
    'EQUINOX','BLAZER','TRAVERSE','TAHOE','SUBURBAN','AVALANCHE','TRAILBLAZER','TRAX','BOLT',
    'ESCAPE','EXPLORER','EXPEDITION','BRONCO','BRONCO SPORT','EDGE','EXCURSION',
    'ENVISION','ENCLAVE','ENCORE','ENCORE GX',
    'ACADIA','TERRAIN','YUKON','HUMMER EV',
    'CHEROKEE','COMPASS','GRAND CHEROKEE','GRAND CHEROKEE L','RENEGADE','WRANGLER','WAGONEER',
    'X1','X3','X5','X6','X7','IX',
    'Q3','Q5','Q7','Q8','E-TRON','ETRON',
    'GLA','GLB','GLC','GLE','GLS','EQB',
    'NX','RX','UX','GX','LX','TX','RZ',
    'MDX','RDX',
    'QX50','QX55','QX60','QX80',
    'CAYENNE','MACAN',
    'MODEL X','MODEL Y',
    'DEFENDER','DISCOVERY','DISCOVERY SPORT','RANGE ROVER','RANGE ROVER EVOQUE','RANGE ROVER SPORT','RANGE ROVER VELAR',
    'STELVIO','TONALE',
    'XC40','XC60','XC90','C40',
    'TIGUAN','ATLAS','ATLAS CROSS SPORT','TAOS','ID.4','ID4',
    'CROSSTREK','FORESTER','OUTBACK','ASCENT','SOLTERRA',
    'OUTLANDER','OUTLANDER SPORT','ECLIPSE CROSS',
    'KICKS','MURANO','PATHFINDER','ROGUE','ROGUE SPORT','ARIYA',
    'CX-30','CX30','CX-5','CX5','CX-50','CX50','CX-90','CX90',
    'CORSAIR','AVIATOR','NAUTILUS','NAVIGATOR',
    'LYRIQ','XT4','XT5','XT6','ESCALADE',
    'GV60','GV70','GV80',
    'R1S',
    'E-PACE','F-PACE','I-PACE',
    'HORNET','DURANGO',
    'BZ4X','LAND CRUISER','SEQUOIA','VENZA'
  ];
  v_truck_models text[] := ARRAY[
    'F-150','F-250','F-350','F150','F250','F350',
    'SILVERADO','SIERRA','COLORADO','CANYON',
    'TACOMA','TUNDRA',
    'RANGER','MAVERICK',
    'FRONTIER','TITAN',
    'RIDGELINE','GLADIATOR','SANTA CRUZ',
    'CYBERTRUCK','R1T'
  ];
  v_van_models text[] := ARRAY[
    'ODYSSEY','SIENNA','PACIFICA','CARNIVAL','VOYAGER',
    'TRANSIT','TRANSIT CONNECT','PROMASTER','METRIS',
    'NV200','NV','SPRINTER','RAM VAN','EXPRESS VAN','SAVANA'
  ];
  v_coupe_models text[] := ARRAY[
    'MUSTANG','CAMARO','CORVETTE','CHALLENGER',
    '2 SERIES','4 SERIES','8 SERIES','M4',
    'RC','LC','718','911',
    'GR86','GR 86','BRZ','GR SUPRA','SUPRA',
    'MX-5','MX5','MIATA','MX-5 MIATA',
    'Z','370Z','350Z','TT','F-TYPE'
  ];
  v_sedan_models text[] := ARRAY[
    'ACCORD','CIVIC','CAMRY','COROLLA','PRIUS',
    'ALTIMA','SENTRA','MAXIMA','VERSA','LEAF',
    'ELANTRA','SONATA','FORTE','K5','STINGER',
    'JETTA','GOLF','PASSAT',
    '3 SERIES','5 SERIES','7 SERIES','I4',
    'A3','A4','A5','A6','A7','A8','S4','S5','RS5',
    'C-CLASS','E-CLASS','S-CLASS','A-CLASS','CLA',
    'IS','ES','LS',
    'CT4','CT5','Q50','Q60',
    'G70','G80','G90',
    'MODEL 3','MODEL S',
    'S60','S90','V60','V90',
    'GIULIA','TLX','ILX','INTEGRA',
    'MALIBU','300',
    'IMPREZA','LEGACY','WRX',
    'MAZDA3','CHARGER','SOUL','MIRAGE',
    'CROWN VICTORIA','CROWN VIC','TOWN CAR','GRAND MARQUIS'
  ];
BEGIN
  UPDATE public.auction_vehicles av
  SET vehicle_type =
    CASE
      WHEN EXISTS (
        SELECT 1 FROM unnest(v_truck_models) AS m
        WHERE upper(COALESCE(av.model, '')) = m
          OR upper(COALESCE(av.model, '')) LIKE m || ' %'
      ) THEN 'Truck'
      WHEN upper(COALESCE(av.make, '')) = 'RAM'
       AND upper(COALESCE(av.model, '')) NOT LIKE '%VAN%' THEN 'Truck'
      WHEN EXISTS (
        SELECT 1 FROM unnest(v_van_models) AS m
        WHERE upper(COALESCE(av.model, '')) = m
          OR upper(COALESCE(av.model, '')) LIKE m || ' %'
      ) THEN 'Van'
      WHEN EXISTS (
        SELECT 1 FROM unnest(v_suv_models) AS m
        WHERE upper(COALESCE(av.model, '')) = m
          OR upper(COALESCE(av.model, '')) LIKE m || ' %'
      ) THEN 'SUV'
      WHEN upper(COALESCE(av.model, '')) LIKE '%1500%'
        OR upper(COALESCE(av.model, '')) LIKE '%2500%'
        OR upper(COALESCE(av.model, '')) LIKE '%3500%'
      THEN 'Truck'
      WHEN EXISTS (
        SELECT 1 FROM unnest(v_coupe_models) AS m
        WHERE upper(COALESCE(av.model, '')) = m
          OR upper(COALESCE(av.model, '')) LIKE m || ' %'
      ) THEN 'Coupe'
      WHEN EXISTS (
        SELECT 1 FROM unnest(v_sedan_models) AS m
        WHERE upper(COALESCE(av.model, '')) = m
          OR upper(COALESCE(av.model, '')) LIKE m || ' %'
      ) THEN 'Sedan'
      ELSE 'Other'
    END
  WHERE av.run_list_id = p_run_list_id
    AND (av.vehicle_type IS NULL OR av.vehicle_type = '' OR av.vehicle_type = 'Other');
END;
$function$;