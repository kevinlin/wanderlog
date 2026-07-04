-- Req 4.4: accommodation editing needs notes and a pin that follows the
-- accommodation; the M1 table has neither a remarks column nor coordinates.
alter table accommodations
  add column remarks text,
  add column lat double precision,
  add column lng double precision;
