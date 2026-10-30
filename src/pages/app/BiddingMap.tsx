import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  MapPin,
  Printer,
  List,
  Layers,
  Sparkles,
  ShieldAlert,
  Play,
  CheckCircle2,
  XCircle,
  Zap,
  AlertTriangle,
  Wand2,
  Loader2,
  Clock,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { logger, getErrorMessage } from "@/lib/logger";
import { PurchasePriceDialog } from "@/components/lane-strategy/PurchasePriceDialog";
import { AuctionPerformanceSummary } from "@/components/lane-strategy/AuctionPerformanceSummary";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/TablePagination";

const fmt = (n: number) => `$${n.toLocaleString()}`;

const recBadge = (rec: string | null) => {
  switch (rec) {
    case "Strong Buy":
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 text-xs">
          Strong Buy
        </Badge>
      );
    case "Buy":
      return (
        <Badge className="bg-blue-600 hover:bg-blue-700 text-white border-0 text-xs">
          Buy
        </Badge>
      );
    case "Possible Buy":
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs">
          Possible Buy
        </Badge>
      );
    case "Pass":
      return (
        <Badge className="bg-muted text-muted-foreground border-0 text-xs">
          Pass
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          {rec || "—"}
        </Badge>
      );
  }
};

const urgencyBadge = (urgency: string) => {
  switch (urgency) {
    case "Up Next":
      return (
        <Badge className="bg-red-600 hover:bg-red-700 text-white border-0 text-xs animate-pulse">
          Up Next
        </Badge>
      );
    case "Coming Soon":
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs">
          Coming Soon
        </Badge>
      );
    case "Later":
      return (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          Later
        </Badge>
      );
    default:
      return null;
  }
};

const outcomeBadge = (outcome: string | null) => {
  if (outcome === "purchased")
    return (
      <Badge className="bg-emerald-600 text-white border-0 text-xs">
        Purchased
      </Badge>
    );
  if (outcome === "passed")
    return (
      <Badge className="bg-muted text-muted-foreground border-0 text-xs">
        Passed
      </Badge>
    );
  return null;
};

function parseLaneNum(lane: string | null): number {
  if (!lane) return 999;
  const m = lane.match(/\d+/);
  return m ? parseInt(m[0]) : 999;
}

interface StrategyItem {
  bidding_map_id: string;
  lane_strategy_name: string;
  auction_vehicle_id: string;
  run_list_id: string;
  lane: string | null;
  run_order: number | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  mileage: number | null;
  ai_recommendation: string | null;
  estimated_profit: number | null;
  recommended_max_bid: number | null;
  profit_score: number | null;
  ai_summary: string | null;
  ai_insight: string | null;
  risk_flags: string[] | null;
  scoring_reasons: string[] | null;
}

interface BiddingMapItemRow {
  id: string;
  auction_vehicle_id: string;
  outcome: string | null;
}

interface BiddingMapStatusRow {
  intelligence_status: IntelligenceStatus | null;
  current_vehicle_index: number | null;
}

const log = logger("LaneStrategy");

type IntelligenceStatus = "not_started" | "live" | "completed";

const LaneStrategy = () => {
  const { organization } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mapId = searchParams.get("map_id");
  const printRef = useRef<HTMLDivElement>(null);

  const [items, setItems] = useState<StrategyItem[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, string | null>>({});
  const [bmiIdMap, setBmiIdMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"auction" | "lane">("auction");
  const [selectedVehicle, setSelectedVehicle] = useState<StrategyItem | null>(
    null,
  );
  const [insightLoading, setInsightLoading] = useState(false);
  const [intelligenceStatus, setIntelligenceStatus] =
    useState<IntelligenceStatus>("not_started");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [perfKey, setPerfKey] = useState(0);

  // History state
  const [allMaps, setAllMaps] = useState<any[]>([]);
  const [loadingMaps, setLoadingMaps] = useState(false);

  // Purchase price dialog state
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchaseTargetVehicleId, setPurchaseTargetVehicleId] = useState<
    string | null
  >(null);

  // Lane Strategy verification warning
  const [showWarning, setShowWarning] = useState(() => {
    return sessionStorage.getItem("lane_strategy_warning_dismissed") !== "true";
  });
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const dismissWarning = () => {
    if (dontShowAgain) {
      sessionStorage.setItem("lane_strategy_warning_dismissed", "true");
    }
    setShowWarning(false);
  };

  const loadData = useCallback(async () => {
    if (!mapId) return;
    setLoading(true);

    const [viewData, mapRes, bmiData] = await Promise.all([
      fetchAllRows<StrategyItem>((from, to) =>
        supabase
          .from("lane_strategy_view")
          .select("*")
          .eq("bidding_map_id", mapId)
          .range(from, to),
      ),
      supabase
        .from("bidding_maps")
        .select("intelligence_status, current_vehicle_index")
        .eq("id", mapId)
        .single<BiddingMapStatusRow>(),
      fetchAllRows<BiddingMapItemRow>((from, to) =>
        supabase
          .from("bidding_map_items")
          .select("id, auction_vehicle_id, outcome")
          .eq("bidding_map_id", mapId)
          .range(from, to),
      ),
    ]);

    setItems(viewData);
    if (mapRes.data) {
      setIntelligenceStatus(mapRes.data.intelligence_status || "not_started");
      setCurrentIndex(mapRes.data.current_vehicle_index || 0);
    }
    {
      const idMap: Record<string, string> = {};
      const outcomeMap: Record<string, string | null> = {};
      bmiData.forEach((r) => {
        idMap[r.auction_vehicle_id] = r.id;
        outcomeMap[r.auction_vehicle_id] = r.outcome;
      });
      setBmiIdMap(idMap);
      setOutcomes(outcomeMap);
    }

    setLoading(false);
  }, [mapId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!mapId && organization?.id) {
      const fetchMaps = async () => {
        setLoadingMaps(true);
        try {
          const { data, error } = await supabase
            .from("bidding_maps")
            .select("id, name, auction_date, created_at")
            .eq("organization_id", organization.id)
            .order("created_at", { ascending: false });
          if (data) setAllMaps(data);
        } catch (err) {
          log.error("Failed to load past lane strategies", err);
        } finally {
          setLoadingMaps(false);
        }
      };
      fetchMaps();
    }
  }, [mapId, organization?.id]);

  const updateMapField = async (fields: Partial<BiddingMapStatusRow>) => {
    if (!mapId) return;
    await supabase.from("bidding_maps").update(fields).eq("id", mapId);
  };

  const handleStartIntelligence = async () => {
    setIntelligenceStatus("live");
    setCurrentIndex(0);
    await updateMapField({
      intelligence_status: "live",
      current_vehicle_index: 0,
    });
    toast.success("Auction Intelligence is now Live");
  };

  const handleComplete = async () => {
    setIntelligenceStatus("completed");
    await updateMapField({ intelligence_status: "completed" });
    setPerfKey((k) => k + 1);
    toast.success("Auction Intelligence completed");
  };

  const handleAdvance = async () => {
    const sorted = [...items].sort(
      (a, b) => (a.run_order ?? 999) - (b.run_order ?? 999),
    );
    const next = currentIndex + 1;
    if (next >= sorted.length) {
      handleComplete();
      return;
    }
    setCurrentIndex(next);
    await updateMapField({ current_vehicle_index: next });
  };

  const initiatePurchase = (vehicleId: string) => {
    setPurchaseTargetVehicleId(vehicleId);
    setPurchaseDialogOpen(true);
  };

  const confirmPurchase = async (price: number) => {
    if (!purchaseTargetVehicleId) return;
    const bmiId = bmiIdMap[purchaseTargetVehicleId];
    if (!bmiId) {
      toast.error("Item not found");
      return;
    }

    await supabase.rpc("mark_vehicle_purchased", {
      p_bidding_map_item_id: bmiId,
      p_purchase_price: price,
    });

    setOutcomes((prev) => ({
      ...prev,
      [purchaseTargetVehicleId]: "purchased",
    }));
    setPurchaseDialogOpen(false);
    setPurchaseTargetVehicleId(null);
    setPerfKey((k) => k + 1);
    toast.success("Marked as Purchased");
  };

  const handlePass = async (vehicleId: string) => {
    const bmiId = bmiIdMap[vehicleId];
    if (!bmiId) {
      toast.error("Item not found");
      return;
    }

    await supabase.rpc("mark_vehicle_passed", {
      p_bidding_map_item_id: bmiId,
    });

    setOutcomes((prev) => ({ ...prev, [vehicleId]: "passed" }));
    setPerfKey((k) => k + 1);
    toast.success("Marked as Passed");
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Lane Strategy Sheet</title>
      <style>
        body { font-family: -apple-system, sans-serif; padding: 24px; color: #1a1a2e; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .meta { color: #666; font-size: 13px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { font-weight: 600; background: #f9fafb; }
        .text-right { text-align: right; }
      </style></head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  const strategyName = items[0]?.lane_strategy_name || "Lane Strategy";
  const auctionOrder = [...items].sort(
    (a, b) => (a.run_order ?? 999) - (b.run_order ?? 999),
  );
  const auctionPagination = usePagination(auctionOrder, 50);

  const laneGroups: Record<string, StrategyItem[]> = {};
  [...items]
    .sort((a, b) => {
      const la = parseLaneNum(a.lane);
      const lb = parseLaneNum(b.lane);
      if (la !== lb) return la - lb;
      return (a.run_order ?? 0) - (b.run_order ?? 0);
    })
    .forEach((item) => {
      const key = item.lane || "Unknown";
      if (!laneGroups[key]) laneGroups[key] = [];
      laneGroups[key].push(item);
    });

  const totalUnits = items.length;
  const totalProfit = items.reduce(
    (s, i) => s + (Number(i.estimated_profit) || 0),
    0,
  );
  const avgBid =
    totalUnits > 0
      ? Math.round(
          items.reduce((s, i) => s + (Number(i.recommended_max_bid) || 0), 0) /
            totalUnits,
        )
      : 0;
  const purchasedCount = Object.values(outcomes).filter(
    (o) => o === "purchased",
  ).length;

  const getUrgency = (idx: number): string => {
    if (intelligenceStatus !== "live") return "";
    if (idx === currentIndex) return "Up Next";
    if (idx === currentIndex + 1 || idx === currentIndex + 2)
      return "Coming Soon";
    if (idx > currentIndex) return "Later";
    return "";
  };

  const purchaseTarget = items.find(
    (i) => i.auction_vehicle_id === purchaseTargetVehicleId,
  );
  const purchaseLabel = purchaseTarget
    ? `${purchaseTarget.year} ${purchaseTarget.make} ${purchaseTarget.model} ${purchaseTarget.trim || ""}`.trim()
    : "";

  if (!mapId) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" /> Lane Strategy History
          </h2>
          <p className="text-sm text-muted-foreground">
            Select a previous Lane Strategy to view or manage it.
          </p>
        </div>

        {loadingMaps ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : allMaps.length === 0 ? (
          <Card className="border-dashed border-2 py-16 text-center">
            <CardContent className="flex flex-col items-center gap-4">
              <MapPin className="h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold">
                No Lane Strategies Created
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Open a buy list, select the vehicles you are interested in, and
                add them to a Lane Strategy Map.
              </p>
              <Button
                onClick={() => navigate("/app/dashboard")}
                className="mt-2 bg-[#5A5AFF] hover:bg-[#4848E6] text-white"
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-border shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-t border-b-2 border-slate-300 bg-slate-200 hover:bg-slate-300">
                      <TableHead>Strategy Name</TableHead>
                      <TableHead>Auction Date</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead className="text-right w-28">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allMaps.map((map) => (
                      <TableRow key={map.id} className="hover:bg-muted/30">
                        <TableCell className="font-semibold text-foreground">
                          {map.name || "Untitled Bidding Map"}
                        </TableCell>
                        <TableCell>
                          {map.auction_date
                            ? new Date(map.auction_date).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {new Date(map.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() =>
                              navigate(`/app/lane-strategy?map_id=${map.id}`)
                            }
                            className="bg-[#5A5AFF] hover:bg-[#4848E6] text-white gap-1"
                          >
                            Open Map
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const statusBadge = () => {
    switch (intelligenceStatus) {
      case "not_started":
        return (
          <Badge variant="outline" className="text-xs">
            Not Started
          </Badge>
        );
      case "live":
        return (
          <Badge className="bg-red-600 text-white border-0 text-xs animate-pulse">
            ● Live
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-emerald-600 text-white border-0 text-xs">
            Completed
          </Badge>
        );
    }
  };

  const renderRow = (item: StrategyItem, seq: number, globalIdx?: number) => {
    const urgency = globalIdx != null ? getUrgency(globalIdx) : "";
    const isUpNext = urgency === "Up Next";
    const vehicleOutcome = outcomes[item.auction_vehicle_id];

    return (
      <TableRow
        key={item.auction_vehicle_id}
        data-tour={seq === 1 ? "lane-vehicle-row" : undefined}
        className={`cursor-pointer transition-colors ${isUpNext ? "bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/40"} ${vehicleOutcome ? "opacity-60" : ""}`}
        onClick={() => setSelectedVehicle(item)}
      >
        <TableCell className="font-medium text-muted-foreground">
          {seq}
        </TableCell>
        <TableCell className="font-medium">{item.run_order ?? "—"}</TableCell>
        <TableCell>
          <Badge variant="outline">{item.lane || "—"}</Badge>
        </TableCell>
        <TableCell className="font-medium">
          {item.year} {item.make} {item.model} {item.trim}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {item.mileage?.toLocaleString() ?? "—"}
        </TableCell>
        <TableCell>{recBadge(item.ai_recommendation)}</TableCell>
        <TableCell className="text-right tabular-nums text-emerald-600 font-medium">
          {item.estimated_profit != null
            ? fmt(Number(item.estimated_profit))
            : "—"}
        </TableCell>
        <TableCell className="text-right tabular-nums font-semibold">
          {item.recommended_max_bid != null
            ? fmt(Number(item.recommended_max_bid))
            : "—"}
        </TableCell>
        <TableCell className="max-w-[180px]">
          {item.ai_summary && (
            <span className="text-xs text-muted-foreground line-clamp-2">
              {item.ai_summary}
            </span>
          )}
        </TableCell>
        <TableCell>
          <span data-tour={seq === 1 ? "lane-timing" : undefined}>
            {vehicleOutcome
              ? outcomeBadge(vehicleOutcome)
              : urgency
                ? urgencyBadge(urgency)
                : null}
          </span>
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          {!vehicleOutcome && (
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={() => initiatePurchase(item.auction_vehicle_id)}
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => handlePass(item.auction_vehicle_id)}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          )}
        </TableCell>
      </TableRow>
    );
  };

  const tableHeaders = (
    <TableRow>
      <TableHead className="w-12">#</TableHead>
      <TableHead>Run #</TableHead>
      <TableHead>Lane</TableHead>
      <TableHead>Vehicle</TableHead>
      <TableHead className="text-right">Mileage</TableHead>
      <TableHead>AI Rec</TableHead>
      <TableHead className="text-right">Est. Profit</TableHead>
      <TableHead className="text-right">Max Bid</TableHead>
      <TableHead className="max-w-[180px]">Reason</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="w-20">Actions</TableHead>
    </TableRow>
  );

  return (
    <>
      {/* Lane Strategy Verification Warning */}
      <Dialog
        open={showWarning && !!mapId}
        onOpenChange={(open) => {
          if (!open) dismissWarning();
        }}
      >
        <DialogContent className="w-[95%] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Before You Bid
            </DialogTitle>
            <DialogDescription>
              Please verify the following before placing any bids at auction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">
                Please confirm you have reviewed:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
                <li>Vehicle history reports (Carfax, AutoCheck)</li>
                <li>Mileage disclosures and odometer statements</li>
                <li>Auction announcements and seller disclosures</li>
                <li>Title status and any title brands</li>
                <li>Condition report details and photos</li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground italic">
              LogicLot provides AI-powered recommendations based on available
              data. Always verify vehicle condition and history independently
              before bidding.
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2 mr-auto">
              <Checkbox
                id="dont-show"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(!!checked)}
              />
              <label
                htmlFor="dont-show"
                className="text-xs text-muted-foreground cursor-pointer"
              >
                Don't show again this session
              </label>
            </div>
            <Button onClick={dismissWarning} className="gap-1.5">
              I Understand — Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {strategyName}
              </h2>
              <p className="text-sm text-muted-foreground">
                {totalUnits} vehicles{" "}
                {purchasedCount > 0 && `• ${purchasedCount} purchased`}
              </p>
            </div>
            {statusBadge()}
          </div>
          <div className="flex gap-2">
            {intelligenceStatus === "not_started" && items.length > 0 && (
              <Button onClick={handleStartIntelligence} className="gap-2">
                <Play className="h-4 w-4" /> Start Auction Intelligence
              </Button>
            )}
            {intelligenceStatus === "live" && (
              <>
                <Button
                  variant="outline"
                  onClick={handleAdvance}
                  className="gap-2"
                >
                  <Zap className="h-4 w-4" /> Next Vehicle
                </Button>
                <Button
                  variant="outline"
                  onClick={handleComplete}
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" /> End Auction
                </Button>
              </>
            )}
            {items.length > 0 && (
              <Button variant="outline" onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" /> Print
              </Button>
            )}
          </div>
        </div>

        {/* Auction Performance Summary */}
        {mapId &&
          (intelligenceStatus === "live" ||
            intelligenceStatus === "completed") && (
            <AuctionPerformanceSummary key={perfKey} mapId={mapId} />
          )}

        {/* Summary Cards */}
        {items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{totalUnits}</p>
                <p className="text-xs text-muted-foreground">
                  Selected Vehicles
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">
                  {fmt(totalProfit)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Total Est. Profit
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{fmt(avgBid)}</p>
                <p className="text-xs text-muted-foreground">Avg Max Bid</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">
                  {purchasedCount}
                </p>
                <p className="text-xs text-muted-foreground">Purchased</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* View Toggle */}
        {items.length > 0 && (
          <div className="flex items-center gap-3">
            <ToggleGroup
              data-tour="lane-view-toggle"
              type="single"
              value={view}
              onValueChange={(v) => {
                if (v === "auction" || v === "lane") setView(v);
              }}
            >
              <ToggleGroupItem value="auction" className="gap-1.5 text-sm">
                <List className="h-4 w-4" /> Auction Order
              </ToggleGroupItem>
              <ToggleGroupItem value="lane" className="gap-1.5 text-sm">
                <Layers className="h-4 w-4" /> By Lane
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}

        {/* Table content */}
        {items.length > 0 && (
          <div ref={printRef}>
            <h1 style={{ fontSize: "18px", fontWeight: 700 }}>
              Lane Strategy Sheet
            </h1>
            <p className="meta text-sm text-muted-foreground mb-4">
              {organization?.name} — {totalUnits} vehicles
            </p>

            {view === "auction" ? (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="border-t border-b-2 border-slate-300 bg-slate-200 hover:bg-slate-300">
                        {tableHeaders}
                      </TableHeader>
                      <TableBody>
                        {auctionPagination.pageItems.map((item, idx) => {
                          const globalIdx =
                            (auctionPagination.page - 1) *
                              auctionPagination.pageSize +
                            idx;
                          return renderRow(item, globalIdx + 1, globalIdx);
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <TablePagination
                    page={auctionPagination.page}
                    totalPages={auctionPagination.totalPages}
                    totalItems={auctionPagination.totalItems}
                    pageSize={auctionPagination.pageSize}
                    onPageChange={auctionPagination.setPage}
                    onPageSizeChange={auctionPagination.setPageSize}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {Object.entries(laneGroups).map(([lane, laneItems]) => (
                  <Card key={lane}>
                    <CardContent className="p-0">
                      <div className="px-4 py-3 border-b bg-muted/40">
                        <h3 className="text-sm font-bold flex items-center gap-2">
                          <Badge>{lane}</Badge>
                          <span className="text-muted-foreground font-normal">
                            {laneItems.length} vehicle
                            {laneItems.length !== 1 ? "s" : ""}
                          </span>
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>{tableHeaders}</TableHeader>
                          <TableBody>
                            {laneItems.map((item, idx) =>
                              renderRow(item, idx + 1),
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {items.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              No vehicles in this Lane Strategy. Go to your Buy List to select
              and add vehicles.
            </p>
          </div>
        )}

        {/* Purchase Price Dialog */}
        <PurchasePriceDialog
          open={purchaseDialogOpen}
          onOpenChange={setPurchaseDialogOpen}
          vehicleLabel={purchaseLabel}
          onConfirm={confirmPurchase}
        />

        {/* Vehicle Detail Panel */}
        <Sheet
          open={!!selectedVehicle}
          onOpenChange={(open) => {
            if (!open) setSelectedVehicle(null);
          }}
        >
          <SheetContent className="sm:max-w-lg overflow-y-auto">
            {selectedVehicle && (
              <VehicleDetailPanel
                vehicle={selectedVehicle}
                outcome={outcomes[selectedVehicle.auction_vehicle_id]}
                onPurchase={() =>
                  initiatePurchase(selectedVehicle.auction_vehicle_id)
                }
                onPass={() => handlePass(selectedVehicle.auction_vehicle_id)}
                insightLoading={insightLoading}
                onGenerateInsight={async () => {
                  setInsightLoading(true);
                  try {
                    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
                    if (!apiKey)
                      throw new Error(
                        "VITE_GEMINI_API_KEY is missing from .env file.",
                      );

                    const v = selectedVehicle;
                    const prompt = `Analyze this auction vehicle for a dealership looking to acquire wholesale inventory and write a 3-4 sentence professional summary of the opportunity. Be concise, direct, and use the exact numbers provided.

Vehicle: ${v.year} ${v.make} ${v.model} ${v.trim || ""}
Mileage: ${v.mileage || "Unknown"} miles
Estimated Retail Value: $${v.estimated_retail_value || "Unknown"}
Recommended Max Bid: $${v.recommended_max_bid || "Unknown"}
Profit Score: ${v.profit_score || "Unknown"}/100
Risk Flags: ${(v.risk_flags || []).join(", ") || "None"}
Scoring Reasons: ${(v.scoring_reasons || []).join(", ") || "None"}

End with a clear, one sentence recommendation (e.g., "Recommended Action: Bid aggressively up to max bid").`;

                    const res = await fetch(
                      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          contents: [{ parts: [{ text: prompt }] }],
                          generationConfig: { temperature: 0.3 },
                        }),
                      },
                    );

                    if (!res.ok)
                      throw new Error(`Google API returned ${res.status}`);
                    const geminiData = await res.json();
                    const insight =
                      geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (!insight)
                      throw new Error(
                        "Could not parse insight from Gemini response.",
                      );

                    setSelectedVehicle((prev) =>
                      prev ? { ...prev, ai_insight: insight } : prev,
                    );
                    setItems((prev) =>
                      prev.map((x) =>
                        x.auction_vehicle_id ===
                        selectedVehicle.auction_vehicle_id
                          ? { ...x, ai_insight: insight }
                          : x,
                      ),
                    );
                  } catch (err: unknown) {
                    toast.error(
                      "Could not generate insight: " + getErrorMessage(err),
                    );
                  } finally {
                    setInsightLoading(false);
                  }
                }}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};

/* ─── Detail Panel ─── */

const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex justify-between items-start py-2 border-b border-border/50 last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground text-right">
      {value}
    </span>
  </div>
);

interface DetailProps {
  vehicle: StrategyItem;
  outcome: string | null;
  onPurchase: () => void;
  onPass: () => void;
  insightLoading: boolean;
  onGenerateInsight: () => void;
}

const VehicleDetailPanel = ({
  vehicle: v,
  outcome,
  onPurchase,
  onPass,
  insightLoading,
  onGenerateInsight,
}: DetailProps) => (
  <>
    <SheetHeader className="pb-4">
      <SheetTitle className="text-lg">
        {v.year} {v.make} {v.model} {v.trim}
      </SheetTitle>
      <SheetDescription className="text-xs">
        Run #{v.run_order} • Lane {v.lane || "—"}
      </SheetDescription>
      <div className="pt-2 flex gap-2">
        {recBadge(v.ai_recommendation)}
        {outcomeBadge(outcome)}
      </div>
    </SheetHeader>

    {!outcome && (
      <div className="flex gap-2 mb-4">
        <Button
          onClick={onPurchase}
          className="gap-2 flex-1 bg-emerald-600 hover:bg-emerald-700"
        >
          <CheckCircle2 className="h-4 w-4" /> Mark Purchased
        </Button>
        <Button variant="outline" onClick={onPass} className="gap-2 flex-1">
          <XCircle className="h-4 w-4" /> Mark Passed
        </Button>
      </div>
    )}

    <div className="rounded-lg border bg-muted/30 p-4 mb-4">
      <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-1.5">
        <Sparkles className="h-4 w-4 text-primary" /> AI Summary
      </h4>
      {v.ai_insight ? (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {v.ai_insight}
        </p>
      ) : (
        <div>
          {v.ai_summary && (
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              {v.ai_summary}
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-7"
            disabled={insightLoading}
            onClick={onGenerateInsight}
          >
            {insightLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            {insightLoading ? "Generating…" : "Generate AI Insight"}
          </Button>
        </div>
      )}
    </div>

    {(v.scoring_reasons?.length ?? 0) > 0 && (
      <div className="mb-4">
        <h4 className="text-sm font-semibold mb-2">Scoring Reasons</h4>
        <div className="flex flex-wrap gap-1.5">
          {v.scoring_reasons!.map((r, i) => (
            <Badge key={i} variant="secondary" className="text-xs font-normal">
              {r}
            </Badge>
          ))}
        </div>
      </div>
    )}

    {(v.risk_flags?.length ?? 0) > 0 && (
      <div className="mb-4">
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <ShieldAlert className="h-4 w-4 text-destructive" /> Risk Flags
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {v.risk_flags!.map((f, i) => (
            <Badge
              key={i}
              variant="destructive"
              className="text-xs font-normal"
            >
              {f}
            </Badge>
          ))}
        </div>
      </div>
    )}

    <div>
      <h4 className="text-sm font-semibold mb-2">Financials</h4>
      <div className="rounded-lg border p-3">
        <DetailRow
          label="Est. Profit"
          value={
            <span className="text-emerald-600 font-semibold">
              {v.estimated_profit != null
                ? fmt(Number(v.estimated_profit))
                : "—"}
            </span>
          }
        />
        <DetailRow
          label="Recommended Max Bid"
          value={
            <span className="text-primary font-semibold">
              {v.recommended_max_bid != null
                ? fmt(Number(v.recommended_max_bid))
                : "—"}
            </span>
          }
        />
        <DetailRow label="Mileage" value={v.mileage?.toLocaleString() ?? "—"} />
        <DetailRow
          label="Profit Score"
          value={v.profit_score != null ? `${v.profit_score}/100` : "—"}
        />
      </div>
    </div>
  </>
);

export default LaneStrategy;
