import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Thermometer, 
  RefreshCcw, 
  DollarSign, 
  Package,
  Upload,
  Menu,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { GlobalSearch } from "@/components/GlobalSearch";

interface DashboardLayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { label: "Daily Pulse", icon: LayoutDashboard, href: "/" },
  { label: "Reorder Queue", icon: ShoppingCart, href: "/reorder" },
  { label: "SKU Temperature", icon: Thermometer, href: "/temperature" },
  { label: "Reprice Queue", icon: RefreshCcw, href: "/reprice" },
  { label: "P&L / Channels", icon: DollarSign, href: "/pnl" },
  { label: "Inventory", icon: Package, href: "/inventory" },
  { label: "Data / Upload", icon: Upload, href: "/upload" },
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border/40 bg-card/30 backdrop-blur-xl hidden lg:flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <div className="h-4 w-4 rounded-sm bg-primary" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-white">Command Center</span>
          </div>
        </div>

        <div className="flex-1 px-4 space-y-1 overflow-y-auto py-4">
          <div className="px-2 pb-2 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
            Main Menu
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                ${isActive 
                  ? 'bg-primary/10 text-primary shadow-sm shadow-primary/5 border border-primary/20' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}
              `}>
                <item.icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground/70'}`} />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-border/40">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
            <Avatar className="h-9 w-9 border border-border">
              <AvatarImage src="" />
              <AvatarFallback className="bg-primary/20 text-primary">AW</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">Admin User</p>
              <p className="text-xs text-muted-foreground truncate">admin@aw-center.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 h-16 border-b border-border/40 bg-background/80 backdrop-blur-md flex items-center justify-between px-6">
          <div className="flex items-center gap-4 lg:hidden">
             <Button variant="ghost" size="icon" className="-ml-2">
               <Menu className="w-5 h-5" />
             </Button>
             <span className="font-display font-bold text-lg">AW CC v3</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
             <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono">
               System Status: Operational
             </span>
             <Separator orientation="vertical" className="h-4 mx-2" />
             <span>Last updated: just now</span>
          </div>

          <div className="flex items-center gap-3">
            <GlobalSearch />
            <Button variant="outline" size="icon" className="relative border-white/10 hover:bg-white/5">
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2.5 w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            </Button>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
