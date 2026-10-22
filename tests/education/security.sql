begin;
set local role service_role;
select jsonb_array_length(public.education_query('[{"sql":"SELECT id,name,slug FROM institutions WHERE slug=?","args":["tek-secenek-akademi"]}]'::jsonb)->0->'results')=1 as known_slug_works;
select jsonb_array_length(public.education_query('[{"sql":"SELECT id,name,slug FROM institutions WHERE slug=?","args":["x'' OR 1=1 --"]}]'::jsonb)->0->'results')=0 as injection_is_literal;
reset role;
select not has_function_privilege('anon','public.education_query(jsonb)','EXECUTE') as anon_query_denied,
not has_function_privilege('authenticated','public.education_query(jsonb)','EXECUTE') as browser_query_denied,
not has_schema_privilege('anon','education','USAGE') as anon_schema_denied,
not has_schema_privilege('authenticated','education','USAGE') as user_schema_denied;
rollback;
