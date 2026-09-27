-- Extend only the camera status allowlist; preserve validation and permissions.
DO $patch$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('cc_private.validate_record()'::regprocedure) INTO definition;
 IF position('''disposed''' in definition) = 0 THEN
  IF position('array[''online'',''offline'',''maintenance'']' in definition) = 0 THEN
   RAISE EXCEPTION 'Camera status allowlist differs from expected definition';
  END IF;
  EXECUTE replace(definition, 'array[''online'',''offline'',''maintenance'']', 'array[''online'',''offline'',''maintenance'',''disposed'',''inventory'']');
 END IF;
END $patch$;
