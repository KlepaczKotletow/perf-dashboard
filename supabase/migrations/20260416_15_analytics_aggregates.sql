-- Phase 4: pre-aggregate review_responses server-side so the analytics page
-- can load at 500+ employees without dragging tens of thousands of rows over
-- the wire and grinding through JS aggregation.
--
-- Scope: the single heaviest read path. Returns rating distribution + per
-- competency, per employee, per department, per function averages + overall.
-- The analytics page keeps its smaller queries (users, goals, cycles)
-- client-side and joins the RPC output to user metadata in JS.
--
-- SECURITY INVOKER so callers see only what RLS allows.

CREATE OR REPLACE FUNCTION public.get_analytics_response_aggregates(
  p_cycle_id uuid DEFAULT NULL,
  p_function_id uuid DEFAULT NULL,
  p_department text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid := auth_workspace_id();
  v_result jsonb;
BEGIN
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  WITH scoped_responses AS (
    SELECT
      rr.rating,
      rr.competency_id,
      c.name AS competency_name,
      c.category AS competency_category,
      ra.employee_id,
      u.department,
      l.job_family_id,
      jf.name AS function_name
    FROM review_responses rr
    JOIN review_assignments ra ON ra.id = rr.assignment_id
    JOIN performance_cycles pc ON pc.id = ra.cycle_id
    LEFT JOIN competencies c ON c.id = rr.competency_id
    LEFT JOIN users u ON u.id = ra.employee_id
    LEFT JOIN levels l ON l.id = u.level_id
    LEFT JOIN job_families jf ON jf.id = l.job_family_id
    WHERE pc.workspace_id = v_workspace_id
      AND rr.rating IS NOT NULL
      AND (p_cycle_id IS NULL OR ra.cycle_id = p_cycle_id)
      AND (p_function_id IS NULL OR l.job_family_id = p_function_id)
      AND (p_department IS NULL OR u.department = p_department)
  ),
  overall AS (
    SELECT AVG(rating)::numeric(5,2) AS avg_rating, COUNT(*) AS n
    FROM scoped_responses
  ),
  distribution AS (
    SELECT rating, COUNT(*) AS n FROM scoped_responses GROUP BY rating
  ),
  by_competency AS (
    SELECT
      competency_id,
      MAX(competency_name) AS name,
      MAX(competency_category) AS category,
      AVG(rating)::numeric(5,2) AS avg_rating,
      COUNT(*) AS n
    FROM scoped_responses
    WHERE competency_id IS NOT NULL
    GROUP BY competency_id
  ),
  by_employee AS (
    SELECT employee_id, AVG(rating)::numeric(5,2) AS avg_rating, COUNT(*) AS n
    FROM scoped_responses
    GROUP BY employee_id
  ),
  by_department AS (
    SELECT COALESCE(department, 'Unknown') AS name,
           AVG(rating)::numeric(5,2) AS avg_rating,
           COUNT(*) AS n
    FROM scoped_responses
    GROUP BY COALESCE(department, 'Unknown')
  ),
  by_function AS (
    SELECT COALESCE(function_name, 'Unknown') AS name,
           AVG(rating)::numeric(5,2) AS avg_rating,
           COUNT(*) AS n
    FROM scoped_responses
    GROUP BY COALESCE(function_name, 'Unknown')
  )
  SELECT jsonb_build_object(
    'overall', (SELECT jsonb_build_object('avg', avg_rating, 'n', n) FROM overall),
    'distribution', COALESCE((SELECT jsonb_agg(jsonb_build_object('rating', rating, 'n', n) ORDER BY rating) FROM distribution), '[]'::jsonb),
    'by_competency', COALESCE((SELECT jsonb_agg(jsonb_build_object('competency_id', competency_id, 'name', name, 'category', category, 'avg_rating', avg_rating, 'n', n)) FROM by_competency), '[]'::jsonb),
    'by_employee', COALESCE((SELECT jsonb_agg(jsonb_build_object('employee_id', employee_id, 'avg_rating', avg_rating, 'n', n)) FROM by_employee), '[]'::jsonb),
    'by_department', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', name, 'avg_rating', avg_rating, 'n', n)) FROM by_department), '[]'::jsonb),
    'by_function', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', name, 'avg_rating', avg_rating, 'n', n)) FROM by_function), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_analytics_response_aggregates(uuid, uuid, text) TO authenticated;

-- Companion RPC: completion-rate aggregates. Small result but lets the page
-- skip pulling every review_assignment row into JS just to count statuses
-- and group by dept/function.
CREATE OR REPLACE FUNCTION public.get_analytics_completion_aggregates(
  p_cycle_id uuid DEFAULT NULL,
  p_function_id uuid DEFAULT NULL,
  p_department text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid := auth_workspace_id();
  v_result jsonb;
BEGIN
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  WITH scoped AS (
    SELECT
      ra.id,
      ra.status,
      ra.employee_id,
      u.department,
      l.job_family_id,
      jf.name AS function_name
    FROM review_assignments ra
    JOIN performance_cycles pc ON pc.id = ra.cycle_id
    LEFT JOIN users u ON u.id = ra.employee_id
    LEFT JOIN levels l ON l.id = u.level_id
    LEFT JOIN job_families jf ON jf.id = l.job_family_id
    WHERE pc.workspace_id = v_workspace_id
      AND (p_cycle_id IS NULL OR ra.cycle_id = p_cycle_id)
      AND (p_function_id IS NULL OR l.job_family_id = p_function_id)
      AND (p_department IS NULL OR u.department = p_department)
  ),
  overall AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed,
      COUNT(DISTINCT employee_id) AS participants
    FROM scoped
  ),
  by_department AS (
    SELECT
      COALESCE(department, 'Unknown') AS name,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed
    FROM scoped
    GROUP BY COALESCE(department, 'Unknown')
  ),
  by_function AS (
    SELECT
      COALESCE(function_name, 'Unknown') AS name,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed
    FROM scoped
    GROUP BY COALESCE(function_name, 'Unknown')
  )
  SELECT jsonb_build_object(
    'overall', (SELECT jsonb_build_object('total', total, 'completed', completed, 'participants', participants) FROM overall),
    'by_department', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('name', name, 'total', total, 'completed', completed))
       FROM by_department),
      '[]'::jsonb
    ),
    'by_function', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('name', name, 'total', total, 'completed', completed))
       FROM by_function),
      '[]'::jsonb
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_analytics_completion_aggregates(uuid, uuid, text) TO authenticated;
