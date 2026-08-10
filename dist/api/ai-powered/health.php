<?php
declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';

app_start_session();

if (!app_is_authenticated()) {
    app_json([
        'ok' => false,
        'error' => 'Login required.'
    ], 403);
}

app_proxy_ai_powered_endpoint('health');
