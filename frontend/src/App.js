import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { PosProvider } from "@/context/PosContext";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import PlatformLayout from "@/components/PlatformLayout";
import Login from "@/pages/Login";
import DashboardPage from "@/pages/DashboardPage";
import POSPage from "@/pages/POSPage";
import OrdersPage from "@/pages/OrdersPage";
import ReportsPage from "@/pages/ReportsPage";
import OutletsPage from "@/pages/management/OutletsPage";
import CategoriesPage from "@/pages/management/CategoriesPage";
import ProductsPage from "@/pages/management/ProductsPage";
import VariantsPage from "@/pages/management/VariantsPage";
import PricesPage from "@/pages/management/PricesPage";
import DiscountsPage from "@/pages/management/DiscountsPage";
import PaymentMethodsPage from "@/pages/operations/PaymentMethodsPage";
import TaxServicePage from "@/pages/operations/TaxServicePage";
import ShiftsPage from "@/pages/operations/ShiftsPage";
import UsersPage from "@/pages/team/UsersPage";
import OutletProfilePage from "@/pages/settings/OutletProfilePage";
import HardwarePage from "@/pages/settings/HardwarePage";
import ReceiptSettingsPage from "@/pages/settings/ReceiptSettingsPage";
import SubscriptionPage from "@/pages/settings/SubscriptionPage";
import AccountPage from "@/pages/settings/AccountPage";
import PlatformTenantsPage from "@/pages/platform/PlatformTenantsPage";
import PlatformPlansPage from "@/pages/platform/PlatformPlansPage";

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center font-heading font-extrabold text-2xl text-primary-foreground animate-pulse">G</div>
        <p className="text-muted-foreground text-sm">Loading GLOO POS…</p>
      </div>
    </div>
  );
}

function Protected({ children, perm }) {
  const { session, hasPerm } = useAuth();
  const loc = useLocation();
  if (session === null) return <Loading />;
  if (session === false) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (session.user.role === "PLATFORM_ADMIN") return <Navigate to="/platform" replace />;
  if (perm && !hasPerm(perm)) return <Navigate to="/" replace />;
  return children;
}

function PlatformProtected({ children }) {
  const { session } = useAuth();
  const loc = useLocation();
  if (session === null) return <Loading />;
  if (session === false) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (session.user.role !== "PLATFORM_ADMIN") return <Navigate to="/" replace />;
  return children;
}

function TenantApp() {
  return (
    <PosProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Protected perm="dashboard.view"><DashboardPage /></Protected>} />
          <Route path="/pos" element={<Protected perm="pos.use"><POSPage /></Protected>} />
          <Route path="/orders" element={<Protected perm="orders.view"><OrdersPage /></Protected>} />
          <Route path="/reports" element={<Protected perm="reports.view"><ReportsPage /></Protected>} />
          <Route path="/management/outlets" element={<Protected perm="outlets.view"><OutletsPage /></Protected>} />
          <Route path="/management/categories" element={<Protected perm="catalog.manage"><CategoriesPage /></Protected>} />
          <Route path="/management/products" element={<Protected perm="catalog.manage"><ProductsPage /></Protected>} />
          <Route path="/management/variants" element={<Protected perm="catalog.manage"><VariantsPage /></Protected>} />
          <Route path="/management/prices" element={<Protected perm="catalog.manage"><PricesPage /></Protected>} />
          <Route path="/management/discounts" element={<Protected perm="catalog.manage"><DiscountsPage /></Protected>} />
          <Route path="/operations/payment-methods" element={<Protected perm="payments.manage"><PaymentMethodsPage /></Protected>} />
          <Route path="/operations/tax-service" element={<Protected perm="tax.manage"><TaxServicePage /></Protected>} />
          <Route path="/operations/shifts" element={<Protected perm="shifts.use"><ShiftsPage /></Protected>} />
          <Route path="/team/users" element={<Protected perm="users.view"><UsersPage /></Protected>} />
          <Route path="/settings/outlet-profile" element={<Protected><OutletProfilePage /></Protected>} />
          <Route path="/settings/hardware" element={<Protected><HardwarePage /></Protected>} />
          <Route path="/settings/receipt" element={<Protected><ReceiptSettingsPage /></Protected>} />
          <Route path="/settings/subscription" element={<Protected perm="subscription.view"><SubscriptionPage /></Protected>} />
          <Route path="/settings/account" element={<Protected><AccountPage /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </PosProvider>
  );
}

export default function App() {
  return (
    <div className="App dark">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/platform/*"
              element={
                <PlatformProtected>
                  <PlatformLayout>
                    <Routes>
                      <Route index element={<PlatformTenantsPage />} />
                      <Route path="plans" element={<PlatformPlansPage />} />
                      <Route path="*" element={<Navigate to="/platform" replace />} />
                    </Routes>
                  </PlatformLayout>
                </PlatformProtected>
              }
            />
            <Route path="/*" element={<TenantApp />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster position="top-center" richColors theme="dark" />
    </div>
  );
}
