import { MantineProvider, Text } from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import "./App.css";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { AgendaPage } from "./features/agenda/AgendaPage";
import { LoginPage } from "./features/auth/LoginPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { DutiesPage } from "./features/duties/DutiesPage";
import { FinancialPage } from "./features/financial/FinancialPage";
import { LandingPage } from "./features/landing/LandingPage";
import { LunchesPage } from "./features/lunch/LunchesPage";
import { PackagesPage } from "./features/lunch/PackagesPage";
import { MembersPage } from "./features/members/MembersPage";
import { PublicRegistrationPage } from "./features/public-registration/PublicRegistrationPage";
import { queryClient } from "./shared/queryClient";
import { theme } from "./shared/theme";

function LegacyPanelRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}

function App() {
  return (
    <MantineProvider defaultColorScheme="light" theme={theme}>
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/cadastro" element={<PublicRegistrationPage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route element={<RequireAuth />}>
            <Route path="/painel" element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="agenda" element={<AgendaPage />} />
              <Route path="financeiro" element={<FinancialPage />} />
              <Route path="lunches" element={<LunchesPage />} />
              <Route path="pacotes" element={<PackagesPage />} />
              <Route path="integrantes" element={<MembersPage />} />
              <Route path="funcoes" element={<DutiesPage />} />
            </Route>
          </Route>

          <Route path="/agenda" element={<LegacyPanelRedirect to="/painel/agenda" />} />
          <Route path="/financeiro" element={<LegacyPanelRedirect to="/painel/financeiro" />} />
          <Route path="/lunches" element={<LegacyPanelRedirect to="/painel/lunches" />} />
          <Route path="/pacotes" element={<LegacyPanelRedirect to="/painel/pacotes" />} />
          <Route path="/integrantes" element={<LegacyPanelRedirect to="/painel/integrantes" />} />
          <Route path="/funcoes" element={<LegacyPanelRedirect to="/painel/funcoes" />} />

          <Route path="*" element={<Text>Página não encontrada.</Text>} />
        </Routes>
      </QueryClientProvider>
    </MantineProvider>
  );
}

export default App;
