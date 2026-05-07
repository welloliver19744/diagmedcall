import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./components/AppLayout";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Clients from "./pages/Clients.tsx";
import Parts from "./pages/Parts.tsx";
import Reminders from "./pages/Reminders.tsx";
import Reports from "./pages/Reports.tsx";
import Team from "./pages/Team.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/parts" element={<Parts />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/team" element={<Team />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
