import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import AuthGateway from "./pages/AuthGateway";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import DeleteData from "./pages/DeleteData";
import Onboarding from "./pages/Onboarding";
import Chat from "./pages/Chat";
import CompanyDashboard from "./pages/CompanyDashboard";
import CompanyTransactions from "./pages/CompanyTransactions";
import CompanyFixedCosts from "./pages/CompanyFixedCosts";
import Debug from "./pages/Debug";
import CacheTest from "./pages/CacheTest";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import RootDomainOnly from "./components/RootDomainOnly";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/termos" element={<Terms />} />
          <Route path="/privacidade" element={<Privacy />} />
          <Route path="/delete-data" element={<DeleteData />} />
          <Route path="/auth" element={<AuthGateway />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/company/dashboard" element={
            <ProtectedRoute>
              <CompanyDashboard />
            </ProtectedRoute>
          } />
          <Route path="/company/transactions" element={
            <ProtectedRoute>
              <CompanyTransactions />
            </ProtectedRoute>
          } />
          <Route path="/company/fixed-costs" element={
            <ProtectedRoute>
              <CompanyFixedCosts />
            </ProtectedRoute>
          } />
          <Route path="/chat" element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          } />
          <Route path="/debug" element={
            <ProtectedRoute>
              <Debug />
            </ProtectedRoute>
          } />
          <Route path="/cache-test" element={
            <ProtectedRoute>
              <CacheTest />
            </ProtectedRoute>
          } />
          <Route path="/admin/login" element={
            <RootDomainOnly>
              <AdminLogin />
            </RootDomainOnly>
          } />
          <Route path="/admin" element={
            <RootDomainOnly>
              <ProtectedRoute redirectTo="/admin/login">
                <Admin />
              </ProtectedRoute>
            </RootDomainOnly>
          } />
          <Route path="/company/chat" element={<Navigate to="/chat" replace />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
