export interface Badge {
  allow_multiple_awards: boolean;
  default_icon: string;
  description: string;
  id: number;
  name: string;
  points: number;
  ref: string;
}

export interface Award {
  award_date: string;
  badge: Badge;
  badge_icon: string;
  certificate_pdf: string | null;
  description: string;
  emailed: boolean;
  id: number;
  validation_uuid: string;
}

export interface AwardsApiResponse {
  meta: {
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total_count: number;
  };
  objects: Award[];
}
