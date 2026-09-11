## Conventions

* Do not add version query parameters and version/cache-busting markers

Common patterns include (DO NOT ADD THESE):

app.js?v=5 — simple manual version number.
app.js?v=1.4.2 — semantic version.
app.js?version=5 — same idea, more explicit.
app.js?build=128 — CI/build number.
app.js?rev=abc123 — Git commit or revision ID.
app.js?t=1726038000 — timestamp.
app.js?cache=20260911 — date-based marker.
app.js?cb=xyz123 — generic cache-buster.
app.8f31c2a.js — content hash in filename, very common in production.
styles.a92d71.css — hashed CSS filename.
/assets/v5/app.js — version in the path.
/v2/api/... — versioned API/path, though this usually means actual API compatibility rather than cache busting.
data-version="5" — version stored in HTML/DOM metadata.
<meta name="build-version" content="5"> — build/version metadata.
window.APP_VERSION = "5" or import.meta.env.VITE_APP_VERSION — version exposed in JavaScript.
