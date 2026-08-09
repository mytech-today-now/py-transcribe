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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    app_json([
        'ok' => false,
        'error' => 'Use POST for uploads.'
    ], 405);
}

app_require_csrf();

if (!isset($_FILES['audio'])) {
    app_json([
        'ok' => false,
        'error' => 'No file was uploaded.'
    ], 400);
}

$upload = $_FILES['audio'];
if (!is_array($upload) || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    app_json([
        'ok' => false,
        'error' => 'Upload failed.'
    ], 400);
}

$tmpName = (string) ($upload['tmp_name'] ?? '');
$originalName = (string) ($upload['name'] ?? 'audio');
$size = (int) ($upload['size'] ?? 0);
$errorCode = (int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE);

if ($errorCode !== UPLOAD_ERR_OK || !is_uploaded_file($tmpName)) {
    app_json([
        'ok' => false,
        'error' => 'Upload was not accepted by PHP.'
    ], 400);
}

if ($size <= 0) {
    app_json([
        'ok' => false,
        'error' => 'The uploaded file is empty.'
    ], 400);
}

$serverLimit = app_max_upload_bytes();
if ($size > $serverLimit) {
    app_json([
        'ok' => false,
        'error' => 'The file is larger than the host upload limit.',
        'limitBytes' => $serverLimit
    ], 413);
}

$mime = app_detect_mime($tmpName);
$extension = app_extension_for_upload($originalName, $mime);
$allowed = strpos($mime, 'audio/') === 0
    || strpos($mime, 'video/') === 0
    || $mime === 'application/ogg';

if (!$allowed) {
    app_json([
        'ok' => false,
        'error' => 'Unsupported file type.'
    ], 415);
}

$id = bin2hex(random_bytes(12));
$safeBase = app_safe_filename($originalName);
$storedName = $id . '-' . $safeBase . '.' . $extension;
$destination = app_upload_dir() . DIRECTORY_SEPARATOR . $storedName;

if (!move_uploaded_file($tmpName, $destination)) {
    app_json([
        'ok' => false,
        'error' => 'Could not save the uploaded file.'
    ], 500);
}

$manifest = app_manifest_load();
$manifest['uploads'][$id] = [
    'id' => $id,
    'originalName' => $originalName,
    'storedName' => $storedName,
    'mime' => $mime,
    'size' => $size,
    'kind' => strpos($mime, 'video/') === 0 ? 'video' : 'audio',
    'createdAt' => time()
];
app_manifest_save($manifest);

app_json([
    'ok' => true,
    'file' => [
        'id' => $id,
        'originalName' => $originalName,
        'storedName' => $storedName,
        'mime' => $mime,
        'size' => $size,
        'kind' => strpos($mime, 'video/') === 0 ? 'video' : 'audio',
        'createdAt' => time(),
        'downloadUrl' => 'api/download.php?id=' . rawurlencode($id)
    ]
]);
