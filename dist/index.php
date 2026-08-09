<?php
declare(strict_types=1);

require __DIR__ . '/api/bootstrap.php';

app_start_session();
app_cleanup_storage();

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');

if (isset($_GET['logout'])) {
    app_logout();
    header('Location: ./');
    exit;
}

$loginError = null;
if (app_is_auth_enabled() && !app_is_authenticated() && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = (string) ($_POST['password'] ?? '');
    $csrf = (string) ($_POST['csrf_token'] ?? '');
    if ($csrf !== app_csrf_token()) {
        $loginError = 'Your session expired. Please try again.';
    } elseif (app_login($password)) {
        header('Location: ./');
        exit;
    } else {
        $loginError = 'That password did not work.';
    }
}

$appHtmlPath = __DIR__ . '/index.html';
if (!is_file($appHtmlPath)) {
    render_missing_build();
    exit;
}

if (app_is_auth_enabled() && !app_is_authenticated()) {
    render_login_page($loginError);
    exit;
}

$html = file_get_contents($appHtmlPath);
if ($html === false) {
    render_missing_build();
    exit;
}

$config = app_build_config();
$injection = '<script>window.__TRANSCRIBE_CONFIG__ = Object.assign(window.__TRANSCRIBE_CONFIG__ || {}, ' .
    json_encode($config, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) .
    ');</script>';

$html = str_replace('</head>', $injection . "\n</head>", $html, $count);
if ($count === 0) {
    $html .= $injection;
}

header('Content-Type: text/html; charset=utf-8');
echo $html;

function render_missing_build()
{
    http_response_code(500);
    header('Content-Type: text/html; charset=utf-8');
    echo <<<HTML
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Py Transcribe Studio</title>
    <style>
      body { font-family: sans-serif; margin: 0; padding: 2rem; background: #f3ede3; color: #162235; }
      .card { max-width: 42rem; margin: 4rem auto; padding: 2rem; background: rgba(255,255,255,.82); border-radius: 1.25rem; box-shadow: 0 18px 40px rgba(14,28,44,.12); }
      code { background: rgba(0,0,0,.06); padding: .15rem .35rem; border-radius: .35rem; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Py Transcribe Studio</h1>
      <p>The built <code>index.html</code> file is missing. Run the Vite build locally and upload the generated <code>dist/</code> folder to your host.</p>
    </div>
  </body>
</html>
HTML;
    exit;
}

function render_login_page(?string $loginError = null)
{
    $csrf = app_csrf_token();
    $errorHtml = $loginError
        ? '<p class="error">' . htmlspecialchars($loginError, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</p>'
        : '';

    echo <<<HTML
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Py Transcribe Studio</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
    <style>
      body { display: grid; place-items: center; min-height: 100vh; }
      .login-shell { width: min(520px, calc(100% - 2rem)); padding: 2rem; }
      .login-copy { display: grid; gap: 1rem; margin-bottom: 1.5rem; }
      .login-form { display: grid; gap: 0.9rem; }
      .login-form input { width: 100%; min-height: 3rem; padding: .8rem 1rem; border-radius: 0.85rem; border: 1px solid rgba(15,23,42,.12); }
      .login-form button { min-height: 3rem; border-radius: 999px; border: 0; background: linear-gradient(135deg, #162235, #27405d); color: #fff; font-weight: 700; }
      .eyebrow { text-transform: uppercase; letter-spacing: 0.16em; font-size: 0.78rem; color: #0f766e; font-family: 'Space Grotesk', sans-serif; }
      .error { color: #b42318; font-weight: 600; }
      .hint { color: #5b6679; }
    </style>
  </head>
  <body>
    <main class="card login-shell">
      <div class="login-copy">
        <p class="eyebrow">Protected workspace</p>
        <h1 id="hero-title">Open the studio</h1>
        <p class="hint">This deployment is protected with a session password. Enter it once to unlock the transcription workspace.</p>
        {$errorHtml}
      </div>
      <form class="login-form" method="post" action="./">
        <input type="hidden" name="csrf_token" value="{$csrf}" />
        <label>
          <span class="hint">Password</span>
          <input type="password" name="password" autocomplete="current-password" />
        </label>
        <button type="submit">Unlock workspace</button>
      </form>
    </main>
  </body>
</html>
HTML;
    exit;
}
