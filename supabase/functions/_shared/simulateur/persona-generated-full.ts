export interface OfferData {
  offer_identity?: {
    company_name?: string;
    main_promise?: string;
    positioning?: string;
  };
  offer_details?: {
    main_offer?: {
      price?: string;
      duration?: string;
      financing_options?: string[];
    };
  };
  tools_taught?: Array<{ name?: string }>;
  // ce que le prospect sait et se demande (module content_for_simulation de l'extraction de l'offre), lu depuis v0.13
  content_for_simulation?: {
    prospect_already_knows?: string[];
    prospect_unclear_about?: string[];
    vocabulary?: { terms_prospects_use?: string[] };
  };
}
