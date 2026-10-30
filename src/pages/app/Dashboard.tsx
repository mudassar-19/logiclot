import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  BarChart3,
  Clock,
  Trophy,
  DollarSign,
  FileSpreadsheet,
  ChevronRight,
  Plus,
  ShieldCheck,
  TrendingUp,
  Activity,
  Percent,
  ArrowRight,
} from "lucide-react";
import { Chart } from "chart.js/auto";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import UploadRunListDialog from "@/components/dashboard/UploadRunListDialog";
import ProcessingScreen from "@/components/dashboard/ProcessingScreen";
import {
  fetchRunLists,
  invalidateRunListsCache,
  type RunListRow,
} from "@/lib/runListCache";
import {
  getCachedDashboardData,
  setCachedDashboardData,
  invalidateDashboardCache,
} from "@/lib/dashboardCache";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/TablePagination";

import manheimLogo from "@/assets/logos/manheim.webp";
import americasLogo from "@/assets/logos/americas-color.png";
import iaasLogo from "@/assets/logos/iaa-color.svg";
import adesaLogo from "@/assets/logos/adesa.jpg";
import carmaxLogo from "@/assets/logos/carmax-auctions.jpg";

const auctionLogos = [
  { name: "Manheim", src: manheimLogo },
  { name: "Americas", src: americasLogo },
  { name: "IAA", src: iaasLogo },
  { name: "ADESA", src: adesaLogo },
  { name: "CarMax Auctions", src: carmaxLogo },
];

const log = logger("Dashboard");

const Dashboard = () => {
  const { user, profile, organization } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [runLists, setRunLists] = useState<RunListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [runListCounts, setRunListCounts] = useState<
    Record<string, { total: number; rec: number }>
  >({});
  const [allRunListsOpen, setAllRunListsOpen] = useState(false);
  const [processingRunListId, setProcessingRunListId] = useState<string | null>(null);
  const [jsError, setJsError] = useState<{ message: string; stack: string | null; type: string } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('last_js_error');
      if (stored) {
        setJsError(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load local diagnostic error:', e);
    }
  }, []);

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const defaultOpenUpload = searchParams.get("upload") === "true";

  useEffect(() => {
    if (searchParams.get("upload") === "true") {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("upload");
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Database stats
  const [vehicleCount, setVehicleCount] = useState(0);
  const [purchasedCount, setPurchasedCount] = useState(0);
  const [passedCount, setPassedCount] = useState(0);
  const [totalSpend, setTotalSpend] = useState(0);
  const [totalProfitValue, setTotalProfitValue] = useState(0);

  // Buy List Health stats
  const [avgDaysSupply, setAvgDaysSupply] = useState(0);
  const [flaggedPct, setFlaggedPct] = useState(0);
  const [avgReconEst, setAvgReconEst] = useState(0);

  // Savings summary stats
  const [totalSavings, setTotalSavings] = useState(0);
  const [bestBuyText, setBestBuyText] = useState("—");
  const [overMaxBidText, setOverMaxBidText] = useState("0 of 0");

  // Rate limit usage counts
  const [uploadsToday, setUploadsToday] = useState(0);
  const [uploadsThisMonth, setUploadsThisMonth] = useState(0);

  // Chart data state
  const [chartData, setChartData] = useState<
    { week: string; profit: number }[]
  >([
    { week: "Wk 1", profit: 0 },
    { week: "Wk 2", profit: 0 },
    { week: "Wk 3", profit: 0 },
    { week: "Wk 4", profit: 0 },
    { week: "Wk 5", profit: 0 },
    { week: "Wk 6", profit: 0 },
    { week: "Wk 7", profit: 0 },
    { week: "Wk 8", profit: 0 },
  ]);

  const loadData = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);

    try {
      const cachedData = getCachedDashboardData(organization.id);
      const rl = await fetchRunLists(organization.id);

      if (cachedData) {
        setRunLists(rl);
        setVehicleCount(cachedData.vehicleCount);
        setPurchasedCount(cachedData.purchasedCount);
        setPassedCount(cachedData.passedCount);
        setTotalSpend(cachedData.totalSpend);
        setTotalProfitValue(cachedData.totalProfitValue);
        setAvgDaysSupply(cachedData.avgDaysSupply);
        setFlaggedPct(cachedData.flaggedPct);
        setAvgReconEst(cachedData.avgReconEst);
        setTotalSavings(cachedData.totalSavings);
        setBestBuyText(cachedData.bestBuyText);
        setOverMaxBidText(cachedData.overMaxBidText);
        setUploadsToday(cachedData.uploadsToday);
        setUploadsThisMonth(cachedData.uploadsThisMonth);
        setChartData(cachedData.chartData);
        setRunListCounts(cachedData.runListCounts);
        setLoading(false);
        return;
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const eightWeeksAgo = new Date();
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

      // Fetch metadata and counts in parallel
      const [
        countRes,
        healthRes,
        rlTodayRes,
        rlMonthRes,
        outcomesRes,
        weeklyRes,
      ] = await Promise.all([
        supabase
          .from("auction_vehicles")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", organization.id),
        supabase
          .from("auction_vehicles")
          .select("market_day_supply, estimated_recon_cost, risk_flags")
          .eq("organization_id", organization.id),
        supabase
          .from("auction_run_lists")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", organization.id)
          .gte("created_at", startOfDay.toISOString()),
        supabase
          .from("auction_run_lists")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", organization.id)
          .gte("created_at", startOfMonth.toISOString()),
        supabase
          .from("bidding_map_items")
          .select(
            `
            outcome,
            purchase_price,
            bidding_maps!inner(organization_id),
            auction_vehicles(estimated_profit, recommended_max_bid, make, model)
          `,
          )
          .eq("bidding_maps.organization_id", organization.id),
        supabase
          .from("bidding_map_items")
          .select(
            `
            created_at,
            purchase_price,
            bidding_maps!inner(organization_id),
            auction_vehicles(estimated_profit)
          `,
          )
          .eq("bidding_maps.organization_id", organization.id)
          .eq("outcome", "purchased")
          .gte("created_at", eightWeeksAgo.toISOString()),
      ]);

      setRunLists(rl);
      setVehicleCount(countRes.count || 0);
      setUploadsToday(rlTodayRes.count || 0);
      setUploadsThisMonth(rlMonthRes.count || 0);

      // Process health data
      let sumDaysSupply = 0;
      let countDaysSupply = 0;
      let sumRecon = 0;
      let countRecon = 0;
      let flaggedCount = 0;

      if (healthRes.data) {
        healthRes.data.forEach((h) => {
          if (h.market_day_supply != null) {
            sumDaysSupply += h.market_day_supply;
            countDaysSupply++;
          }
          if (h.estimated_recon_cost != null) {
            sumRecon += h.estimated_recon_cost;
            countRecon++;
          }
          if (h.risk_flags && h.risk_flags.length > 0) {
            flaggedCount++;
          }
        });
      }

      const calculatedAvgDaysSupply = countDaysSupply > 0 ? Math.round(sumDaysSupply / countDaysSupply) : 0;
      const calculatedAvgReconEst = countRecon > 0 ? Math.round(sumRecon / countRecon) : 0;
      const calculatedFlaggedPct = healthRes.data && healthRes.data.length > 0
        ? Math.round((flaggedCount / healthRes.data.length) * 100)
        : 0;

      setAvgDaysSupply(calculatedAvgDaysSupply);
      setAvgReconEst(calculatedAvgReconEst);
      setFlaggedPct(calculatedFlaggedPct);

      // Process outcomes
      let pCount = 0;
      let passCount = 0;
      let spend = 0;
      let profit = 0;
      let savings = 0;
      let maxSaving = -Infinity;
      let bestBuy = "—";
      let overBid = 0;

      const outcomesData = outcomesRes.data;
      if (outcomesData) {
        outcomesData.forEach((item) => {
          const make = item.auction_vehicles?.make || "";
          const model = item.auction_vehicles?.model || "";
          const maxBid = item.auction_vehicles?.recommended_max_bid || 0;
          const purchase = item.purchase_price || 0;
          const estProfit = item.auction_vehicles?.estimated_profit || 0;

          if (item.outcome === "purchased") {
            pCount++;
            spend += purchase;
            profit += estProfit;

            if (maxBid > 0 && purchase > 0) {
              const diff = maxBid - purchase;
              savings += diff;
              if (diff > maxSaving) {
                maxSaving = diff;
                bestBuy = `${make} ${model} · +$${Math.round(diff).toLocaleString()}`;
              }
              if (purchase > maxBid) {
                overBid++;
              }
            }
          } else if (item.outcome === "passed") {
            passCount++;
          }
        });
      }

      setPurchasedCount(pCount);
      setPassedCount(passCount);
      setTotalSpend(spend);
      setTotalProfitValue(profit);
      const calculatedTotalSavings = savings > 0 ? Math.round(savings) : 0;
      setTotalSavings(calculatedTotalSavings);
      setBestBuyText(bestBuy);
      const calculatedOverMaxBidText = `${overBid} of ${pCount}`;
      setOverMaxBidText(calculatedOverMaxBidText);

      // Process weekly trend data
      const weeklyData = weeklyRes.data;
      const weeksProfits = Array(8).fill(0);
      const weeksCounts = Array(8).fill(0);

      if (weeklyData) {
        weeklyData.forEach((item) => {
          const date = new Date(item.created_at);
          const diffTime = Math.abs(new Date().getTime() - date.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const weekIndex = 7 - Math.floor(diffDays / 7);
          if (weekIndex >= 0 && weekIndex < 8) {
            weeksProfits[weekIndex] +=
              item.auction_vehicles?.estimated_profit || 0;
            weeksCounts[weekIndex]++;
          }
        });
      }

      const computedChartData = Array(8)
        .fill(0)
        .map((_, i) => {
          const avg =
            weeksCounts[i] > 0
              ? Math.round(weeksProfits[i] / weeksCounts[i])
              : 0;
          return {
            week: `Wk ${i + 1}`,
            profit: avg,
          };
        });
      setChartData(computedChartData);

      // Fetch total and recommended counts for the top 5 run lists in parallel
      const topRunLists = rl.slice(0, 5);
      const countsPromises = topRunLists.map(async (item) => {
        const [totalRes, recRes] = await Promise.all([
          supabase
            .from("auction_vehicles")
            .select("*", { count: "exact", head: true })
            .eq("run_list_id", item.id),
          supabase
            .from("auction_vehicles")
            .select("*", { count: "exact", head: true })
            .eq("run_list_id", item.id)
            .in("ai_recommendation", ["Strong Buy", "Buy", "Possible Buy"]),
        ]);
        return {
          id: item.id,
          total: totalRes.count || 0,
          rec: recRes.count || 0,
        };
      });
      const counts = await Promise.all(countsPromises);
      const countsMap = Object.fromEntries(
        counts.map((c) => [c.id, { total: c.total, rec: c.rec }]),
      );
      setRunListCounts(countsMap);

      // Save to cache
      setCachedDashboardData(organization.id, {
        vehicleCount: countRes.count || 0,
        purchasedCount: pCount,
        passedCount: passCount,
        totalSpend: spend,
        totalProfitValue: profit,
        avgDaysSupply: calculatedAvgDaysSupply,
        flaggedPct: calculatedFlaggedPct,
        avgReconEst: calculatedAvgReconEst,
        totalSavings: calculatedTotalSavings,
        bestBuyText: bestBuy,
        overMaxBidText: calculatedOverMaxBidText,
        uploadsToday: rlTodayRes.count || 0,
        uploadsThisMonth: rlMonthRes.count || 0,
        chartData: computedChartData,
        runListCounts: countsMap,
      });
    } catch (err) {
      log.error("Failed to load dashboard data", err);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (location.hash === "#run-lists") {
      const el = document.getElementById("recent-run-lists");
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }
  }, [loading, location.hash]);

  const handleUploadSuccess = useCallback(() => {
    if (organization?.id) {
      invalidateRunListsCache(organization.id);
      invalidateDashboardCache(organization.id);
    }
    loadData();
  }, [organization?.id, loadData]);

  const runListPagination = usePagination(runLists, 5); // display 5 in dashboard view
  const processedCount = runLists.filter((r) => r.status === "ready").length;
  const hoursSaved = ((vehicleCount * 0.75) / 60).toFixed(1);

  const displayUnitsBought = purchasedCount;
  const displayWinRate =
    purchasedCount + passedCount > 0
      ? Math.round((purchasedCount / (purchasedCount + passedCount)) * 100)
      : 0;
  const displayAvgProfit =
    purchasedCount > 0 ? Math.round(totalProfitValue / purchasedCount) : 0;
  const displayROI =
    totalSpend > 0 ? ((totalProfitValue / totalSpend) * 100).toFixed(1) : "0.0";

  // Greeting Text
  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return "Good morning";
    if (hours < 18) return "Good afternoon";
    return "Good evening";
  };
  const firstName = profile?.full_name?.split(" ")[0] || "Marcus";
  const currentDateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const nextAuctionName =
    runLists.length > 0
      ? `${runLists[0].auction_source || "Auction"} (${runLists[0].auction_name || "Next runs"})`
      : "Manheim Atlanta";
  const greetingText = `${getGreeting()}, ${firstName} / ${currentDateStr} · ${nextAuctionName} runs today`;

  useEffect(() => {
    if (!chartRef.current || loading) return;

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    chartInstanceRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: chartData.map((d) => d.week),
        datasets: [
          {
            label: "Avg Profit",
            data: chartData.map((d) => d.profit),
            backgroundColor: "#185FA5",
            borderRadius: 4,
            maxBarThickness: 40,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (context) => `$${context.raw?.toLocaleString()}`,
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              font: {
                size: 11,
              },
              color: "#888888",
            },
          },
          y: {
            grid: {
              color: "#E5E7EB",
            },
            ticks: {
              font: {
                size: 11,
              },
              color: "#888888",
              callback: (value) => `$${value}`,
            },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [loading, chartData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {jsError && (
        <div className="bg-red-50/90 border border-red-200 rounded-xl p-4 text-red-800 text-xs font-mono relative">
          <button 
            onClick={() => {
              localStorage.removeItem('last_js_error');
              setJsError(null);
            }} 
            className="absolute top-2 right-2 text-red-500 hover:text-red-700 font-bold"
          >
            ✕
          </button>
          <div className="font-bold mb-1">⚠️ JavaScript Runtime Error Captured ({jsError.type})</div>
          <div className="mb-2 font-semibold">{jsError.message}</div>
          {jsError.stack && (
            <pre className="bg-red-100/50 p-2 rounded max-h-40 overflow-y-auto whitespace-pre-wrap">
              {jsError.stack}
            </pre>
          )}
        </div>
      )}
      {/* ZONE 1: TOP BAR GREETING & PRIMARY CTA */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 py-2 border-b border-border">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
            {getGreeting()}, {firstName}
          </h2>
          <p className="text-xs font-semibold text-muted-foreground mt-1">
            {currentDateStr} · {nextAuctionName} runs today
          </p>
        </div>
        {organization?.id && user?.id && (
          <div data-tour="dash-upload-btn" className="flex-shrink-0">
            <UploadRunListDialog
              organizationId={organization.id}
              userId={user.id}
              onUploadStart={setProcessingRunListId}
              defaultOpen={defaultOpenUpload}
            />
          </div>
        )}
      </div>

      {/* ZONE 2: KPI ROW (6 CARDS - 2 ROWS OF 3) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Units bought (Green/Good) */}
        <Card className="bg-white border border-slate-200/80 shadow-md hover:shadow-xl hover:border-[#5A5AFF]/40 rounded-2xl transition-all duration-300">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Units Bought
              </p>
              <h3 className="text-3xl font-extrabold text-emerald-600 tabular-nums">
                {displayUnitsBought}
              </h3>
              <span className="inline-flex items-center text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                +12% vs prior month
              </span>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Trophy className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Avg Buy vs Max Bid (Amber/Caution) */}
        <Card className="bg-white border border-slate-200/80 shadow-md hover:shadow-xl hover:border-[#5A5AFF]/40 rounded-2xl transition-all duration-300">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Avg Buy vs Max Bid
              </p>
              <h3 className="text-3xl font-extrabold text-amber-600 tabular-nums">
                -$320
              </h3>
              <span className="inline-flex items-center text-[11px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                -15% margin safety gap
              </span>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-50">
              <ShieldCheck className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Est. Avg Profit/Unit (Green/Good) */}
        <Card className="bg-white border border-slate-200/80 shadow-md hover:shadow-xl hover:border-[#5A5AFF]/40 rounded-2xl transition-all duration-300">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Est. Avg Profit/Unit
              </p>
              <h3 className="text-3xl font-extrabold text-emerald-600 tabular-nums">
                ${displayAvgProfit.toLocaleString()}
              </h3>
              <span className="inline-flex items-center text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                +8.5% margin improvement
              </span>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Time Saved (Blue/Informational) */}
        <Card className="bg-white border border-slate-200/80 shadow-md hover:shadow-xl hover:border-[#5A5AFF]/40 rounded-2xl transition-all duration-300">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Time Saved
              </p>
              <h3 className="text-3xl font-extrabold text-blue-600 tabular-nums">
                {hoursSaved} hrs
              </h3>
              <span className="inline-flex items-center text-[11px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                75% faster lists analysis
              </span>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Win Rate (Green/Good) */}
        <Card className="bg-white border border-slate-200/80 shadow-md hover:shadow-xl hover:border-[#5A5AFF]/40 rounded-2xl transition-all duration-300">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Win Rate
              </p>
              <h3 className="text-3xl font-extrabold text-emerald-600 tabular-nums">
                {displayWinRate}%
              </h3>
              <span className="inline-flex items-center text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                +4.2% win probability
              </span>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Percent className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 6: ROI This Month (Blue/Informational) */}
        <Card className="bg-white border border-slate-200/80 shadow-md hover:shadow-xl hover:border-[#5A5AFF]/40 rounded-2xl transition-all duration-300">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                ROI This Month
              </p>
              <h3 className="text-3xl font-extrabold text-blue-600 tabular-nums">
                {displayROI}%
              </h3>
              <span className="inline-flex items-center text-[11px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                +2.1% net yield increase
              </span>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ZONE 3: MIDDLE PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Wider): Avg Profit Chart */}
        <Card className="lg:col-span-2 bg-white border border-slate-200/80 shadow-md hover:shadow-xl hover:border-[#5A5AFF]/40 rounded-2xl transition-all duration-300">
          <CardHeader className="py-4 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Est. Avg Profit
              Per Unit — Last 8 Weeks
            </CardTitle>
            <CardDescription className="text-xs">
              Visual tracking of front-end margins
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[250px] w-full relative">
              <canvas ref={chartRef} />
            </div>
          </CardContent>
        </Card>

        {/* Right Column (Narrower): Buy List Health & Usage */}
        <Card className="bg-white border border-slate-200/80 shadow-md hover:shadow-xl hover:border-[#5A5AFF]/40 rounded-2xl transition-all duration-300">
          <CardHeader className="py-4 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Buy List Health
            </CardTitle>
            <CardDescription className="text-xs">
              Summary of current inventory analysis metrics
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100 text-xs">
              <div>
                <span className="text-muted-foreground block">
                  Cars on List
                </span>
                <span className="text-base font-bold text-foreground">
                  {vehicleCount.toLocaleString()} units
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">
                  Avg Days Supply
                </span>
                <span className="text-base font-bold text-foreground">
                  {avgDaysSupply} days
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Flagged %</span>
                <span className="text-base font-bold text-destructive">
                  {flaggedPct}%
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">
                  Avg Recon Est.
                </span>
                <span className="text-base font-bold text-foreground">
                  ${avgReconEst.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Run-List-Usage Progress Bars */}
            <div className="space-y-3 pt-1">
              <h4 className="text-[11.5px] font-bold text-foreground uppercase tracking-wider">
                Run List Usage & Limits
              </h4>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground">Today's Uploads</span>
                  <span className="text-foreground">
                    {uploadsToday} / 100 limit
                  </span>
                </div>
                <Progress value={(uploadsToday / 100) * 100} className="h-2" />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground">
                    This Month's Uploads
                  </span>
                  <span className="text-foreground">
                    {uploadsThisMonth} / 1,000 limit
                  </span>
                </div>
                <Progress
                  value={(uploadsThisMonth / 1000) * 100}
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ZONE 4: BOTTOM ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel A: Recent Run Lists */}
        <Card
          id="recent-run-lists"
          className="bg-white border border-slate-200/80 shadow-md hover:shadow-xl hover:border-[#5A5AFF]/40 rounded-2xl transition-all duration-300 flex flex-col justify-between"
        >
          <CardHeader className="py-4 border-b border-slate-100 flex flex-row items-center justify-between flex-shrink-0">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <FileSpreadsheet className="h-4 w-4 text-primary" /> Recent Run
                Lists
              </CardTitle>
              <CardDescription className="text-xs">
                {runLists.length} total run lists
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col justify-between">
            {runLists.length === 0 ? (
              <div className="py-12 text-center my-auto">
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  No run lists uploaded yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 flex-1">
                {runLists.slice(0, 3).map((rl) => {
                  const counts = runListCounts[rl.id] || { total: 0, rec: 0 };
                  return (
                    <div
                      key={rl.id}
                      className="p-4 flex items-center justify-between hover:bg-muted/10 cursor-pointer transition-colors"
                      onClick={() => {
                        if (rl.status === "ready") {
                          navigate(`/app/buy-list?run_list_id=${rl.id}`);
                        } else if (rl.status === "processing" || rl.status === "uploaded") {
                          setProcessingRunListId(rl.id);
                        } else {
                          toast.info(`This run list is currently ${rl.status}`);
                        }
                      }}
                    >
                      <div className="space-y-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground text-sm truncate">
                            {rl.auction_name || "—"}
                          </span>
                          <Badge
                            className={cn(
                              "text-[9px] px-1.5 py-0 capitalize border-0 font-bold",
                              rl.status === "uploaded" &&
                                "bg-sky-100 text-sky-700",
                              rl.status === "processing" &&
                                "bg-[#5A5AFF]/15 text-[#5A5AFF] animate-pulse",
                              rl.status === "ready" &&
                                "bg-emerald-100 text-emerald-700",
                              rl.status === "failed" &&
                                "bg-red-100 text-red-700",
                            )}
                          >
                            {rl.status === "ready"
                              ? `${counts.rec} rec.`
                              : rl.status}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {rl.status === "ready"
                            ? `${counts.total} cars`
                            : "Parsing file"}{" "}
                          ·{" "}
                          {rl.auction_date
                            ? new Date(rl.auction_date).toLocaleDateString(
                                undefined,
                                { month: "short", day: "numeric" },
                              )
                            : "—"}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
            <div className="p-3 border-t border-slate-100 text-center flex-shrink-0">
              <Button
                variant="link"
                size="sm"
                onClick={() => setAllRunListsOpen(true)}
                className="text-xs font-semibold text-primary hover:text-primary/80 hover:underline flex items-center justify-center gap-1 mx-auto h-7"
              >
                View all run lists <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Panel B: Savings summary */}
        <Card className="bg-white border border-slate-200/80 shadow-md hover:shadow-xl hover:border-[#5A5AFF]/40 rounded-2xl transition-all duration-300 flex flex-col justify-between">
          <CardHeader className="py-4 border-b border-slate-100 flex-shrink-0">
            <CardTitle className="text-sm font-semibold text-foreground">
              Savings summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1 flex flex-col justify-between">
            <div className="space-y-1 mb-4">
              <h3 className="text-3xl font-extrabold text-blue-600 tabular-nums">
                ${totalSavings.toLocaleString()}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Est. saved vs paying max bid this month
              </p>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-muted-foreground">Best buy</span>
                <span className="font-semibold text-emerald-600">
                  {bestBuyText}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-muted-foreground">Over max bid</span>
                <span className="font-semibold text-foreground">
                  {overMaxBidText}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-muted-foreground">Subscription cost</span>
                <span className="font-semibold text-foreground">$199</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">ROI this month</span>
                <span className="font-bold text-blue-600">
                  {totalSavings > 0
                    ? `${(totalSavings / 199).toFixed(1)}x`
                    : "0x"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Panel C: Works With Auctions Compatibility Logos */}
        <Card className="bg-white border border-slate-200/80 shadow-md hover:shadow-xl hover:border-[#5A5AFF]/40 rounded-2xl transition-all duration-300 flex flex-col justify-between">
          <CardContent className="p-4 flex-1 flex flex-col justify-between h-full">
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider text-center">
                Works with these auctions — and any run list
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 py-2">
                {auctionLogos.map((logo) => (
                  <div
                    key={logo.name}
                    className="flex flex-col items-center gap-1 opacity-90 hover:opacity-100 transition-opacity bg-white p-1.5 sm:p-2 rounded-xl border shadow-sm"
                  >
                    <img
                      src={logo.src}
                      alt={logo.name}
                      className="h-5 w-12 sm:h-6 sm:w-16 object-contain bg-white"
                    />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                + many more · any CSV or PDF run list
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 text-xs text-muted-foreground text-center leading-relaxed mt-auto">
              Upload any run list from any auction house. LogicLot parses it
              automatically — no integrations needed.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog for viewing all run lists */}
      <Dialog open={allRunListsOpen} onOpenChange={setAllRunListsOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              All Uploaded Run Lists
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <Table className="text-xs">
              <TableHeader className="border-t border-b-2 border-slate-300 bg-slate-200 hover:bg-slate-300">
                <TableRow className="bg-muted/30">
                  <TableHead>Auction Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runListPagination.pageItems.map((rl) => (
                  <TableRow key={rl.id} className="hover:bg-muted/20">
                    <TableCell className="font-semibold text-foreground">
                      {rl.auction_name || "—"}
                    </TableCell>
                    <TableCell>{rl.auction_source || "—"}</TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-[140px]">
                      {rl.file_name}
                    </TableCell>
                    <TableCell>
                      {rl.auction_date
                        ? new Date(rl.auction_date).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          rl.status === "ready"
                            ? "default"
                            : rl.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                        className={cn(
                          "text-[10px] px-1.5 py-0 capitalize border-0",
                          rl.status === "uploaded" && "bg-sky-100 text-sky-700",
                          rl.status === "processing" &&
                            "bg-[#5A5AFF]/15 text-[#5A5AFF] animate-pulse",
                          rl.status === "ready" &&
                            "bg-emerald-100 text-emerald-700",
                          rl.status === "failed" && "bg-red-100 text-red-700",
                        )}
                      >
                        {rl.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {rl.status === "ready" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAllRunListsOpen(false);
                            navigate(`/app/buy-list?run_list_id=${rl.id}`);
                          }}
                          className="h-7 text-xs gap-0.5 text-primary hover:text-primary/80"
                        >
                          Open <ChevronRight className="h-3 w-3" />
                        </Button>
                      ) : rl.status === "processing" || rl.status === "uploaded" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAllRunListsOpen(false);
                            setProcessingRunListId(rl.id);
                          }}
                          className="h-7 text-xs gap-0.5 text-[#5A5AFF] hover:text-[#5A5AFF]/80 font-semibold"
                        >
                          Resume <ChevronRight className="h-3 w-3" />
                        </Button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          Failed
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 font-sans">
              <TablePagination
                page={runListPagination.page}
                totalPages={runListPagination.totalPages}
                totalItems={runListPagination.totalItems}
                pageSize={runListPagination.pageSize}
                onPageChange={runListPagination.setPage}
                onPageSizeChange={runListPagination.setPageSize}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {processingRunListId && organization?.id && (
        <ProcessingScreen
          runListId={processingRunListId}
          organizationId={organization.id}
          onError={() => {
            setProcessingRunListId(null);
            handleUploadSuccess();
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
