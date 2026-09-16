package com.codepath.app;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.ViewGroup;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

/**
 * Hosts the CodePath web app (assets/www) in a WebView and wires the few things
 * a browser would normally do for it:
 *
 *   - YouTube / mail / phone links open in the matching app instead of the WebView
 *   - "Export backup" is handed to the native bridge and saved to Downloads
 *   - "Import backup" reuses the system file picker (onShowFileChooser)
 *   - localStorage works (progress + favourites), and the Android back button
 *     behaves like the browser's
 *
 * Uses framework APIs only, so the APK needs no support libraries.
 */
public class MainActivity extends Activity {

    private static final String START_URL = "file:///android_asset/www/index.html";
    private static final String BRIDGE_NAME = "CodePathAndroid";
    private static final int REQUEST_FILE_CHOOSER = 1024;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#FF080C1A")); // matches the app's dark theme
        setContentView(web, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        configureWebView();

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        if (savedInstanceState == null) {
            web.loadUrl(START_URL);
        } else {
            web.restoreState(savedInstanceState);
        }
    }

    /* ------------------------------------------------------------ setup --- */

    private void configureWebView() {
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);   // progress + favourites live in localStorage
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);

        web.addJavascriptInterface(new BackupBridge(), BRIDGE_NAME);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUri(request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUri(Uri.parse(url));
            }

            @Override
            public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                toast("The page crashed — reloading");
                view.destroy();
                web = new WebView(MainActivity.this);
                web.setBackgroundColor(Color.parseColor("#FF080C1A"));
                setContentView(web);
                configureWebView();
                web.loadUrl(START_URL);
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = callback;

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*"); // the app validates the file contents itself
                try {
                    startActivityForResult(
                            Intent.createChooser(intent, getString(R.string.pick_backup)),
                            REQUEST_FILE_CHOOSER);
                    return true;
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    toast("No file picker is available on this device");
                    return false;
                }
            }
        });

        // Safety net for downloads that do not go through the bridge.
        web.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                        String mimeType, long contentLength) {
                if (url != null && url.startsWith("data:")) {
                    saveDataUri(url, mimeType);
                    return;
                }
                if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) {
                    try {
                        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                        request.setMimeType(mimeType);
                        request.setNotificationVisibility(
                                DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                        DownloadManager manager =
                                (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                        if (manager != null) {
                            manager.enqueue(request);
                            toast(getString(R.string.download_started));
                            return;
                        }
                    } catch (Exception ignored) {
                        // fall through to the message below
                    }
                }
                toast(getString(R.string.use_export));
            }
        });
    }

    /* ------------------------------------------------------- link routing - */

    /** Local content stays in the WebView, everything else opens in its own app. */
    private boolean handleUri(Uri uri) {
        if (uri == null) {
            return false;
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if (scheme.equals("file") || scheme.equals("about")
                || scheme.equals("data") || scheme.equals("javascript")) {
            return false;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            toast(getString(R.string.no_app_for_link, uri.getHost() == null ? scheme : uri.getHost()));
        }
        return true;
    }

    /* -------------------------------------------------------- backup/restore */

    /**
     * Exposed to the web app as window.CodePathAndroid. Only reachable from the
     * bundled page, because remote URLs never load inside this WebView.
     */
    private class BackupBridge {

        @JavascriptInterface
        public String saveBackup(String filename, String json, String mime) {
            if (json == null || json.isEmpty()) {
                return "Nothing to export yet";
            }
            String type = (mime == null || mime.isEmpty()) ? "application/json" : mime;
            try {
                return writeToDownloads(safeName(filename), json, type);
            } catch (Exception e) {
                return "Could not save the backup: " + e.getMessage();
            }
        }
    }

    private String safeName(String filename) {
        String name = (filename == null || filename.trim().isEmpty())
                ? "codepath-backup.json" : filename.trim();
        name = name.replace('\\', '-').replace('/', '-').replace(':', '-');
        if (!name.toLowerCase().endsWith(".json")) {
            name = name + ".json";
        }
        return name;
    }

    /** Android 10+ writes to the public Downloads collection, older ones to app storage. */
    private String writeToDownloads(String filename, String text, String mime) throws Exception {
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH,
                    Environment.DIRECTORY_DOWNLOADS + "/CodePath");
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);

            Uri target = getContentResolver()
                    .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (target == null) {
                throw new IllegalStateException("the Downloads folder is unavailable");
            }
            OutputStream out = getContentResolver().openOutputStream(target);
            if (out == null) {
                throw new IllegalStateException("the file could not be created");
            }
            try {
                out.write(bytes);
            } finally {
                out.close();
            }
            values.clear();
            values.put(MediaStore.MediaColumns.IS_PENDING, 0);
            getContentResolver().update(target, values, null, null);
            return "Saved to Downloads/CodePath/" + filename;
        }

        File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) {
            dir = getFilesDir();
        }
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("the folder could not be created");
        }
        File file = new File(dir, filename);
        FileOutputStream out = new FileOutputStream(file);
        try {
            out.write(bytes);
        } finally {
            out.close();
        }
        return "Saved to " + file.getAbsolutePath();
    }

    /** Handles the data: URI fallback used when Blob URLs are unavailable. */
    private void saveDataUri(String dataUri, String fallbackMime) {
        try {
            int comma = dataUri.indexOf(',');
            if (comma < 0) {
                throw new IllegalArgumentException("no payload");
            }
            String meta = dataUri.substring(5, comma);
            String payload = dataUri.substring(comma + 1);
            String text = meta.contains(";base64")
                    ? new String(Base64.decode(payload, Base64.DEFAULT), StandardCharsets.UTF_8)
                    : URLDecoder.decode(payload, "UTF-8");

            String mime = meta.split(";")[0];
            if (mime.isEmpty()) {
                mime = fallbackMime == null ? "application/json" : fallbackMime;
            }
            String name = mime.contains("json") ? "codepath-backup.json" : "codepath-export.txt";
            toast(writeToDownloads(name, text, mime));
        } catch (Exception e) {
            toast(getString(R.string.use_export));
        }
    }

    /* ----------------------------------------------------------- plumbing - */

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQUEST_FILE_CHOOSER) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(
                        WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                fileCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) {
            web.saveState(outState);
        }
    }

    @Override
    protected void onPause() {
        if (web != null) {
            web.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    private void toast(final String message) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show();
            }
        });
    }
}
