<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

app_start_session();
app_cleanup_storage();

if (!app_is_authenticated()) {
    app_json([
        'ok' => false,
        'error' => 'Login required.'
    ], 403);
}

$id = trim((string) ($_GET['id'] ?? ''));
if ($id === '' || !preg_match('/^[a-f0-9]{24}$/', $id)) {
    app_text('Missing or invalid file id.', 400);
}

$manifest = app_manifest_load();
$file = $manifest['uploads'][$id] ?? null;
if (!is_array($file)) {
    app_text('File not found.', 404);
}

$storedName = (string) ($file['storedName'] ?? '');
$originalName = (string) ($file['originalName'] ?? 'audio');
$mime = (string) ($file['mime'] ?? 'application/octet-stream');
$path = app_upload_dir() . DIRECTORY_SEPARATOR . $storedName;
if (!is_file($path)) {
    app_text('File not found.', 404);
}

app_file_response($path, $originalName, $mime);
