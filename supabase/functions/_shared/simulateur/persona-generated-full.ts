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
}
