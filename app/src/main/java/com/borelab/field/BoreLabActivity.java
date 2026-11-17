package com.borelab.field;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import org.json.JSONObject;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

/** Standalone HDD crew app. Web app assets are local; records use WebView storage. */
public class BoreLabActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/assets/index.html";
    private static final int REQ_LOCATION = 41;
    private static final int REQ_FILE = 42;
    private static final int REQ_SAVE = 43;

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private Uri capturedPhotoUri;
    private GeolocationPermissions.Callback pendingLocation;
    private String pendingLocationOrigin;
    private byte[] exportBytes;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().setNavigationBarColor(Color.WHITE);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(9, 20, 31));
        setContentView(webView);
        applySystemTheme(true);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.addJavascriptInterface(new FileExportBridge(), "BoreLabNative");

        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!HOST.equalsIgnoreCase(uri.getHost())) return null;
                String p = uri.getPath();
                if (p == null || !p.startsWith("/assets/")) return notFound();
                String file = p.substring("/assets/".length());
                if (file.length() == 0) file = "index.html";
                if (file.contains("..") || file.startsWith("/")) return notFound();
                try {
                    InputStream input = getAssets().open("web/" + file);
                    Map<String,String> headers = new HashMap<>();
                    headers.put("Access-Control-Allow-Origin", "https://" + HOST);
                    headers.put("Cache-Control", "no-cache");
                    return new WebResourceResponse(mime(file), "UTF-8", 200, "OK", headers, input);
                } catch (Exception ignored) {
                    return notFound();
                }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (HOST.equalsIgnoreCase(uri.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException e) {
                    toast("No app available to open this link.");
                }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (hasLocation()) {
                    callback.invoke(origin, true, false);
                    return;
                }
                pendingLocation = callback;
                pendingLocationOrigin = origin;
                requestPermissions(new String[] {
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                }, REQ_LOCATION);
            }

            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    String[] accepts = params.getAcceptTypes();
                    boolean json = false;
                    if (accepts != null) for (String a : accepts) {
                        if (a.contains("json")) json = true;
                    }
                    if (!json && params.isCaptureEnabled() && startCamera()) return true;

                    Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                    pick.setType(json ? "application/json" : "image/*");
                    pick.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(Intent.createChooser(pick, json ? "Restore BoreLab backup" : "Select jobsite photo"), REQ_FILE);
                    return true;
                } catch (Exception e) {
                    fileCallback = null;
                    callback.onReceiveValue(null);
                    toast("Unable to open file picker.");
                    return false;
                }
            }
        });
        webView.loadUrl(HOME);
    }

    private static String mime(String p) {
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
    }

    private boolean hasLocation() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
               checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code != REQ_LOCATION || pendingLocation == null) return;
        pendingLocation.invoke(pendingLocationOrigin, hasLocation(), false);
        pendingLocation = null;
        pendingLocationOrigin = null;
    }

    private boolean startCamera() {
        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (camera.resolveActivity(getPackageManager()) == null) return false;
        try {
            ContentValues v = new ContentValues();
            v.put(MediaStore.Images.Media.DISPLAY_NAME, "BoreLab_" + System.currentTimeMillis() + ".jpg");
            v.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
            if (Build.VERSION.SDK_INT >= 29) v.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/BoreLab");
            capturedPhotoUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
            if (capturedPhotoUri == null) return false;
            camera.putExtra(MediaStore.EXTRA_OUTPUT, capturedPhotoUri);
            camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            startActivityForResult(camera, REQ_FILE);
            return true;
        } catch (Exception e) {
            capturedPhotoUri = null;
            return false;
        }
    }

    @Override protected void onActivityResult(int code, int resultCode, Intent data) {
        super.onActivityResult(code, resultCode, data);
        if (code == REQ_FILE && fileCallback != null) {
            Uri[] selected = null;
            if (resultCode == RESULT_OK) {
                Uri uri = data != null ? data.getData() : null;
                if (uri == null) uri = capturedPhotoUri;
                if (uri != null) selected = new Uri[] { uri };
            } else if (capturedPhotoUri != null) {
                getContentResolver().delete(capturedPhotoUri, null, null);
            }
            fileCallback.onReceiveValue(selected);
            fileCallback = null;
            capturedPhotoUri = null;
        } else if (code == REQ_SAVE) {
            if (resultCode == RESULT_OK && data != null && exportBytes != null) {
                try (OutputStream stream = getContentResolver().openOutputStream(data.getData())) {
                    if (stream == null) throw new IllegalStateException("No file access");
                    stream.write(exportBytes);
                    toast("BoreLab file saved");
                } catch (Exception e) {
                    toast("Unable to save file: " + e.getMessage());
                }
            }
            exportBytes = null;
        }
    }

    private void toast(String msg) {
        runOnUiThread(() -> Toast.makeText(this, msg, Toast.LENGTH_LONG).show());
    }

    private void applySystemTheme(boolean daylight) {
        int color = daylight ? Color.WHITE : Color.rgb(9, 20, 31);
        getWindow().setStatusBarColor(color);
        getWindow().setNavigationBarColor(color);
        getWindow().getDecorView().setSystemUiVisibility(daylight
            ? (View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR)
            : 0);
        if (webView != null) webView.setBackgroundColor(color);
    }


    /** The bundled ML Kit model reads product label text on-device. No cloud upload. */
    private void recognizeProductLabel(String dataUrl) {
        new Thread(() -> {
            Bitmap bitmap = null;
            try {
                if (dataUrl == null || !dataUrl.startsWith("data:image/") || !dataUrl.contains(",")) {
                    throw new IllegalArgumentException("Select a readable label photo.");
                }
                String encoded = dataUrl.substring(dataUrl.indexOf(',') + 1);
                if (encoded.length() > 12000000) {
                    throw new IllegalArgumentException("Image too large; take a closer photo.");
                }
                byte[] imageBytes = Base64.decode(encoded, Base64.DEFAULT);
                BitmapFactory.Options options = new BitmapFactory.Options();
                options.inJustDecodeBounds = true;
                BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length, options);
                if (options.outWidth <= 0 || options.outHeight <= 0) {
                    throw new IllegalArgumentException("The selected image could not be decoded.");
                }
                int sample = 1;
                while (options.outWidth / sample > 2000 || options.outHeight / sample > 2000) sample *= 2;
                options.inJustDecodeBounds = false;
                options.inSampleSize = sample;
                bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length, options);
                if (bitmap == null) throw new IllegalArgumentException("Unreadable product image.");
                final Bitmap decoded = bitmap;
                TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
                recognizer.process(InputImage.fromBitmap(decoded, 0))
                    .addOnSuccessListener(result -> {
                        sendScanResult(result.getText(), null);
                        decoded.recycle();
                        recognizer.close();
                    })
                    .addOnFailureListener(error -> {
                        sendScanResult("", error.getMessage());
                        decoded.recycle();
                        recognizer.close();
                    });
            } catch (Exception error) {
                if (bitmap != null && !bitmap.isRecycled()) bitmap.recycle();
                sendScanResult("", error.getMessage());
            }
        }, "BoreLab-Label-OCR").start();
    }

    /** Quote all OCR content as JS string data so label text is never executed as code. */
    private void sendScanResult(String text, String error) {
        String escapedText = JSONObject.quote(text == null ? "" : text);
        String escapedError = error == null ? "null" : JSONObject.quote(error);
        runOnUiThread(() -> {
            if (webView != null) {
                webView.evaluateJavascript(
                    "window.borelabOnLabelScan && window.borelabOnLabelScan(" +
                    escapedText + "," + escapedError + ");", null);
            }
        });
    }

    final class FileExportBridge {
        /** OCR text scanning runs on-device using the model bundled inside the APK. */
        @JavascriptInterface public void scanProductLabel(String dataUrl) {
            recognizeProductLabel(dataUrl);
        }

        @JavascriptInterface public void setTheme(String mode) {
            runOnUiThread(() -> applySystemTheme(!"dark".equals(mode)));
        }


        /** Create a real PDF, then let Android's document picker choose its destination. */
        @JavascriptInterface public void exportPdf(String name, String reportJson) {
            new Thread(() -> {
                try {
                    if (reportJson == null || reportJson.length() > 40000000) {
                        throw new IllegalArgumentException("Report is too large. Remove some photos and retry.");
                    }
                    final byte[] bytes = FieldPdfExporter.generate(reportJson);
                    runOnUiThread(() -> {
                        if (exportBytes != null) {
                            toast("Finish saving the previous export first.");
                            return;
                        }
                        exportBytes = bytes;
                        Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                        save.addCategory(Intent.CATEGORY_OPENABLE);
                        save.setType("application/pdf");
                        save.putExtra(Intent.EXTRA_TITLE,
                                name == null || name.isEmpty() ? "BoreLab_Field_Report.pdf" : name);
                        try {
                            startActivityForResult(save, REQ_SAVE);
                        } catch (Exception e) {
                            exportBytes = null;
                            toast("Unable to open PDF save dialog.");
                        }
                    });
                } catch (Exception e) {
                    toast("PDF generation failed: " + e.getMessage());
                }
            }, "BoreLab-PDF").start();
        }

        @JavascriptInterface public void saveBase64File(String name, String mime, String base64) {
            try {
                final byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                runOnUiThread(() -> {
                    exportBytes = bytes;
                    Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    save.addCategory(Intent.CATEGORY_OPENABLE);
                    save.setType(mime == null ? "application/octet-stream" : mime);
                    save.putExtra(Intent.EXTRA_TITLE, name == null ? "BoreLab_export" : name);
                    try {
                        startActivityForResult(save, REQ_SAVE);
                    } catch (Exception e) {
                        exportBytes = null;
                        toast("Unable to open save dialog.");
                    }
                });
            } catch (Exception e) {
                toast("Export failed: " + e.getMessage());
            }
        }
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (webView != null) { webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
