<?php
declare(strict_types=1);
require __DIR__ . '/../bootstrap.php';
app_require_session();
app_require_csrf_for_read();
app_proxy_ai_powered_endpoint('providers');
