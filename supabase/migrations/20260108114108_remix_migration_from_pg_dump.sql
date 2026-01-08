CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'gerente',
    'vendedor',
    'dev'
);


--
-- Name: can_view_file(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_file(_user_id uuid, _file_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_role app_role;
  user_region text;
  has_role_access boolean;
  has_region_restriction boolean;
  has_region_access boolean;
BEGIN
  -- Get user's role
  SELECT role INTO user_role FROM user_roles WHERE user_id = _user_id LIMIT 1;
  
  -- Admins and devs can see everything
  IF user_role IN ('admin', 'dev') THEN
    RETURN true;
  END IF;
  
  -- Check if user has role-based access
  SELECT EXISTS (
    SELECT 1 FROM file_visibility fv 
    WHERE fv.file_id = _file_id AND fv.visible_to_role = user_role
  ) INTO has_role_access;
  
  -- If no role access, deny
  IF NOT has_role_access THEN
    RETURN false;
  END IF;
  
  -- If user is vendedor, check region restrictions
  IF user_role = 'vendedor' THEN
    -- Check if file has region restrictions
    SELECT EXISTS (
      SELECT 1 FROM file_region_visibility frv WHERE frv.file_id = _file_id
    ) INTO has_region_restriction;
    
    -- If no region restrictions, allow access
    IF NOT has_region_restriction THEN
      RETURN true;
    END IF;
    
    -- Get user's region
    SELECT region INTO user_region FROM profiles WHERE id = _user_id;
    
    -- If user has no region, deny access to region-restricted files
    IF user_region IS NULL THEN
      RETURN false;
    END IF;
    
    -- Check if user's region has access
    SELECT EXISTS (
      SELECT 1 FROM file_region_visibility frv 
      WHERE frv.file_id = _file_id AND frv.region = user_region
    ) INTO has_region_access;
    
    RETURN has_region_access;
  END IF;
  
  -- For other roles, just role access is enough
  RETURN true;
END;
$$;


--
-- Name: can_view_product(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_product(_user_id uuid, _product_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.product_visibility pv
    JOIN public.user_roles ur ON ur.user_id = _user_id
    WHERE pv.product_id = _product_id
    AND (
      ur.role = 'admin'
      OR pv.visible_to_role = ur.role
      OR (ur.role = 'gerente' AND pv.visible_to_role IN ('gerente', 'vendedor'))
    )
  )
$$;


--
-- Name: get_user_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role(_user_id uuid) RETURNS public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'dev' THEN 0
      WHEN 'admin' THEN 1 
      WHEN 'gerente' THEN 2 
      WHEN 'vendedor' THEN 3 
    END
  LIMIT 1
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',
    false  -- New users require admin approval
  );
  RETURN NEW;
END;
$$;


--
-- Name: has_full_access(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_full_access(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'dev')
  )
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = _role 
        OR (role = 'dev' AND _role = 'admin')
      )
  )
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: access_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    resource_type text,
    resource_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    ip_address text
);


--
-- Name: achieved_certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achieved_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    goal_id uuid NOT NULL,
    goal_title text NOT NULL,
    goal_value text NOT NULL,
    period_type text NOT NULL,
    achieved_date date DEFAULT CURRENT_DATE NOT NULL,
    achieved_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: development_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.development_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    version text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    is_published boolean DEFAULT true NOT NULL
);


--
-- Name: file_region_visibility; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_region_visibility (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_id uuid NOT NULL,
    region text NOT NULL
);


--
-- Name: file_visibility; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_visibility (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_id uuid NOT NULL,
    visible_to_role public.app_role NOT NULL
);


--
-- Name: files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    file_url text NOT NULL,
    file_type text,
    file_size bigint,
    category text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    subcategory_id uuid,
    is_external_link boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY public.files REPLICA IDENTITY FULL;


--
-- Name: goal_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goal_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    goal_id uuid NOT NULL,
    user_id uuid NOT NULL,
    current_value numeric DEFAULT 0 NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    notes text,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid
);


--
-- Name: goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    target_value numeric NOT NULL,
    unit text DEFAULT 'unidades'::text NOT NULL,
    period_type text NOT NULL,
    visible_to_roles public.app_role[] DEFAULT '{vendedor,gerente,admin,dev}'::public.app_role[],
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    goal_type text DEFAULT 'team'::text NOT NULL,
    target_user_id uuid,
    CONSTRAINT goals_individual_must_have_user CHECK (((goal_type = 'team'::text) OR ((goal_type = 'individual'::text) AND (target_user_id IS NOT NULL)))),
    CONSTRAINT goals_period_type_check CHECK ((period_type = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'yearly'::text])))
);


--
-- Name: notification_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_reads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    notification_id uuid,
    user_notification_id uuid,
    read_at timestamp with time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    visible_to_roles public.app_role[] DEFAULT '{vendedor,gerente,admin}'::public.app_role[] NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: price_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    file_url text NOT NULL,
    file_size integer,
    region text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: product_visibility; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_visibility (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    visible_to_role public.app_role NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    price numeric(10,2),
    commercial_conditions text,
    image_url text,
    catalog_url text,
    technical_sheet_url text,
    category_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    avatar_url text,
    region text,
    location_sharing_enabled boolean
);


--
-- Name: subcategories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subcategories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    category_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ticket_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    message_id uuid,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_type text,
    file_size bigint,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ticket_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    user_id uuid NOT NULL,
    message text NOT NULL,
    is_admin_reply boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    category text DEFAULT 'suporte'::text NOT NULL,
    status text DEFAULT 'aberto'::text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: time_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    record_date date DEFAULT CURRENT_DATE NOT NULL,
    entry_time timestamp with time zone,
    lunch_exit_time timestamp with time zone,
    lunch_return_time timestamp with time zone,
    exit_time timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_activity_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_activity_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_start timestamp with time zone DEFAULT now() NOT NULL,
    session_end timestamp with time zone,
    duration_seconds integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_location_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_location_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    ip_address text,
    latitude numeric,
    longitude numeric,
    city text,
    region text,
    country text,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    location_source text DEFAULT 'ip'::text,
    neighborhood text,
    street text
);


--
-- Name: user_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    ip_address text,
    latitude numeric,
    longitude numeric,
    city text,
    region text,
    country text,
    last_updated timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    location_source text DEFAULT 'ip'::text,
    neighborhood text,
    street text
);


--
-- Name: user_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    created_by uuid,
    target_user_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_presence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_presence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    is_online boolean DEFAULT false NOT NULL,
    last_seen timestamp with time zone DEFAULT now() NOT NULL,
    session_started timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'vendedor'::public.app_role NOT NULL
);


--
-- Name: access_logs access_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_logs
    ADD CONSTRAINT access_logs_pkey PRIMARY KEY (id);


--
-- Name: achieved_certificates achieved_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achieved_certificates
    ADD CONSTRAINT achieved_certificates_pkey PRIMARY KEY (id);


--
-- Name: achieved_certificates achieved_certificates_user_id_goal_id_achieved_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achieved_certificates
    ADD CONSTRAINT achieved_certificates_user_id_goal_id_achieved_date_key UNIQUE (user_id, goal_id, achieved_date);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: development_updates development_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.development_updates
    ADD CONSTRAINT development_updates_pkey PRIMARY KEY (id);


--
-- Name: file_region_visibility file_region_visibility_file_id_region_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_region_visibility
    ADD CONSTRAINT file_region_visibility_file_id_region_key UNIQUE (file_id, region);


--
-- Name: file_region_visibility file_region_visibility_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_region_visibility
    ADD CONSTRAINT file_region_visibility_pkey PRIMARY KEY (id);


--
-- Name: file_visibility file_visibility_file_id_visible_to_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_visibility
    ADD CONSTRAINT file_visibility_file_id_visible_to_role_key UNIQUE (file_id, visible_to_role);


--
-- Name: file_visibility file_visibility_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_visibility
    ADD CONSTRAINT file_visibility_pkey PRIMARY KEY (id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: goal_progress goal_progress_goal_id_user_id_period_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_progress
    ADD CONSTRAINT goal_progress_goal_id_user_id_period_start_key UNIQUE (goal_id, user_id, period_start);


--
-- Name: goal_progress goal_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_progress
    ADD CONSTRAINT goal_progress_pkey PRIMARY KEY (id);


--
-- Name: goals goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_pkey PRIMARY KEY (id);


--
-- Name: notification_reads notification_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_pkey PRIMARY KEY (id);


--
-- Name: notification_reads notification_reads_user_id_notification_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_user_id_notification_id_key UNIQUE (user_id, notification_id);


--
-- Name: notification_reads notification_reads_user_id_user_notification_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_user_id_user_notification_id_key UNIQUE (user_id, user_notification_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: price_files price_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_files
    ADD CONSTRAINT price_files_pkey PRIMARY KEY (id);


--
-- Name: product_visibility product_visibility_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_visibility
    ADD CONSTRAINT product_visibility_pkey PRIMARY KEY (id);


--
-- Name: product_visibility product_visibility_product_id_visible_to_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_visibility
    ADD CONSTRAINT product_visibility_product_id_visible_to_role_key UNIQUE (product_id, visible_to_role);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: subcategories subcategories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcategories
    ADD CONSTRAINT subcategories_pkey PRIMARY KEY (id);


--
-- Name: ticket_attachments ticket_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_attachments
    ADD CONSTRAINT ticket_attachments_pkey PRIMARY KEY (id);


--
-- Name: ticket_messages ticket_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_messages
    ADD CONSTRAINT ticket_messages_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: time_records time_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_records
    ADD CONSTRAINT time_records_pkey PRIMARY KEY (id);


--
-- Name: time_records time_records_user_id_record_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_records
    ADD CONSTRAINT time_records_user_id_record_date_key UNIQUE (user_id, record_date);


--
-- Name: user_activity_sessions user_activity_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_sessions
    ADD CONSTRAINT user_activity_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_location_history user_location_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_location_history
    ADD CONSTRAINT user_location_history_pkey PRIMARY KEY (id);


--
-- Name: user_locations user_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_locations
    ADD CONSTRAINT user_locations_pkey PRIMARY KEY (id);


--
-- Name: user_locations user_locations_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_locations
    ADD CONSTRAINT user_locations_user_id_key UNIQUE (user_id);


--
-- Name: user_notifications user_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_pkey PRIMARY KEY (id);


--
-- Name: user_presence user_presence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_presence
    ADD CONSTRAINT user_presence_pkey PRIMARY KEY (id);


--
-- Name: user_presence user_presence_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_presence
    ADD CONSTRAINT user_presence_user_id_key UNIQUE (user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_goals_goal_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goals_goal_type ON public.goals USING btree (goal_type);


--
-- Name: idx_goals_target_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goals_target_user_id ON public.goals USING btree (target_user_id);


--
-- Name: idx_user_location_history_recorded_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_location_history_recorded_at ON public.user_location_history USING btree (recorded_at);


--
-- Name: idx_user_location_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_location_history_user_id ON public.user_location_history USING btree (user_id);


--
-- Name: files update_files_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: goal_progress update_goal_progress_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_goal_progress_updated_at BEFORE UPDATE ON public.goal_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: goals update_goals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: price_files update_price_files_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_price_files_updated_at BEFORE UPDATE ON public.price_files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: tickets update_tickets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: time_records update_time_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_time_records_updated_at BEFORE UPDATE ON public.time_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: access_logs access_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_logs
    ADD CONSTRAINT access_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: achieved_certificates achieved_certificates_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achieved_certificates
    ADD CONSTRAINT achieved_certificates_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.goals(id) ON DELETE CASCADE;


--
-- Name: development_updates development_updates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.development_updates
    ADD CONSTRAINT development_updates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: file_region_visibility file_region_visibility_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_region_visibility
    ADD CONSTRAINT file_region_visibility_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;


--
-- Name: file_visibility file_visibility_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_visibility
    ADD CONSTRAINT file_visibility_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;


--
-- Name: files files_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: files files_subcategory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id) ON DELETE SET NULL;


--
-- Name: goal_progress goal_progress_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_progress
    ADD CONSTRAINT goal_progress_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.goals(id) ON DELETE CASCADE;


--
-- Name: goals goals_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES auth.users(id);


--
-- Name: notification_reads notification_reads_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;


--
-- Name: notification_reads notification_reads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notification_reads notification_reads_user_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_user_notification_id_fkey FOREIGN KEY (user_notification_id) REFERENCES public.user_notifications(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: price_files price_files_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_files
    ADD CONSTRAINT price_files_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: product_visibility product_visibility_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_visibility
    ADD CONSTRAINT product_visibility_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: products products_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: subcategories subcategories_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcategories
    ADD CONSTRAINT subcategories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: ticket_attachments ticket_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_attachments
    ADD CONSTRAINT ticket_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.ticket_messages(id) ON DELETE CASCADE;


--
-- Name: ticket_attachments ticket_attachments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_attachments
    ADD CONSTRAINT ticket_attachments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_messages ticket_messages_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_messages
    ADD CONSTRAINT ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: time_records time_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_records
    ADD CONSTRAINT time_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_notifications user_notifications_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: user_notifications user_notifications_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES auth.users(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_notifications Admins and gerentes can insert user notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and gerentes can insert user notifications" ON public.user_notifications FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gerente'::public.app_role)));


--
-- Name: user_notifications Admins and gerentes can view all user notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and gerentes can view all user notifications" ON public.user_notifications FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gerente'::public.app_role) OR (target_user_id = auth.uid())));


--
-- Name: ticket_messages Admins can create messages on any ticket; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create messages on any ticket" ON public.ticket_messages FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) AND (auth.uid() = user_id)));


--
-- Name: profiles Admins can delete profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can insert profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all roles" ON public.user_roles USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: time_records Admins can manage all time records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all time records" ON public.time_records USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: categories Admins can manage categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage categories" ON public.categories USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: file_region_visibility Admins can manage file region visibility; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage file region visibility" ON public.file_region_visibility USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'dev'::public.app_role)));


--
-- Name: file_visibility Admins can manage file visibility; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage file visibility" ON public.file_visibility USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: files Admins can manage files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage files" ON public.files USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: notifications Admins can manage notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage notifications" ON public.notifications USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: products Admins can manage products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage products" ON public.products USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: subcategories Admins can manage subcategories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage subcategories" ON public.subcategories USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: product_visibility Admins can manage visibility; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage visibility" ON public.product_visibility USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can update all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: tickets Admins can update all tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all tickets" ON public.tickets FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: access_logs Admins can view all logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all logs" ON public.access_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: tickets Admins can view all tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all tickets" ON public.tickets FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: time_records Admins can view all time records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all time records" ON public.time_records FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: development_updates Anyone can view published updates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view published updates" ON public.development_updates FOR SELECT USING ((is_published = true));


--
-- Name: profiles Authenticated users can view all active profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all active profiles" ON public.profiles FOR SELECT USING ((is_active = true));


--
-- Name: user_activity_sessions Authenticated users can view all activity sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all activity sessions" ON public.user_activity_sessions FOR SELECT USING (true);


--
-- Name: user_presence Authenticated users can view all presence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all presence" ON public.user_presence FOR SELECT USING (true);


--
-- Name: goal_progress Authenticated users can view all progress for ranking; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all progress for ranking" ON public.goal_progress FOR SELECT USING (true);


--
-- Name: user_roles Authenticated users can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all roles" ON public.user_roles FOR SELECT USING (true);


--
-- Name: categories Authenticated users can view categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view categories" ON public.categories FOR SELECT TO authenticated USING (true);


--
-- Name: subcategories Authenticated users can view subcategories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view subcategories" ON public.subcategories FOR SELECT USING (true);


--
-- Name: development_updates DEV can manage updates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DEV can manage updates" ON public.development_updates USING (public.has_role(auth.uid(), 'dev'::public.app_role));


--
-- Name: price_files Dev and admin full access to price_files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dev and admin full access to price_files" ON public.price_files USING (public.has_full_access(auth.uid()));


--
-- Name: notification_reads Dev can delete notification reads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dev can delete notification reads" ON public.notification_reads FOR DELETE USING (public.has_role(auth.uid(), 'dev'::public.app_role));


--
-- Name: notifications Dev can delete notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dev can delete notifications" ON public.notifications FOR DELETE USING (public.has_role(auth.uid(), 'dev'::public.app_role));


--
-- Name: time_records Dev can delete time records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dev can delete time records" ON public.time_records FOR DELETE USING (public.has_role(auth.uid(), 'dev'::public.app_role));


--
-- Name: user_notifications Dev can delete user notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dev can delete user notifications" ON public.user_notifications FOR DELETE USING (public.has_role(auth.uid(), 'dev'::public.app_role));


--
-- Name: time_records Dev can update all time records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dev can update all time records" ON public.time_records FOR UPDATE USING (public.has_role(auth.uid(), 'dev'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'dev'::public.app_role));


--
-- Name: time_records Dev can view all time records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Dev can view all time records" ON public.time_records FOR SELECT USING (public.has_role(auth.uid(), 'dev'::public.app_role));


--
-- Name: goal_progress Devs and admins can manage all progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs and admins can manage all progress" ON public.goal_progress USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'dev'::public.app_role)));


--
-- Name: goals Devs and admins can manage goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs and admins can manage goals" ON public.goals USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'dev'::public.app_role)));


--
-- Name: achieved_certificates Devs and admins can view all certificates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs and admins can view all certificates" ON public.achieved_certificates FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'dev'::public.app_role)));


--
-- Name: goal_progress Devs can delete goal progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs can delete goal progress" ON public.goal_progress FOR DELETE USING (public.has_role(auth.uid(), 'dev'::public.app_role));


--
-- Name: user_location_history Devs can delete location history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs can delete location history" ON public.user_location_history FOR DELETE USING (public.has_role(auth.uid(), 'dev'::public.app_role));


--
-- Name: user_presence Devs can delete presence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs can delete presence" ON public.user_presence FOR DELETE USING (public.has_role(auth.uid(), 'dev'::public.app_role));


--
-- Name: user_activity_sessions Devs can delete sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs can delete sessions" ON public.user_activity_sessions FOR DELETE USING (public.has_role(auth.uid(), 'dev'::public.app_role));


--
-- Name: achieved_certificates Devs can manage all certificates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs can manage all certificates" ON public.achieved_certificates USING (public.has_role(auth.uid(), 'dev'::public.app_role));


--
-- Name: user_location_history Devs can view all location history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs can view all location history" ON public.user_location_history FOR SELECT USING (public.has_role(auth.uid(), 'dev'::public.app_role));


--
-- Name: user_locations Devs can view all locations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Devs can view all locations" ON public.user_locations FOR SELECT USING (public.has_role(auth.uid(), 'dev'::public.app_role));


--
-- Name: products Gerentes can manage products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gerentes can manage products" ON public.products USING (public.has_role(auth.uid(), 'gerente'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'gerente'::public.app_role));


--
-- Name: product_visibility Gerentes can manage visibility; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gerentes can manage visibility" ON public.product_visibility USING (public.has_role(auth.uid(), 'gerente'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'gerente'::public.app_role));


--
-- Name: price_files Gerentes can view all price files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gerentes can view all price files" ON public.price_files FOR SELECT USING (public.has_role(auth.uid(), 'gerente'::public.app_role));


--
-- Name: ticket_messages Users can create messages on own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create messages on own tickets" ON public.ticket_messages FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.tickets t
  WHERE ((t.id = ticket_messages.ticket_id) AND ((t.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)))))));


--
-- Name: tickets Users can create own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own tickets" ON public.tickets FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: ticket_attachments Users can insert attachments to own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert attachments to own tickets" ON public.ticket_attachments FOR INSERT WITH CHECK (((auth.uid() = created_by) AND (EXISTS ( SELECT 1
   FROM public.tickets t
  WHERE ((t.id = ticket_attachments.ticket_id) AND ((t.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)))))));


--
-- Name: achieved_certificates Users can insert own certificates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own certificates" ON public.achieved_certificates FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_locations Users can insert own location; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own location" ON public.user_locations FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_location_history Users can insert own location history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own location history" ON public.user_location_history FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: access_logs Users can insert own logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own logs" ON public.access_logs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_presence Users can insert own presence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own presence" ON public.user_presence FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: goal_progress Users can insert own progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own progress" ON public.goal_progress FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: notification_reads Users can insert own reads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own reads" ON public.notification_reads FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_activity_sessions Users can insert own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own sessions" ON public.user_activity_sessions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: time_records Users can insert own time records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own time records" ON public.time_records FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_locations Users can update own location; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own location" ON public.user_locations FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_presence Users can update own presence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own presence" ON public.user_presence FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: goal_progress Users can update own progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own progress" ON public.goal_progress FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_activity_sessions Users can update own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own sessions" ON public.user_activity_sessions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: tickets Users can update own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own tickets" ON public.tickets FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: time_records Users can update own time records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own time records" ON public.time_records FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: files Users can view allowed files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view allowed files" ON public.files FOR SELECT USING (public.can_view_file(auth.uid(), id));


--
-- Name: notifications Users can view allowed notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view allowed notifications" ON public.notifications FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (notifications.visible_to_roles))))));


--
-- Name: products Users can view allowed products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view allowed products" ON public.products FOR SELECT USING (public.can_view_product(auth.uid(), id));


--
-- Name: ticket_attachments Users can view attachments from own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view attachments from own tickets" ON public.ticket_attachments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tickets t
  WHERE ((t.id = ticket_attachments.ticket_id) AND ((t.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))))));


--
-- Name: file_region_visibility Users can view file region visibility; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view file region visibility" ON public.file_region_visibility FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.files f
  WHERE ((f.id = file_region_visibility.file_id) AND public.can_view_file(auth.uid(), f.id)))));


--
-- Name: goals Users can view goals for their role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view goals for their role" ON public.goals FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (goals.visible_to_roles))))));


--
-- Name: ticket_messages Users can view messages from own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view messages from own tickets" ON public.ticket_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tickets t
  WHERE ((t.id = ticket_messages.ticket_id) AND ((t.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))))));


--
-- Name: achieved_certificates Users can view own certificates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own certificates" ON public.achieved_certificates FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_locations Users can view own location; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own location" ON public.user_locations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own notifications" ON public.user_notifications FOR SELECT USING ((target_user_id = auth.uid()));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: goal_progress Users can view own progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own progress" ON public.goal_progress FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notification_reads Users can view own reads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own reads" ON public.notification_reads FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view own role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: tickets Users can view own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own tickets" ON public.tickets FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: time_records Users can view own time records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own time records" ON public.time_records FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: file_visibility Users can view visibility for their files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view visibility for their files" ON public.file_visibility FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.files f
  WHERE ((f.id = file_visibility.file_id) AND public.can_view_file(auth.uid(), f.id)))));


--
-- Name: product_visibility Users can view visibility for their products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view visibility for their products" ON public.product_visibility FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.products p
  WHERE ((p.id = product_visibility.product_id) AND public.can_view_product(auth.uid(), p.id)))));


--
-- Name: price_files Vendedores can view price files based on region; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Vendedores can view price files based on region" ON public.price_files FOR SELECT USING ((public.has_role(auth.uid(), 'vendedor'::public.app_role) AND ((( SELECT profiles.region
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'INTERNO'::text) OR (region IS NULL) OR (region = ( SELECT profiles.region
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (( SELECT profiles.region
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) IS NULL))));


--
-- Name: access_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: achieved_certificates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.achieved_certificates ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: development_updates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.development_updates ENABLE ROW LEVEL SECURITY;

--
-- Name: file_region_visibility; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.file_region_visibility ENABLE ROW LEVEL SECURITY;

--
-- Name: file_visibility; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.file_visibility ENABLE ROW LEVEL SECURITY;

--
-- Name: files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

--
-- Name: goal_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.goal_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: goals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_reads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: price_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.price_files ENABLE ROW LEVEL SECURITY;

--
-- Name: product_visibility; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_visibility ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: subcategories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: time_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;

--
-- Name: user_activity_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_activity_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_location_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_location_history ENABLE ROW LEVEL SECURITY;

--
-- Name: user_locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: user_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: user_presence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;