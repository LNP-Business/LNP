"""Exécutant de l'analyse d'appel LNP : prend les appels en file dans le CRM, lance le moteur, enregistre l'analyse de l'appel.

Voir analyse-appel/PLAN.md §2–4. Bibliothèque standard seulement : le CRM est joint par l'API REST de Supabase (fonctions
crm_ca_claim, crm_ca_store, crm_ca_fail de web/supabase/020_crm_call_analysis.sql) et le modèle par la fonction Edge
callqa-llm. N'écrit jamais dans le journal une consigne, une citation ni une transcription.
"""
