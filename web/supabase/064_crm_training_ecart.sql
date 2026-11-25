-- 064 (2026-11-25) : Entraînement › Reformulation de l'écart (Romain). Chaque reformulation corrigée est gardée dans
-- crm_training_results, comme les autres entraînements (049 : ajout seulement), sous le module « ecart » : note sur 10
-- (la règle du maximum de 049 donne déjà 10), corrigée par le code (mode « regles »).
-- Rejouable.

alter table crm_training_results drop constraint if exists crm_training_results_module_check;
alter table crm_training_results add constraint crm_training_results_module_check
  check (module in ('coup', 'lettre', 'academie', 'ecart'));
