import type { Dataset, User, PricingType } from "./marketplace-database.js";

type PublicDataset = Omit<Dataset, 'full_data_path'> & {
    seller: Pick<User, 'id' | 'display_name' | 'username' | 'avatar_url' | 'reputation_score' | 'verified'>;
};
interface SearchDatasetsQuery {
    query?: string;
    category?: string;
    format?: string;
    max_price?: number;
    min_quality_score?: number;
    geographic_area?: string;
    tags?: string[];
    pricing_type?: 'buy_it_now' | 'auction' | 'hybrid';
    limit?: number;
    offset?: number;
}
interface SearchDatasetsResponse {
    data: PublicDataset[];
    total: number;
    limit: number;
    offset: number;
}


export type { PublicDataset, SearchDatasetsQuery, SearchDatasetsResponse };
export type { Purchase } from "./marketplace-database.js";
