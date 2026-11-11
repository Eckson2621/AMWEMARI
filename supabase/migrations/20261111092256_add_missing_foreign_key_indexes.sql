-- Add indexes for foreign keys that had no matching leading-column index.
DO $$
DECLARE
  fk record;
  cols text;
  idx_name text;
BEGIN
  FOR fk IN
    SELECT c.oid, c.conrelid, c.conname, c.conkey,
           n.nspname AS schema_name, t.relname AS table_name
    FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE c.contype='f' AND n.nspname='public'
    ORDER BY t.relname, c.conname
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_index i
      WHERE i.indrelid=fk.conrelid
        AND i.indisvalid AND i.indisready
        AND i.indpred IS NULL AND i.indexprs IS NULL
        AND (
          SELECT array_agg(x.attnum ORDER BY x.ord)
          FROM unnest(i.indkey) WITH ORDINALITY x(attnum,ord)
          WHERE x.ord <= cardinality(fk.conkey)
        ) = fk.conkey
    ) THEN
      SELECT string_agg(format('%I',a.attname),', ' ORDER BY k.ord)
        INTO cols
      FROM unnest(fk.conkey) WITH ORDINALITY k(attnum,ord)
      JOIN pg_attribute a ON a.attrelid=fk.conrelid AND a.attnum=k.attnum;
      idx_name := left('idx_'||fk.table_name||'_'||replace(fk.conname,'_fkey','')||'_fk', 60);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
                     idx_name,fk.schema_name,fk.table_name,cols);
    END IF;
  END LOOP;
END $$;
