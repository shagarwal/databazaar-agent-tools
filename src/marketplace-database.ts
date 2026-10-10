// Shared response types from the published databazaar-agent-tools@0.1.0 artifact.
type AccountType = 'seller' | 'operator' | 'both';
type PricingType = 'buy_it_now' | 'auction' | 'hybrid' | 'free';
type DatasetStatus = 'draft' | 'active' | 'sold' | 'expired' | 'cancelled' | 'pending_scan' | 'flagged' | 'pending_verification';
type PaymentStatus = 'pending' | 'escrowed' | 'released' | 'disputed' | 'refunded';
interface User {
    id: string;
    email: string;
    display_name: string;
    username: string | null;
    avatar_url: string | null;
    profession: string | null;
    location: string | null;
    onboarding_completed: boolean;
    account_type: AccountType;
    reputation_score: number;
    verified: boolean;
    stripe_account_id: string | null;
    violations_count: number;
    account_status: 'active' | 'suspended' | 'banned';
    tos_agreed_at: string | null;
    created_at: string;
}
interface DataColumn {
    name: string;
    type: string;
    description: string;
}
interface DataSchema {
    format: string;
    columns: DataColumn[];
    row_count: number;
    date_range?: {
        start: string;
        end: string;
    };
    geographic_coverage?: Record<string, string>;
    update_frequency?: string;
}
interface DataProfile {
    completeness: number;
    collection_method: string;
    verification: string;
    column_stats: Record<string, ColumnStats>;
    pii_flags: string[];
}
interface ColumnStats {
    null_rate: number;
    unique_count?: number;
    min?: number | string;
    max?: number | string;
    mean?: number;
    sample_values: unknown[];
}
interface AuctionConfig {
    start_price: number;
    reserve_price: number | null;
    duration_hours: number;
    end_time: string;
    extensions: number;
    current_price: number;
    bid_count: number;
}
interface Dataset {
    id: string;
    seller_id: string | null;
    title: string;
    description: string;
    category: string;
    tags: string[];
    schema: DataSchema;
    data_profile: DataProfile | null;
    sample_file_path: string;
    full_data_path: string;
    quality_score: number | null;
    quality_assessment?: {
        status: string;
        score: number | null;
        version: string;
    } | null;
    pricing_type: PricingType;
    price: number | null;
    auction_config: AuctionConfig | null;
    copies_available: number | null;
    status: DatasetStatus;
    view_count: number;
    download_count: number;
    agent_token_id: string | null;
    draft_expires_at: string | null;
    disable_auto_sample: boolean;
    created_at: string;
    updated_at: string;
}
interface Purchase {
    id: string;
    dataset_id: string;
    api_key_id: string;
    amount_paid: number;
    platform_fee: number;
    payment_intent_id: string;
    payment_status: PaymentStatus;
    download_count: number;
    escrow_release_at: string;
    created_at: string;
}


export type { Dataset, User, PricingType, Purchase };
