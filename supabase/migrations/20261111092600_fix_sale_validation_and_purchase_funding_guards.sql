-- Harden sales and purchase RPC validation.
-- Prevent null/empty sale payloads, duplicate-cart overselling, anonymous credit balances,
-- fake credit receipts, and purchases without a valid funding source/payment method.
CREATE OR REPLACE FUNCTION public.create_sale(p_store_id uuid, p_items jsonb, p_customer_id uuid DEFAULT NULL::uuid, p_amount_paid numeric DEFAULT 0, p_payment_method text DEFAULT 'cash'::text, p_discount numeric DEFAULT 0, p_tax numeric DEFAULT 0, p_notes text DEFAULT NULL::text, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(sale_id uuid, receipt_no text, subtotal numeric, total numeric, amount_paid numeric, balance_due numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_sale_id uuid;
  v_receipt text;
  v_subtotal numeric(14,2) := 0;
  v_total numeric(14,2);
  v_discount numeric(14,2) := coalesce(p_discount,0);
  v_tax numeric(14,2) := coalesce(p_tax,0);
  v_paid numeric(14,2) := coalesce(p_amount_paid,0);
  v_item jsonb;
  v_product_id uuid;
  v_qty numeric(14,3);
  v_name text;
  v_sku text;
  v_price numeric(14,4);
  v_cost numeric(14,4);
  v_line numeric(14,2);
  v_old_qty numeric(14,3);
  v_requested_qty numeric(14,3);
  v_retail_unit numeric(14,4);
  v_wholesale_unit numeric(14,4);
  v_method text := coalesce(p_payment_method,'cash');
  v_sold_at timestamptz := now();
  v_entry_mode text := 'live';
  v_notes text := p_notes;
begin
  if coalesce(p_notes,'') like 'AMWEMARI_META|%' then
    v_entry_mode := split_part(p_notes,'|',2);
    if v_entry_mode not in ('live','day_end') then raise exception 'Invalid sale entry mode'; end if;
    v_sold_at := split_part(p_notes,'|',3)::timestamptz;
    if v_sold_at is null or v_sold_at > now() + interval '5 minutes' then raise exception 'Invalid sale timestamp'; end if;
    v_notes := nullif(regexp_replace(p_notes, '^AMWEMARI_META[|][^|]+[|][^|]+[|]', ''), '');
  end if;
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not private.is_store_member(p_store_id) then raise exception 'You are not a member of this store'; end if;
  if not exists (select 1 from public.stores s where s.id=p_store_id and s.is_active=true) then raise exception 'Store not found or inactive'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'At least one sale item is required'; end if;
  if v_paid<0 or v_discount<0 or v_tax<0 then raise exception 'Payment, discount and tax cannot be negative'; end if;
  if v_method not in ('cash','mobile_money','card','bank','credit','mixed') then raise exception 'Unsupported payment method'; end if;

  if p_request_id is not null then
    select s.id into v_sale_id from public.sales s where s.store_id=p_store_id and s.request_id=p_request_id;
    if v_sale_id is not null then
      return query select s.id,s.receipt_no,s.subtotal,s.total,s.amount_paid,greatest(s.total-s.amount_paid,0) from public.sales s where s.id=v_sale_id;
      return;
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(p_items) order by (value->>'product_id')
  loop
    if coalesce(v_item->>'product_id','')='' then raise exception 'Each item must include product_id'; end if;
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;
    if v_qty is null or v_qty<=0 then raise exception 'Item quantity must be greater than zero'; end if;
    select p.name,p.sku,p.selling_price,p.cost_price,p.quantity,p.selling_price,p.wholesale_pack_price/nullif(p.units_per_pack,0)
      into v_name,v_sku,v_price,v_cost,v_old_qty,v_retail_unit,v_wholesale_unit
    from public.products p where p.id=v_product_id and p.store_id=p_store_id and p.is_active=true for update;
    if not found then raise exception 'Product not found, inactive, or belongs to another store: %',v_product_id; end if;
    if nullif(v_item->>'unit_price','') is not null then v_price := (v_item->>'unit_price')::numeric; end if;
    if v_price<0 then raise exception 'Sale unit price cannot be negative'; end if;
    if abs(v_price-v_retail_unit)>0.0001 and (v_wholesale_unit is null or v_wholesale_unit<=0 or abs(v_price-v_wholesale_unit)>0.0001) then
      raise exception 'Sale price must match the product retail or wholesale price';
    end if;
    select coalesce(sum((value->>'quantity')::numeric),0) into v_requested_qty
    from jsonb_array_elements(p_items)
    where (value->>'product_id')::uuid=v_product_id;
    if v_old_qty<v_requested_qty then raise exception 'Insufficient stock for %. Available: %, requested: %',v_name,v_old_qty,v_requested_qty; end if;
    v_line := round(v_price*v_qty,2);
    v_subtotal := v_subtotal+v_line;
  end loop;

  v_subtotal := round(v_subtotal,2);
  v_total := round(v_subtotal+v_tax-v_discount,2);
  if v_method='credit' and v_paid>0 then raise exception 'Choose an actual payment method for money received; credit is only the unpaid balance.'; end if;
  if v_paid<v_total and p_customer_id is null then raise exception 'A customer is required for an unpaid or credit sale.'; end if;
  if v_discount>v_subtotal+v_tax then raise exception 'Discount cannot exceed subtotal plus tax'; end if;
  if v_paid>v_total then raise exception 'Amount paid cannot exceed sale total'; end if;
  if p_customer_id is not null and not exists(select 1 from public.customers c where c.id=p_customer_id and c.store_id=p_store_id) then raise exception 'Customer does not belong to this store'; end if;

  v_sale_id := gen_random_uuid();
  v_receipt := 'RCP-'||to_char(clock_timestamp(),'YYYYMMDD-HH24MISS')||'-'||upper(substr(replace(v_sale_id::text,'-',''),1,8));
  insert into public.sales(id,store_id,customer_id,sold_by,receipt_no,request_id,subtotal,discount,tax,total,amount_paid,payment_method,status,notes,sold_at,entry_mode)
  values(v_sale_id,p_store_id,p_customer_id,v_user_id,v_receipt,p_request_id,v_subtotal,v_discount,v_tax,v_total,v_paid,v_method,'completed',v_notes,v_sold_at,v_entry_mode);

  for v_item in select value from jsonb_array_elements(p_items) order by (value->>'product_id')
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;
    select p.name,p.sku,p.selling_price,p.cost_price into v_name,v_sku,v_price,v_cost
    from public.products p where p.id=v_product_id and p.store_id=p_store_id for update;
    if nullif(v_item->>'unit_price','') is not null then v_price := (v_item->>'unit_price')::numeric; end if;
    v_line := round(v_price*v_qty,2);
    insert into public.sale_items(store_id,sale_id,product_id,product_name_snapshot,sku_snapshot,quantity,unit_price,unit_cost,discount,line_total)
    values(p_store_id,v_sale_id,v_product_id,v_name,v_sku,v_qty,v_price,v_cost,0,v_line);
    update public.products set quantity=quantity-v_qty,updated_at=now() where id=v_product_id and store_id=p_store_id;
    insert into public.stock_movements(store_id,product_id,movement_type,quantity_change,unit_cost,reference_type,reference_id,note,performed_by)
    values(p_store_id,v_product_id,'sale',-v_qty,v_cost,'sale',v_sale_id,'Stock deducted by completed sale',v_user_id);
  end loop;

  if p_customer_id is not null and v_paid>0 then
    insert into public.customer_payments(store_id,customer_id,sale_id,amount,payment_method,received_by,notes)
    values(p_store_id,p_customer_id,v_sale_id,v_paid,v_method,v_user_id,'Payment received at point of sale');
  end if;
  return query select v_sale_id,v_receipt,v_subtotal,v_total,v_paid,greatest(v_total-v_paid,0);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.record_purchase_with_funding(p_store_id uuid, p_product_id uuid, p_package_quantity numeric, p_loose_units numeric, p_package_cost numeric, p_purchase_date date, p_note text, p_funding_source text, p_payment_method text DEFAULT 'cash'::text, p_lender_name text DEFAULT NULL::text, p_loan_due_date date DEFAULT NULL::date)
 RETURNS TABLE(quantity_added numeric, total_cost numeric, new_stock numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_units numeric(14,3);
  v_total_cost numeric(14,2);
  v_loan_type text;
  v_payment_method text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not private.is_store_owner(p_store_id) then raise exception 'Only the store owner can record purchases'; end if;
  if p_funding_source is null or p_funding_source not in ('business_cash','owner_capital','business_loan','supplier_credit') then
    raise exception 'Invalid purchase funding source';
  end if;

  select units_per_pack into v_units
  from public.products
  where id=p_product_id and store_id=p_store_id and is_active=true
  for update;

  if not found or v_units is null or v_units <= 0 then
    raise exception 'Product not found or invalid package units';
  end if;

  v_total_cost := round(
    (coalesce(p_package_quantity,0) * coalesce(p_package_cost,0)) +
    (coalesce(p_loose_units,0) * round(coalesce(p_package_cost,0)/v_units,4)),
    2
  );

  if v_total_cost <= 0 then raise exception 'Purchase total must be greater than zero'; end if;

  if p_funding_source in ('business_cash','owner_capital')
     and (p_payment_method is null or p_payment_method not in ('cash','mobile_money','bank','card')) then
    raise exception 'Choose a valid payment method';
  end if;

  if p_funding_source='owner_capital' then
    insert into public.store_capital_transactions(
      store_id,transaction_type,amount,payment_method,transaction_date,note,created_by
    ) values (
      p_store_id,'capital_cash_in',v_total_cost,p_payment_method,
      coalesce(p_purchase_date,current_date),
      coalesce(p_note,'Owner capital used for stock purchase'),v_user_id
    );
    v_payment_method := p_payment_method;
  elsif p_funding_source in ('business_loan','supplier_credit') then
    if nullif(trim(p_lender_name),'') is null then
      raise exception 'Enter the lender or supplier name';
    end if;
    v_loan_type := case when p_funding_source='business_loan' then 'business_loan' else 'supplier_credit' end;
    insert into public.store_business_loans(
      store_id,loan_type,lender_name,principal_amount,outstanding_amount,
      loan_date,due_date,note,created_by
    ) values (
      p_store_id,v_loan_type,trim(p_lender_name),v_total_cost,v_total_cost,
      coalesce(p_purchase_date,current_date),p_loan_due_date,p_note,v_user_id
    );
    -- The loan is recorded as a liability and is treated as supplier/credit-funded here,
    -- so it is not deducted from existing business cash a second time.
    v_payment_method := 'credit';
  else
    v_payment_method := p_payment_method;
  end if;

  return query
    select * from public.record_purchase_with_loose_units(
      p_store_id,p_product_id,p_package_quantity,p_loose_units,p_package_cost,
      p_purchase_date,p_note,v_payment_method
    );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.record_purchase_with_loose_units(p_store_id uuid, p_product_id uuid, p_package_quantity numeric, p_loose_units numeric, p_package_cost numeric, p_purchase_date date DEFAULT CURRENT_DATE, p_note text DEFAULT NULL::text, p_payment_method text DEFAULT 'cash'::text)
 RETURNS TABLE(quantity_added numeric, total_cost numeric, new_stock numeric)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_units numeric(14,3);
  v_unit_cost numeric(14,4);
  v_stock numeric(14,3);
  v_pack_name text;
  v_base_unit text;
  v_pack_qty numeric(14,3) := coalesce(p_package_quantity,0);
  v_loose numeric(14,3) := coalesce(p_loose_units,0);
  v_total_cost numeric(14,2);
  v_old_qty numeric(14,3);
  v_old_cost numeric(14,4);
  v_incoming numeric(14,3);
  v_avg numeric(14,4);
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT private.is_store_owner(p_store_id) THEN RAISE EXCEPTION 'Only the store owner can record purchases'; END IF;
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash','mobile_money','bank','card','credit') THEN RAISE EXCEPTION 'Invalid purchase payment method'; END IF;
  IF v_pack_qty < 0 OR v_loose < 0 OR (v_pack_qty=0 AND v_loose=0) THEN RAISE EXCEPTION 'Enter packages or loose units'; END IF;
  IF p_package_cost IS NULL OR p_package_cost < 0 THEN RAISE EXCEPTION 'Package cost cannot be negative'; END IF;

  SELECT units_per_pack,pack_name,base_unit,quantity,cost_price
  INTO v_units,v_pack_name,v_base_unit,v_old_qty,v_old_cost
  FROM public.products
  WHERE id=p_product_id AND store_id=p_store_id AND is_active=true
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found or inactive'; END IF;
  IF v_units IS NULL OR v_units <= 0 THEN RAISE EXCEPTION 'Invalid units per package'; END IF;

  v_unit_cost := round(p_package_cost/v_units,4);
  v_incoming := (v_pack_qty*v_units)+v_loose;
  v_total_cost := round((v_pack_qty*p_package_cost)+(v_loose*v_unit_cost),2);
  v_avg := CASE
    WHEN coalesce(v_old_qty,0)<=0 THEN v_unit_cost
    ELSE round(((v_old_qty*coalesce(v_old_cost,0))+(v_incoming*v_unit_cost))/(v_old_qty+v_incoming),4)
  END;

  UPDATE public.products
  SET quantity=quantity+v_incoming,cost_price=v_avg,purchase_pack_price=p_package_cost,updated_at=now()
  WHERE id=p_product_id AND store_id=p_store_id
  RETURNING quantity INTO v_stock;

  IF v_pack_qty>0 THEN
    INSERT INTO public.stock_movements(
      store_id,product_id,movement_type,quantity_change,unit_cost,
      package_quantity,package_label,purchase_date,total_cost,reference_type,note,performed_by,payment_method
    )
    VALUES(
      p_store_id,p_product_id,'purchase',v_pack_qty*v_units,v_unit_cost,
      v_pack_qty,v_pack_name,coalesce(p_purchase_date,current_date),round(v_pack_qty*p_package_cost,2),
      'purchase',p_note,v_user_id,p_payment_method
    );
  END IF;

  IF v_loose>0 THEN
    INSERT INTO public.stock_movements(
      store_id,product_id,movement_type,quantity_change,unit_cost,
      package_quantity,package_label,purchase_date,total_cost,reference_type,note,performed_by,payment_method
    )
    VALUES(
      p_store_id,p_product_id,'purchase',v_loose,v_unit_cost,
      NULL,v_base_unit,coalesce(p_purchase_date,current_date),round(v_loose*v_unit_cost,2),
      'purchase',p_note,v_user_id,p_payment_method
    );
  END IF;

  RETURN QUERY SELECT v_incoming,v_total_cost,v_stock;
END;
$function$
;
