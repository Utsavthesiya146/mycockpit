<?php
declare(strict_types=1);

namespace Cockpit\Services\Connectors;

interface LeadConnectorInterface {

    /**
     * Unique internal source key (e.g. 'eaf_connect', 'bni_connect', 'kvv_connect', 'website_seo')
     */
    public function getSourceKey(): string;

    /**
     * Human-readable platform name
     */
    public function getDisplayName(): string;

    /**
     * Test live connection using provided or stored credentials
     * Returns: ['success' => bool, 'message' => string, 'details' => array]
     */
    public function testConnection(int $tenantId, array $config): array;

    /**
     * Pull sync leads from remote platform
     * Returns: [
     *   'success' => bool,
     *   'leads_fetched' => int,
     *   'leads_created' => int,
     *   'leads_updated' => int,
     *   'leads_skipped' => int,
     *   'new_checkpoint' => ?string,
     *   'error' => ?string
     * ]
     */
    public function sync(int $tenantId, array $config, ?string $checkpoint = null): array;

    /**
     * Process incoming real-time webhook payload
     */
    public function processWebhook(int $tenantId, array $config, array $payload, array $headers): array;
}
