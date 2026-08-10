<?php
declare(strict_types=1);

const APP_NAME = 'Py Transcribe Studio';
const APP_PASSWORD_HASH = '';
const APP_STORAGE_TTL_SECONDS = 86_400;

function app_start_session(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        if (PHP_VERSION_ID >= 70300) {
            session_set_cookie_params([
                'httponly' => true,
                'samesite' => 'Lax',
                'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'
            ]);
        }

        session_name('py_transcribe_session');
        session_start();
    }
}

function app_is_auth_enabled(): bool
{
    return APP_PASSWORD_HASH !== '';
}

function app_is_authenticated(): bool
{
    if (!app_is_auth_enabled()) {
        return true;
    }

    return !empty($_SESSION['authenticated']);
}

function app_login(string $password): bool
{
    if (!app_is_auth_enabled()) {
        return true;
    }

    if (password_verify($password, APP_PASSWORD_HASH)) {
        $_SESSION['authenticated'] = true;
        session_regenerate_id(true);
        return true;
    }

    return false;
}

function app_logout(): void
{
    unset($_SESSION['authenticated']);
    session_regenerate_id(true);
}

function app_csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(16));
    }

    return (string) $_SESSION['csrf_token'];
}

function app_require_csrf(): void
{
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? '';
    $expected = (string) ($_SESSION['csrf_token'] ?? '');

    if ($expected === '' || !hash_equals($expected, (string) $provided)) {
        app_json([
            'ok' => false,
            'error' => 'CSRF check failed.'
        ], 403);
    }
}

function app_public_dir(): string
{
    return dirname(__DIR__);
}

function app_storage_dir(): string
{
    return app_public_dir() . DIRECTORY_SEPARATOR . 'storage';
}

function app_upload_dir(): string
{
    return app_storage_dir() . DIRECTORY_SEPARATOR . 'uploads';
}

function app_manifest_path(): string
{
    return app_storage_dir() . DIRECTORY_SEPARATOR . 'manifest.json';
}

function app_parse_size(string $value): int
{
  $value = trim($value);
  if ($value === '' || $value === '-1') {
    return PHP_INT_MAX;
  }

  if (!preg_match('/^(\d+)([KMG]?)/i', $value, $matches)) {
    return PHP_INT_MAX;
  }

  $size = (int) $matches[1];
  $suffix = strtoupper($matches[2] ?? '');

  if ($suffix === 'G') {
      return $size * 1024 * 1024 * 1024;
  }

  if ($suffix === 'M') {
      return $size * 1024 * 1024;
  }

  if ($suffix === 'K') {
      return $size * 1024;
  }

  return $size;
}

function app_max_upload_bytes(): int
{
    $upload = app_parse_size((string) ini_get('upload_max_filesize'));
    $post = app_parse_size((string) ini_get('post_max_size'));
    $limit = min($upload, $post);

    return $limit > 0 ? $limit : PHP_INT_MAX;
}

function app_ensure_storage(): void
{
    foreach ([app_storage_dir(), app_upload_dir()] as $path) {
        if (!is_dir($path)) {
            mkdir($path, 0775, true);
        }
    }
}

function app_manifest_load(): array
{
    app_ensure_storage();

    $path = app_manifest_path();
    if (!is_file($path)) {
        return ['uploads' => []];
    }

    $raw = file_get_contents($path);
    $data = json_decode($raw ?: '', true);

    return is_array($data) ? $data : ['uploads' => []];
}

function app_manifest_save(array $manifest): void
{
    app_ensure_storage();
    file_put_contents(
        app_manifest_path(),
        json_encode($manifest, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function app_cleanup_storage(): void
{
    $manifest = app_manifest_load();
    $uploads = $manifest['uploads'] ?? [];
    $cutoff = time() - APP_STORAGE_TTL_SECONDS;
    $changed = false;

    foreach ($uploads as $id => $meta) {
        $created = (int) ($meta['createdAt'] ?? 0);
        $storedName = (string) ($meta['storedName'] ?? '');
        $filePath = app_upload_dir() . DIRECTORY_SEPARATOR . $storedName;

        if ($created > 0 && $created < $cutoff) {
            if (is_file($filePath)) {
                @unlink($filePath);
            }

            unset($uploads[$id]);
            $changed = true;
        }
    }

    if ($changed) {
        $manifest['uploads'] = $uploads;
        app_manifest_save($manifest);
    }
}

function app_json(array $payload, int $status = 200)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function app_text(string $body, int $status = 200, string $contentType = 'text/plain; charset=utf-8')
{
    http_response_code($status);
    header('Content-Type: ' . $contentType);
    header('Cache-Control: no-store');
    echo $body;
    exit;
}

function app_safe_filename(string $name): string
{
    $base = pathinfo($name, PATHINFO_FILENAME);
    $base = preg_replace('/[^A-Za-z0-9._-]+/', '-', $base) ?? 'audio';
    $base = trim($base, '-._');

    return $base !== '' ? $base : 'audio';
}

function app_extension_for_upload(string $originalName, string $mime): string
{
  $name = strtolower($originalName);
  $extension = pathinfo($name, PATHINFO_EXTENSION);
  if ($extension !== '') {
    return $extension;
  }

  if (strpos($mime, 'wav') !== false) {
    return 'wav';
  }

  if (strpos($mime, 'mpeg') !== false) {
    return 'mp3';
  }

  if (strpos($mime, 'mp4') !== false) {
    return 'm4a';
  }

  if (strpos($mime, 'webm') !== false) {
    return 'webm';
  }

  if (strpos($mime, 'ogg') !== false) {
    return 'ogg';
  }

  if (strpos($mime, 'quicktime') !== false) {
    return 'mov';
  }

  return 'bin';
}

function app_detect_mime(string $filePath): string
{
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    if ($finfo === false) {
        return 'application/octet-stream';
    }

    $mime = finfo_file($finfo, $filePath) ?: 'application/octet-stream';
    finfo_close($finfo);

    return $mime;
}

function app_file_response(string $filePath, string $downloadName, string $mime)
{
    if (!is_file($filePath)) {
        app_text('File not found.', 404);
    }

    $safeDownloadName = preg_replace('/[\r\n"]+/', '', basename($downloadName)) ?: 'audio';
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . (string) filesize($filePath));
    header('Content-Disposition: attachment; filename="' . $safeDownloadName . '"');
    header('Cache-Control: no-store');
    readfile($filePath);
    exit;
}

function app_build_config(array $extra = []): array
{
    return array_merge([
        'appName' => APP_NAME,
        'uploadEndpoint' => 'api/upload.php',
        'downloadEndpoint' => 'api/download.php',
        'localAiBaseUrl' => 'api/ollama',
        'aiPoweredBaseUrl' => 'api/ai-powered',
        'localAiRuntimeMode' => 'auto',
        'promoUrl' => 'https://mytech.today',
        'readmeApiUrl' => 'https://api.github.com/repos/mytech-today-now/py-transcribe/readme?ref=main',
        'readmeSourceUrl' => 'https://github.com/mytech-today-now/py-transcribe/blob/main/readme.md',
        'csrfToken' => app_csrf_token(),
        'authRequired' => app_is_auth_enabled(),
        'storageEnabled' => true,
        'localAiAutoDownload' => true,
        'uploadLimitBytes' => app_max_upload_bytes(),
        'clientLimitBytes' => (int) (2.5 * 1024 * 1024 * 1024),
    ], $extra);
}

function app_proxy_ollama_endpoint(string $endpoint): void
{
    $endpoint = trim($endpoint);
    $allowed = ['tags', 'pull', 'chat'];
    if ($endpoint === '' || !in_array($endpoint, $allowed, true)) {
        app_text('Ollama endpoint not found.', 404);
    }

    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if (!in_array($method, ['GET', 'POST'], true)) {
        app_text('Method not allowed.', 405);
    }

    $body = $method === 'POST' ? (string) file_get_contents('php://input') : '';
    $requestHeaders = [
        'Accept: application/json, application/x-ndjson, text/plain;q=0.8, */*;q=0.5'
    ];
    if ($method === 'POST') {
        $requestHeaders[] = 'Content-Type: application/json';
    }

    $httpOptions = [
        'method' => $method,
        'header' => implode("\r\n", $requestHeaders) . "\r\n",
        'ignore_errors' => true,
        'timeout' => 3600
    ];
    if ($method === 'POST') {
        $httpOptions['content'] = $body;
    }

    $context = stream_context_create([
        'http' => $httpOptions
    ]);

    @set_time_limit(0);
    while (ob_get_level() > 0) {
        @ob_end_flush();
    }
    @ob_implicit_flush(true);

    foreach (app_ollama_target_candidates() as $baseUrl) {
        $candidateTarget = rtrim($baseUrl, '/') . '/api/' . $endpoint;
        if (app_proxy_ollama_endpoint_via_curl($candidateTarget, $method, $requestHeaders, $body, $endpoint)) {
            return;
        }

        if (app_proxy_ollama_endpoint_via_stream($candidateTarget, $context, $endpoint)) {
            return;
        }
    }

    app_text(
        'Ollama is not running on this machine or the local proxy cannot reach http://127.0.0.1:11434 or http://localhost:11434.',
        502
    );
}

function app_proxy_ollama_endpoint_via_curl(string $candidateTarget, string $method, array $requestHeaders, string $body, string $endpoint): bool
{
    if (!function_exists('curl_init')) {
        return false;
    }

    $curl = curl_init($candidateTarget);
    if ($curl === false) {
        return false;
    }

    $responseStatus = 502;
    $responseContentType = '';
    $responseHeadersSent = false;
    $responseStarted = false;

    $emitResponseHeaders = static function () use (&$responseHeadersSent, &$responseStatus, &$responseContentType, $endpoint): void {
        if ($responseHeadersSent) {
            return;
        }

        app_emit_ollama_proxy_headers($responseStatus, $responseContentType, $endpoint);
        $responseHeadersSent = true;
    };

    curl_setopt_array($curl, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => array_merge($requestHeaders, ['Expect:']),
        CURLOPT_HEADERFUNCTION => static function ($curlHandle, string $headerLine) use (&$responseStatus, &$responseContentType, $emitResponseHeaders): int {
            $headerLength = strlen($headerLine);
            $trimmed = trim($headerLine);

            if ($trimmed === '') {
                $emitResponseHeaders();
                return $headerLength;
            }

            if (preg_match('/^HTTP\/\S+\s+(\d{3})\b/i', $headerLine, $matches)) {
                $responseStatus = (int) $matches[1];
                $responseContentType = '';
                return $headerLength;
            }

            if (stripos($trimmed, 'Content-Type:') === 0) {
                $responseContentType = trim(substr($trimmed, strlen('Content-Type:')));
            }

            return $headerLength;
        },
        CURLOPT_WRITEFUNCTION => static function ($curlHandle, string $chunk) use (&$responseHeadersSent, &$responseStarted, &$responseStatus, &$responseContentType, $emitResponseHeaders): int {
            if (!$responseHeadersSent) {
                $emitResponseHeaders();
            }

            $responseStarted = true;
            echo $chunk;
            flush();

            return strlen($chunk);
        },
        CURLOPT_FAILONERROR => false,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 3600,
        CURLOPT_VERBOSE => false,
    ]);

    if ($method === 'POST') {
        curl_setopt($curl, CURLOPT_POSTFIELDS, $body);
    }

    $result = curl_exec($curl);
    $curlError = curl_error($curl);
    $responseCode = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    if ($responseCode > 0) {
        $responseStatus = $responseCode;
    }

    if (!$responseHeadersSent) {
        if ($result === false && !$responseStarted) {
            curl_close($curl);
            return false;
        }

        $emitResponseHeaders();
    }

    curl_close($curl);

    if ($result === false && !$responseStarted && !$responseHeadersSent) {
        return false;
    }

    if ($result === false && $curlError !== '') {
        error_log('Ollama curl proxy warning: ' . $curlError);
    }

    return true;
}

function app_proxy_ollama_endpoint_via_stream(string $candidateTarget, $context, string $endpoint): bool
{
    $stream = @fopen($candidateTarget, 'rb', false, $context);
    if ($stream === false) {
        return false;
    }

    $responseHeaders = $http_response_header ?? [];
    $status = app_parse_http_status_code($responseHeaders) ?? 502;
    $contentType = app_http_header_value($responseHeaders, 'Content-Type');
    app_emit_ollama_proxy_headers($status, $contentType, $endpoint);

    while (!feof($stream)) {
        $chunk = fread($stream, 8192);
        if ($chunk === false) {
            break;
        }

        if ($chunk === '') {
            continue;
        }

        echo $chunk;
        flush();
    }

    fclose($stream);
    return true;
}

function app_emit_ollama_proxy_headers(int $status, ?string $contentType, string $endpoint): void
{
    http_response_code($status);
    header('Cache-Control: no-store');
    header('X-Accel-Buffering: no');
    header('Content-Type: ' . app_ollama_proxy_content_type($contentType, $endpoint));
}

function app_ollama_proxy_content_type(?string $contentType, string $endpoint): string
{
    $defaultContentType = $endpoint === 'tags'
        ? 'application/json; charset=utf-8'
        : 'application/x-ndjson; charset=utf-8';

    $normalized = trim((string) $contentType);
    return $normalized !== '' ? $normalized : $defaultContentType;
}

function app_ollama_target_candidates(): array
{
    $candidates = [];
    $configured = trim((string) getenv('OLLAMA_BASE_URL'));
    if ($configured !== '' && preg_match('/^[a-z][a-z\d+.-]*:\/\//i', $configured) === 1) {
        $candidates[] = rtrim($configured, '/');
    }

    $candidates[] = 'http://127.0.0.1:11434';
    $candidates[] = 'http://localhost:11434';
    $candidates[] = 'http://[::1]:11434';

    return array_values(array_unique(array_filter($candidates)));
}

function app_proxy_ai_powered_endpoint(string $endpoint): void
{
    $endpoint = trim($endpoint);
    $allowed = ['health', 'providers', 'models', 'stream'];
    if ($endpoint === '' || !in_array($endpoint, $allowed, true)) {
        app_text('AI-Powered endpoint not found.', 404);
    }

    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($endpoint === 'stream') {
        if ($method !== 'POST') {
            app_text('Method not allowed.', 405);
        }
    } elseif ($method !== 'GET') {
        app_text('Method not allowed.', 405);
    }

    $body = $method === 'POST' ? (string) file_get_contents('php://input') : '';
    $requestHeaders = [
        'Accept: application/json, application/x-ndjson, text/plain;q=0.8, */*;q=0.5'
    ];
    if ($method === 'POST') {
        $requestHeaders[] = 'Content-Type: application/json';
    }

    $httpOptions = [
        'method' => $method,
        'header' => implode("\r\n", $requestHeaders) . "\r\n",
        'ignore_errors' => true,
        'timeout' => 3600
    ];
    if ($method === 'POST') {
        $httpOptions['content'] = $body;
    }

    $context = stream_context_create([
        'http' => $httpOptions
    ]);

    @set_time_limit(0);
    while (ob_get_level() > 0) {
        @ob_end_flush();
    }
    @ob_implicit_flush(true);

    foreach (app_ai_powered_target_candidates() as $baseUrl) {
        $candidateTarget = rtrim($baseUrl, '/') . '/api/' . $endpoint;
        if (app_proxy_ai_powered_endpoint_via_curl($candidateTarget, $method, $requestHeaders, $body, $endpoint)) {
            return;
        }

        if (app_proxy_ai_powered_endpoint_via_stream($candidateTarget, $context, $endpoint)) {
            return;
        }
    }

    app_text(
        'AI-Powered is not running on this machine or the local proxy cannot reach http://127.0.0.1:3001 or http://localhost:3001.',
        502
    );
}

function app_proxy_ai_powered_endpoint_via_curl(string $candidateTarget, string $method, array $requestHeaders, string $body, string $endpoint): bool
{
    if (!function_exists('curl_init')) {
        return false;
    }

    $curl = curl_init($candidateTarget);
    if ($curl === false) {
        return false;
    }

    $responseStatus = 502;
    $responseContentType = '';
    $responseHeadersSent = false;
    $responseStarted = false;

    $emitResponseHeaders = static function () use (&$responseHeadersSent, &$responseStatus, &$responseContentType, $endpoint): void {
        if ($responseHeadersSent) {
            return;
        }

        app_emit_ai_powered_proxy_headers($responseStatus, $responseContentType, $endpoint);
        $responseHeadersSent = true;
    };

    curl_setopt_array($curl, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => array_merge($requestHeaders, ['Expect:']),
        CURLOPT_HEADERFUNCTION => static function ($curlHandle, string $headerLine) use (&$responseStatus, &$responseContentType, $emitResponseHeaders): int {
            $headerLength = strlen($headerLine);
            $trimmed = trim($headerLine);

            if ($trimmed === '') {
                $emitResponseHeaders();
                return $headerLength;
            }

            if (preg_match('/^HTTP\/\S+\s+(\d{3})\b/i', $headerLine, $matches)) {
                $responseStatus = (int) $matches[1];
                $responseContentType = '';
                return $headerLength;
            }

            if (stripos($trimmed, 'Content-Type:') === 0) {
                $responseContentType = trim(substr($trimmed, strlen('Content-Type:')));
            }

            return $headerLength;
        },
        CURLOPT_WRITEFUNCTION => static function ($curlHandle, string $chunk) use (&$responseHeadersSent, &$responseStarted, &$responseStatus, &$responseContentType, $emitResponseHeaders): int {
            if (!$responseHeadersSent) {
                $emitResponseHeaders();
            }

            $responseStarted = true;
            echo $chunk;
            flush();

            return strlen($chunk);
        },
        CURLOPT_FAILONERROR => false,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 3600,
        CURLOPT_VERBOSE => false,
    ]);

    if ($method === 'POST') {
        curl_setopt($curl, CURLOPT_POSTFIELDS, $body);
    }

    $result = curl_exec($curl);
    $curlError = curl_error($curl);
    $responseCode = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    if ($responseCode > 0) {
        $responseStatus = $responseCode;
    }

    if (!$responseHeadersSent) {
        if ($result === false && !$responseStarted) {
            curl_close($curl);
            return false;
        }

        $emitResponseHeaders();
    }

    curl_close($curl);

    if ($result === false && !$responseStarted && !$responseHeadersSent) {
        return false;
    }

    if ($result === false && $curlError !== '') {
        error_log('AI-Powered curl proxy warning: ' . $curlError);
    }

    return true;
}

function app_proxy_ai_powered_endpoint_via_stream(string $candidateTarget, $context, string $endpoint): bool
{
    $stream = @fopen($candidateTarget, 'rb', false, $context);
    if ($stream === false) {
        return false;
    }

    $responseHeaders = $http_response_header ?? [];
    $status = app_parse_http_status_code($responseHeaders) ?? 502;
    $contentType = app_http_header_value($responseHeaders, 'Content-Type');
    app_emit_ai_powered_proxy_headers($status, $contentType, $endpoint);

    while (!feof($stream)) {
        $chunk = fread($stream, 8192);
        if ($chunk === false) {
            break;
        }

        if ($chunk === '') {
            continue;
        }

        echo $chunk;
        flush();
    }

    fclose($stream);
    return true;
}

function app_emit_ai_powered_proxy_headers(int $status, ?string $contentType, string $endpoint): void
{
    http_response_code($status);
    header('Cache-Control: no-store');
    header('X-Accel-Buffering: no');
    header('Content-Type: ' . app_ai_powered_proxy_content_type($contentType, $endpoint));
}

function app_ai_powered_proxy_content_type(?string $contentType, string $endpoint): string
{
    $defaultContentType = in_array($endpoint, ['health', 'providers', 'models'], true)
        ? 'application/json; charset=utf-8'
        : 'text/plain; charset=utf-8';

    $normalized = trim((string) $contentType);
    return $normalized !== '' ? $normalized : $defaultContentType;
}

function app_ai_powered_target_candidates(): array
{
    $candidates = [];
    $configured = trim((string) getenv('AI_POWERED_BASE_URL'));
    if ($configured !== '' && preg_match('/^[a-z][a-z\d+.-]*:\/\//i', $configured) === 1) {
        $candidates[] = rtrim($configured, '/');
    }

    $candidates[] = 'http://127.0.0.1:3001';
    $candidates[] = 'http://localhost:3001';
    $candidates[] = 'http://[::1]:3001';

    return array_values(array_unique(array_filter($candidates)));
}

function app_parse_http_status_code(array $headers): ?int
{
    foreach ($headers as $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d{3})\b/i', (string) $header, $matches)) {
            return (int) $matches[1];
        }
    }

    return null;
}

function app_http_header_value(array $headers, string $name): ?string
{
    $prefix = strtolower(trim($name)) . ':';
    foreach ($headers as $header) {
        $line = strtolower(trim((string) $header));
        if (strpos($line, $prefix) !== 0) {
            continue;
        }

        return trim(substr((string) $header, strlen($prefix)));
    }

    return null;
}
