-- Ensure every store gets daily trend rows, even when no opening cash balance is configured.
-- Keep the view security-invoker so underlying RLS policies remain effective.
create or replace view public.store_financial_daily with (security_invoker=true) as
with stores_dates as (
 select st.id as store_id, d.d::date as report_date
 from public.stores st
 left join public.store_cash_settings cs on cs.store_id=st.id
 cross join lateral generate_series(
   coalesce(cs.opening_date,(st.created_at at time zone 'Africa/Dar_es_Salaam')::date)::timestamp,
   (now() at time zone 'Africa/Dar_es_Salaam')::date::timestamp,
   interval '1 day'
 ) d(d)
), daily_sales as (
 select s.store_id,(s.sold_at at time zone 'Africa/Dar_es_Salaam')::date as report_date,
        sum(s.total-s.tax)::numeric(14,2) as net_sales,
        sum(coalesce(x.cogs,0))::numeric(14,2) as cost_of_goods_sold
 from public.sales s
 left join lateral (
   select sum(si.quantity*si.unit_cost) as cogs
   from public.sale_items si where si.sale_id=s.id and si.store_id=s.store_id
 ) x on true
 where s.status='completed'
 group by s.store_id,(s.sold_at at time zone 'Africa/Dar_es_Salaam')::date
), daily_expenses as (
 select e.store_id,e.expense_date as report_date,sum(e.amount)::numeric(14,2) as expenses
 from public.expenses e group by e.store_id,e.expense_date
), daily_capital as (
 select c.store_id,c.transaction_date as report_date,
 sum(case when c.transaction_type in ('capital_cash_in','capital_stock_in') then c.amount else 0 end)::numeric(14,2) as capital_added,
 sum(case when c.transaction_type='owner_withdrawal' then c.amount else 0 end)::numeric(14,2) as owner_withdrawals
 from public.store_capital_transactions c group by c.store_id,c.transaction_date
), daily_purchases as (
 select sm.store_id,sm.purchase_date as report_date,
 sum(case when sm.movement_type='purchase' then sm.total_cost else 0 end)::numeric(14,2) as stock_purchases
 from public.stock_movements sm group by sm.store_id,sm.purchase_date
), stock_as_of as (
 select sd.store_id,sd.report_date,
 coalesce(sum(greatest(0,coalesce(v.stock_value,0))),0)::numeric(14,2) as estimated_stock_value
 from stores_dates sd
 join public.products p on p.store_id=sd.store_id and p.is_active=true
 left join lateral (
   select sum(sm.quantity_change*sm.unit_cost) as stock_value
   from public.stock_movements sm
   left join public.sales sale_ref on sm.movement_type='sale' and sale_ref.id=sm.reference_id and sale_ref.store_id=sm.store_id
   where sm.store_id=p.store_id and sm.product_id=p.id
   and (case when sm.movement_type='sale' and sale_ref.sold_at is not null
        then (sale_ref.sold_at at time zone 'Africa/Dar_es_Salaam')::date
        else coalesce(sm.purchase_date,(sm.created_at at time zone 'Africa/Dar_es_Salaam')::date) end)<=sd.report_date
 ) v on true
 group by sd.store_id,sd.report_date
)
select sd.store_id,sd.report_date,
 coalesce(ds.net_sales,0)::numeric(14,2) as net_sales,
 coalesce(ds.cost_of_goods_sold,0)::numeric(14,2) as cost_of_goods_sold,
 coalesce(de.expenses,0)::numeric(14,2) as expenses,
 (coalesce(ds.net_sales,0)-coalesce(ds.cost_of_goods_sold,0)-coalesce(de.expenses,0))::numeric(14,2) as net_profit_loss,
 coalesce(dp.stock_purchases,0)::numeric(14,2) as stock_purchases,
 coalesce(dc.capital_added,0)::numeric(14,2) as capital_added,
 coalesce(dc.owner_withdrawals,0)::numeric(14,2) as owner_withdrawals,
 sum(coalesce(ds.net_sales,0)-coalesce(ds.cost_of_goods_sold,0)-coalesce(de.expenses,0))
   over(partition by sd.store_id order by sd.report_date rows between unbounded preceding and current row)::numeric(14,2) as cumulative_profit_loss,
 coalesce(sa.estimated_stock_value,0)::numeric(14,2) as estimated_stock_value
from stores_dates sd
left join daily_sales ds using(store_id,report_date)
left join daily_expenses de using(store_id,report_date)
left join daily_capital dc using(store_id,report_date)
left join daily_purchases dp using(store_id,report_date)
left join stock_as_of sa using(store_id,report_date);
