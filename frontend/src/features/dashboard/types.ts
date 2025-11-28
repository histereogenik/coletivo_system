export type DashboardSummary = {
  monthly_balance_cents: number;
  entradas_cents: number;
  saidas_cents: number;
  members: {
    total: number;
    sustentadores: number;
    mensalistas: number;
    avulsos: number;
  };
  lunches: {
    average_daily_last_30_days: number;
    total_last_30_days: number;
    total_em_aberto: number;
    total: number;
  };
};
