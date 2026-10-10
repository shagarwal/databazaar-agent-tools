// Public types bundled in databazaar-agent-tools@0.1.1.
interface DatasetDocumentation {
    source_name?: string;
    source_url?: string;
    license_url?: string;
    collection_method?: string;
    coverage_label?: string;
    coverage_status?: 'date_range' | 'not_applicable';
    coverage_start?: string;
    coverage_end?: string;
    update_frequency?: string;
    last_updated?: string;
    notes?: string;
}

export type { DatasetDocumentation };
