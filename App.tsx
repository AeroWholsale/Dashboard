import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/Dashboard";
import ReorderQueue from "@/pages/ReorderQueue";
import SkuTemperature from "@/pages/SkuTemperature";
import RepriceQueue from "@/pages/RepriceQueue";
import PnL from "@/pages/PnL";
import Inventory from "@/pages/Inventory";
import Upload from "@/pages/Upload";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/reorder" component={ReorderQueue} />
      <Route path="/temperature" component={SkuTemperature} />
      <Route path="/reprice" component={RepriceQueue} />
      <Route path="/pnl" component={PnL} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/upload" component={Upload} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
