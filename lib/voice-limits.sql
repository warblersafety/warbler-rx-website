-- Apply once to the dedicated website admission database. Production and Preview
-- must use this same database; do not create a branch per deployment.
CREATE SCHEMA IF NOT EXISTS voice_demo;
REVOKE ALL ON SCHEMA voice_demo FROM PUBLIC;

CREATE TABLE IF NOT EXISTS voice_demo.admissions (
  agent_id text PRIMARY KEY,
  entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  CHECK (jsonb_typeof(entries) = 'array' AND jsonb_array_length(entries) <= 10)
);
REVOKE ALL ON TABLE voice_demo.admissions FROM PUBLIC;

CREATE OR REPLACE FUNCTION voice_demo.reserve_admission(
  requested_agent text,
  requested_visitor text,
  requested_network text,
  requested_limit integer DEFAULT 10
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  recent jsonb;
  at_ms bigint;
  cutoff_ms bigint;
  global_limit integer := LEAST(10, GREATEST(1, requested_limit));
  total_count integer;
  visitor_count integer;
  network_count integer;
  next_global bigint;
  next_visitor bigint;
  next_network bigint;
  retry_ms bigint := 0;
  blocked_by text;
BEGIN
  IF requested_agent IS NULL OR length(requested_agent) > 200
    OR requested_visitor !~ '^[a-f0-9]{64}$'
    OR requested_network !~ '^[a-f0-9]{64}$'
    OR requested_visitor IS NULL OR requested_network IS NULL THEN
    RAISE EXCEPTION 'Invalid admission identity';
  END IF;

  INSERT INTO voice_demo.admissions(agent_id) VALUES (requested_agent)
    ON CONFLICT DO NOTHING;
  -- Every serverless instance and deployment serializes admission on this row.
  SELECT entries INTO recent FROM voice_demo.admissions
    WHERE agent_id = requested_agent FOR UPDATE;
  -- Read database time after the lock: waiting requests cannot use a stale clock.
  at_ms := floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  cutoff_ms := at_ms - 86400000;
  SELECT COALESCE(jsonb_agg(entry ORDER BY (entry->>'at')::bigint), '[]'::jsonb)
    INTO recent FROM jsonb_array_elements(recent) AS entry
    WHERE (entry->>'at')::bigint > cutoff_ms;

  SELECT count(*), count(*) FILTER (WHERE entry->>'visitor' = requested_visitor),
    count(*) FILTER (WHERE entry->>'network' = requested_network)
    INTO total_count, visitor_count, network_count
    FROM jsonb_array_elements(recent) AS entry;

  IF total_count >= global_limit THEN
    SELECT (entry->>'at')::bigint + 86400000 INTO next_global
      FROM jsonb_array_elements(recent) AS entry
      ORDER BY (entry->>'at')::bigint OFFSET (total_count - global_limit) LIMIT 1;
    retry_ms := next_global - at_ms;
    blocked_by := 'global';
  END IF;
  IF visitor_count >= 3 THEN
    SELECT (entry->>'at')::bigint + 86400000 INTO next_visitor
      FROM jsonb_array_elements(recent) AS entry WHERE entry->>'visitor' = requested_visitor
      ORDER BY (entry->>'at')::bigint OFFSET (visitor_count - 3) LIMIT 1;
    retry_ms := GREATEST(retry_ms, next_visitor - at_ms);
    blocked_by := 'visitor';
  END IF;
  IF network_count >= 3 THEN
    SELECT (entry->>'at')::bigint + 86400000 INTO next_network
      FROM jsonb_array_elements(recent) AS entry WHERE entry->>'network' = requested_network
      ORDER BY (entry->>'at')::bigint OFFSET (network_count - 3) LIMIT 1;
    retry_ms := GREATEST(retry_ms, next_network - at_ms);
    blocked_by := COALESCE(blocked_by, 'network');
  END IF;

  IF blocked_by IS NOT NULL THEN
    UPDATE voice_demo.admissions SET entries = recent WHERE agent_id = requested_agent;
    RETURN jsonb_build_object('allowed', false, 'reason', blocked_by,
      'retryAfter', GREATEST(1, ceil(retry_ms / 1000.0)::integer));
  END IF;

  -- Reserve before asking ElevenLabs for a token. Never refund an uncertain token
  -- response: a timeout could still have issued a usable token upstream.
  recent := recent || jsonb_build_array(jsonb_build_object(
    'at', at_ms, 'visitor', requested_visitor, 'network', requested_network));
  UPDATE voice_demo.admissions SET entries = recent WHERE agent_id = requested_agent;
  RETURN jsonb_build_object('allowed', true, 'reason', NULL, 'retryAfter', 0);
END;
$$;
REVOKE ALL ON FUNCTION voice_demo.reserve_admission(text, text, text, integer) FROM PUBLIC;
