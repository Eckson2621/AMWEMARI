-- Additive metadata column; IF NOT EXISTS also reconciles projects where it was applied manually.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_details jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.products.product_details IS 'Optional business-specific product attributes, such as vehicle make, model, year, chassis and registration details.';

-- Make product edit + stock adjustment + business-specific metadata one transaction.
CREATE OR REPLACE FUNCTION public.owner_edit_product_with_details(
 p_store_id uuid, p_product_id uuid, p_pin text, p_name text,
 p_base_unit text, p_pack_name text, p_units_per_pack numeric,
 p_purchase_pack_price numeric, p_selling_price numeric,
 p_wholesale_pack_price numeric, p_reorder_level numeric,
 p_stock_packs numeric, p_stock_loose_units numeric,
 p_product_details jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $function$
DECLARE v_pin_hash text; v_failed integer; v_locked timestamptz; v_product jsonb;
 v_old_qty numeric; v_old_cost numeric(14,4); v_new_qty numeric; v_delta numeric; v_new_cost numeric(14,4);
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Ingia kwanza.'; END IF;
 IF NOT private.is_store_owner(p_store_id) THEN RAISE EXCEPTION 'Mmiliki pekee ndiye anayeruhusiwa kuhariri bidhaa.'; END IF;
 SELECT pin_hash,failed_attempts,locked_until INTO v_pin_hash,v_failed,v_locked FROM private.store_owner_security WHERE store_id=p_store_id FOR UPDATE;
 IF v_pin_hash IS NULL THEN RAISE EXCEPTION 'Mmiliki hajaweka PIN ya kuhariri bidhaa bado.'; END IF;
 IF v_locked IS NOT NULL AND v_locked>now() THEN RAISE EXCEPTION 'PIN imefungwa kwa muda baada ya majaribio mengi. Jaribu baada ya dakika 15.'; END IF;
 IF extensions.crypt(coalesce(p_pin,''),v_pin_hash)<>v_pin_hash THEN
  UPDATE private.store_owner_security SET failed_attempts=CASE WHEN locked_until IS NOT NULL AND locked_until<=now() THEN 1 ELSE failed_attempts+1 END,
   locked_until=CASE WHEN (CASE WHEN locked_until IS NOT NULL AND locked_until<=now() THEN 1 ELSE failed_attempts+1 END)>=5 THEN now()+interval '15 minutes' ELSE NULL END,
   updated_at=now() WHERE store_id=p_store_id;
  RAISE EXCEPTION 'PIN ya mmiliki si sahihi.';
 END IF;
 IF coalesce(trim(p_name),'')='' OR coalesce(trim(p_base_unit),'')='' OR coalesce(trim(p_pack_name),'')=''
  OR p_units_per_pack<1 OR p_units_per_pack<>trunc(p_units_per_pack) OR p_purchase_pack_price<0
  OR p_selling_price<0 OR p_wholesale_pack_price<0 OR p_reorder_level<0
  OR p_stock_packs<0 OR p_stock_packs<>trunc(p_stock_packs)
  OR p_stock_loose_units<0 OR p_stock_loose_units<>trunc(p_stock_loose_units) THEN
  RAISE EXCEPTION 'Taarifa za bidhaa au stock si sahihi.';
 END IF;
 IF p_product_details IS NULL OR jsonb_typeof(p_product_details)<>'object' OR octet_length(p_product_details::text)>16384 THEN
  RAISE EXCEPTION 'Taarifa za ziada za bidhaa si sahihi au zimezidi ukubwa unaoruhusiwa.';
 END IF;
 UPDATE private.store_owner_security SET failed_attempts=0,locked_until=NULL,updated_at=now() WHERE store_id=p_store_id;
 SELECT quantity,cost_price INTO v_old_qty,v_old_cost FROM public.products
 WHERE id=p_product_id AND store_id=p_store_id AND is_active=true FOR UPDATE;
 IF v_old_qty IS NULL THEN RAISE EXCEPTION 'Bidhaa haikupatikana.'; END IF;
 v_new_qty:=(p_stock_packs*p_units_per_pack)+p_stock_loose_units; v_delta:=v_new_qty-v_old_qty;
 v_new_cost:=CASE WHEN v_old_qty<=0 THEN round(p_purchase_pack_price/p_units_per_pack,4) ELSE v_old_cost END;
 UPDATE public.products SET name=trim(p_name),base_unit=trim(p_base_unit),unit='pcs',pack_name=trim(p_pack_name),
  units_per_pack=p_units_per_pack,purchase_pack_price=p_purchase_pack_price,cost_price=v_new_cost,
  selling_price=p_selling_price,wholesale_pack_price=p_wholesale_pack_price,reorder_level=p_reorder_level,
  quantity=v_new_qty,product_details=p_product_details,updated_at=now()
 WHERE id=p_product_id AND store_id=p_store_id AND is_active=true RETURNING to_jsonb(products) INTO v_product;
 IF v_delta<>0 THEN
  INSERT INTO public.stock_movements(store_id,product_id,movement_type,quantity_change,unit_cost,reference_type,note,
   performed_by,package_quantity,package_label,purchase_date,total_cost)
  VALUES(p_store_id,p_product_id,'adjustment',v_delta,v_new_cost,'manual_edit',
   'Marekebisho ya stock kupitia kuhariri bidhaa',auth.uid(),p_stock_packs,trim(p_pack_name),current_date,
   CASE WHEN v_delta>0 THEN round(v_delta*v_new_cost,2) ELSE 0 END);
 END IF;
 RETURN v_product;
END;
$function$;
REVOKE ALL ON FUNCTION public.owner_edit_product_with_details(uuid,uuid,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.owner_edit_product_with_details(uuid,uuid,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,jsonb) TO authenticated;

-- Private failed-login ledger; only service_role can use the wrappers.
CREATE TABLE IF NOT EXISTS private.staff_login_attempts(username text NOT NULL,ip_hash text NOT NULL,attempted_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS staff_login_attempts_lookup_idx ON private.staff_login_attempts(username,ip_hash,attempted_at DESC);
ALTER TABLE private.staff_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.staff_login_attempts FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.staff_login_allowed(p_username text,p_ip_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','private'
AS $function$ DECLARE v_count integer; BEGIN
 DELETE FROM private.staff_login_attempts WHERE attempted_at<now()-interval '1 day';
 SELECT count(*) INTO v_count FROM private.staff_login_attempts
 WHERE username=lower(trim(p_username)) AND ip_hash=p_ip_hash AND attempted_at>now()-interval '15 minutes';
 RETURN v_count<10;
END; $function$;
CREATE OR REPLACE FUNCTION public.staff_login_record_failure(p_username text,p_ip_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','private'
AS $function$ BEGIN INSERT INTO private.staff_login_attempts(username,ip_hash) VALUES(lower(trim(p_username)),p_ip_hash); END; $function$;
CREATE OR REPLACE FUNCTION public.staff_login_clear_failures(p_username text,p_ip_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','private'
AS $function$ BEGIN DELETE FROM private.staff_login_attempts WHERE username=lower(trim(p_username)) AND ip_hash=p_ip_hash; END; $function$;
REVOKE ALL ON FUNCTION public.staff_login_allowed(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.staff_login_record_failure(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.staff_login_clear_failures(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.staff_login_allowed(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.staff_login_record_failure(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.staff_login_clear_failures(text,text) TO service_role;
