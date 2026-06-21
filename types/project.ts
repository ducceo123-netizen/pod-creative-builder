export type ProjectStatus = "draft" | "generated" | "selected" | "exported";

export type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
  competitorUrl?: string;
  competitorBrand?: string;
  productTitle?: string;
  productDescription?: string;
  adCopy?: string;
  productType?: string;
  targetMarket?: string;
  buyerPersona?: string;
  occasion?: string;
  niche?: string;
  priceRange?: string;
  brandVoice?: string[];
  visualStyle?: string[];
  avoidList?: string;
  userNotes?: string;
  outputs?: string[];
};
