package com.borelab.field;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.ClipData;
import android.database.Cursor;
import java.util.UUID;
import java.io.IOException;
import android.content.Context;
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
import android.speech.RecognizerIntent;
import java.util.ArrayList;
import android.util.Base64;
import android.view.View;
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader;
import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.text.PDFTextStripper;
import org.json.JSONArray;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import androidx.core.content.FileProvider;
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
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Map;

/** Standalone HDD crew app. Web app assets are local; records use WebView storage. */
public class BoreLabActivity extends Activity {
    private final SyncFolderBridge syncFolder=new SyncFolderBridge(this);
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/assets/index.html";
    private static final int REQ_LOCATION = 41;
    private static final int REQ_FILE = 42;
    private static final int REQ_SAVE = 43;
    private static final int REQ_MANUAL = 44;
    private static final int REQ_VOICE = 45;
    private static final int REQ_VIDEO = 46;
    private static final long MAX_VIDEO_BYTES = 200L * 1024L * 1024L;
    private static final long MAX_MANUAL_BYTES = 80L * 1024L * 1024L;

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private Uri capturedPhotoUri;
    private Uri capturedVideoUri;
    private File capturedVideoFile;
    private GeolocationPermissions.Callback pendingLocation;
    private String pendingLocationOrigin;
    private byte[] exportBytes;
    private CloseoutFiles closeoutFiles;
    private String pendingManualSlot;
    private final ExecutorService manualSearchExecutor = Executors.newSingleThreadExecutor();

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
        // Identify BoreLab on external map-tile requests while preserving WebView compatibility.
        settings.setUserAgentString(settings.getUserAgentString() + " BoreLabField/0.18");
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        closeoutFiles = new CloseoutFiles(this, webView);
        webView.addJavascriptInterface(new FileExportBridge(), "BoreLabNative");
        webView.addJavascriptInterface(syncFolder, "BoreLabSyncFolder");

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
                if ("tel".equalsIgnoreCase(uri.getScheme())) {
                    try {
                        startActivity(new Intent(Intent.ACTION_DIAL, uri));
                    } catch (ActivityNotFoundException e) {
                        toast("No dialer app is available on this device.");
                    }
                    return true;
                }
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
                    boolean json = false, pdf = false;
                    if (accepts != null) for (String a : accepts) {
                        if (a == null) continue;
                        if (a.contains("json")) json = true;
                        if (a.contains("pdf")) pdf = true;
                    }
                    if (!json && !pdf && params.isCaptureEnabled() && startCamera()) return true;

                    Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                    pick.setType(json ? "application/json" : pdf ? "*/*" : "image/*");
                    if (pdf) pick.putExtra(Intent.EXTRA_MIME_TYPES,
                            new String[] {"application/pdf", "image/jpeg", "image/png", "image/webp"});
                    pick.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(Intent.createChooser(pick,
                            json ? "Restore BoreLab backup" : pdf ? "Choose receipt photo or PDF" : "Select jobsite photo"), REQ_FILE);
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
        if(syncFolder.result(code,resultCode,data))return;
        if (closeoutFiles != null && closeoutFiles.onResult(code, resultCode, data)) return;
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
        } else if (code == REQ_VIDEO) {
            Uri selected = resultCode == RESULT_OK && data != null ? data.getData() : null;
            if (selected == null && resultCode == RESULT_OK && capturedVideoFile != null && capturedVideoFile.isFile()
                    && capturedVideoFile.length() > 0L) selected = capturedVideoUri;
            if (selected != null) copyFieldVideo(selected);
            else toast("Video not added.");
            capturedVideoUri = null;
            capturedVideoFile = null;
        } else if (code == REQ_MANUAL) {
            final String slot = pendingManualSlot;
            pendingManualSlot = null;
            if (slot != null && resultCode == RESULT_OK && data != null && data.getData() != null) {
                copyManualFromPicker(slot, data.getData());
            } else {
                sendManualStatus(null);
            }
        } else if (code == REQ_VOICE) {
            ArrayList<String> results = resultCode == RESULT_OK && data != null
                ? data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS) : null;
            String transcript = results != null && !results.isEmpty() ? results.get(0) : "";
            if (webView != null) webView.evaluateJavascript(
                "window.borelabVoiceResult && window.borelabVoiceResult(" + JSONObject.quote(transcript) + ");", null);
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




    /** OCR for paperwork is user-initiated, on-device, and never auto-saves field data. */
    private void recognizeAddressPhoto(String dataUrl) {
        recognizePaperwork(dataUrl, false);
    }

    /** Read a shot sheet; send the raw recognized text to an editable import preview. */
    private void recognizeShotSheet(String dataUrl) {
        recognizePaperwork(dataUrl, true);
    }

    /** Additional high-contrast pass can recover handwriting and labels on skewed paperwork.
     * Both OCR candidates are provided for review; neither is saved as field data. */
    private Bitmap highContrastPaperwork(Bitmap source) {
        final int width = source.getWidth(), height = source.getHeight();
        Bitmap enhanced = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        int[] row = new int[width];
        for (int y = 0; y < height; y++) {
            source.getPixels(row, 0, width, 0, y, width, 1);
            for (int x = 0; x < width; x++) {
                int pixel = row[x];
                int gray = (Color.red(pixel) * 299 + Color.green(pixel) * 587 +
                    Color.blue(pixel) * 114) / 1000;
                int contrast = Math.max(0, Math.min(255, (int) ((gray - 128) * 1.75 + 144)));
                row[x] = Color.rgb(contrast, contrast, contrast);
            }
            enhanced.setPixels(row, 0, width, 0, y, width, 1);
        }
        return enhanced;
    }

    private void recognizePaperwork(String dataUrl, boolean shotSheet) {
        new Thread(() -> {
            Bitmap bitmap = null;
            try {
                if (dataUrl == null || !dataUrl.startsWith("data:image/") || !dataUrl.contains(","))
                    throw new IllegalArgumentException("Select a readable photo.");
                String encoded = dataUrl.substring(dataUrl.indexOf(',') + 1);
                if (encoded.length() > 16000000)
                    throw new IllegalArgumentException("Picture exceeds the scan limit.");
                byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
                BitmapFactory.Options options = new BitmapFactory.Options();
                options.inJustDecodeBounds = true;
                BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
                if (options.outWidth <= 0 || options.outHeight <= 0)
                    throw new IllegalArgumentException("Picture could not be decoded.");
                int sample = 1;
                while (options.outWidth / sample > 2300 || options.outHeight / sample > 2300)
                    sample *= 2;
                options.inJustDecodeBounds = false;
                options.inSampleSize = sample;
                bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
                if (bitmap == null) throw new IllegalArgumentException("Cannot open the image.");
                final Bitmap decoded = bitmap;
                Bitmap contrasted;
                try { contrasted = highContrastPaperwork(decoded); }
                catch (OutOfMemoryError memoryError) { contrasted = null; }
                final Bitmap improved = contrasted;
                final TextRecognizer recognizer =
                    TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
                recognizer.process(InputImage.fromBitmap(decoded, 0))
                    .addOnSuccessListener(original -> {
                        final String raw = original.getText();
                        if (improved == null) {
                            sendPaperworkScanResult(raw, null, null, shotSheet);
                            decoded.recycle();
                            recognizer.close();
                            return;
                        }
                        recognizer.process(InputImage.fromBitmap(improved, 0))
                            .addOnSuccessListener(contrast -> {
                                sendPaperworkScanResult(raw, contrast.getText(), null, shotSheet);
                                decoded.recycle(); improved.recycle(); recognizer.close();
                            })
                            .addOnFailureListener(error -> {
                                sendPaperworkScanResult(raw, null,
                                    "High-contrast scan unavailable; original scan retained.", shotSheet);
                                decoded.recycle(); improved.recycle(); recognizer.close();
                            });
                    })
                    .addOnFailureListener(error -> {
                        if (improved == null) {
                            sendPaperworkScanResult("", null, error.getMessage(), shotSheet);
                            decoded.recycle(); recognizer.close();
                            return;
                        }
                        recognizer.process(InputImage.fromBitmap(improved, 0))
                            .addOnSuccessListener(contrast -> {
                                sendPaperworkScanResult("", contrast.getText(), null, shotSheet);
                                decoded.recycle(); improved.recycle(); recognizer.close();
                            })
                            .addOnFailureListener(secondError -> {
                                sendPaperworkScanResult("", null,
                                    "OCR could not read this photo. Try a closer, brighter shot.", shotSheet);
                                decoded.recycle(); improved.recycle(); recognizer.close();
                            });
                    });
            } catch (Exception e) {
                if (bitmap != null && !bitmap.isRecycled()) bitmap.recycle();
                sendPaperworkScanResult("", null, e.getMessage(), shotSheet);
            } catch (OutOfMemoryError e) {
                if (bitmap != null && !bitmap.isRecycled()) bitmap.recycle();
                sendPaperworkScanResult("", null, "Photo is too large for the device. Crop the label and retry.", shotSheet);
            }
        }, shotSheet ? "BoreLab-ShotSheet-OCR" : "BoreLab-Address-OCR").start();
    }

    private void sendPaperworkScanResult(String text, String enhanced, String error,
                                          boolean shotSheet) {
        String escaped = JSONObject.quote(text == null ? "" : text);
        String escapedEnhanced = JSONObject.quote(enhanced == null ? "" : enhanced);
        String escapedError = error == null ? "null" : JSONObject.quote(error);
        String callback = shotSheet ? "window.borelabOnShotSheetScan" : "window.borelabOnAddressScan";
        runOnUiThread(() -> {
            if (webView != null)
                webView.evaluateJavascript(
                    callback + " && " + callback + "(" +
                    escaped + "," + escapedError + "," + escapedEnhanced + ");", null);
        });
    }

    /** Private /files/manuals contains explicitly imported PDFs, checked against disk. */
    private File manualFolder() throws Exception {
        File dir = new File(getFilesDir(), "manuals");
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IllegalStateException("Could not create manual folder");
        return dir;
    }

    private String safeManualSlot(String slot) {
        if (slot == null || !slot.matches("[a-z0-9-]{2,70}"))
            throw new IllegalArgumentException("Invalid manual slot");
        return slot;
    }

    private File manualFile(String slot) throws Exception {
        return new File(manualFolder(), safeManualSlot(slot) + ".pdf");
    }

    private boolean isPdf(File pdf) {
        if (pdf == null || !pdf.isFile() || pdf.length() < 5 || pdf.length() > MAX_MANUAL_BYTES) return false;
        try (FileInputStream input = new FileInputStream(pdf)) {
            byte[] prefix = new byte[5];
            return input.read(prefix) == 5 &&
                prefix[0] == '%' && prefix[1] == 'P' && prefix[2] == 'D' &&
                prefix[3] == 'F' && prefix[4] == '-';
        } catch (Exception ignored) {
            return false;
        }
    }

    /** The saved checkmark is based on physical PDF files, not localStorage flags. */
    private void sendManualStatus(String message) {
        JSONObject found = new JSONObject();
        try {
            File[] files = manualFolder().listFiles();
            if (files != null) for (File file : files) {
                String name = file.getName();
                if (name.endsWith(".pdf") && isPdf(file)) {
                    String slot = name.substring(0, name.length() - 4);
                    if (slot.matches("[a-z0-9-]{2,70}")) found.put(slot, true);
                }
            }
        } catch (Exception e) {
            message = "Could not scan saved manuals: " + e.getMessage();
        }
        String js = "window.borelabOnManuals && window.borelabOnManuals(" +
            found.toString() + "," + (message == null ? "null" : JSONObject.quote(message)) + ");";
        runOnUiThread(() -> {
            if (webView != null) webView.evaluateJavascript(js, null);
        });
    }

    private void copyManualFromPicker(String slot, Uri uri) {
        new Thread(() -> {
            File temp = null;
            try {
                File dest = manualFile(slot);
                temp = new File(manualFolder(), slot + ".importing");
                long total = 0;
                try (InputStream source = getContentResolver().openInputStream(uri);
                     FileOutputStream output = new FileOutputStream(temp)) {
                    if (source == null) throw new IllegalStateException("Cannot read selected PDF");
                    byte[] buffer = new byte[16384];
                    int count;
                    while ((count = source.read(buffer)) != -1) {
                        total += count;
                        if (total > MAX_MANUAL_BYTES) throw new IllegalArgumentException("PDF exceeds 80 MB limit");
                        output.write(buffer, 0, count);
                    }
                    output.getFD().sync();
                }
                if (!isPdf(temp)) throw new IllegalArgumentException("Selected file is not a valid PDF");
                Files.move(temp.toPath(), dest.toPath(), StandardCopyOption.REPLACE_EXISTING);
                sendManualStatus("Manual saved offline. Ready to open without signal.");
            } catch (Exception e) {
                sendManualStatus("Manual import failed: " + e.getMessage());
            } finally {
                if (temp != null && temp.exists()) temp.delete();
            }
        }, "BoreLab-Manual-Import").start();
    }

    private void openSavedManual(String slot) {
        try {
            File file = manualFile(slot);
            if (!isPdf(file)) {
                sendManualStatus("The PDF is missing. Import it again.");
                return;
            }
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".manuals", file);
            Intent view = new Intent(Intent.ACTION_VIEW);
            view.setDataAndType(uri, "application/pdf");
            view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            try {
                startActivity(Intent.createChooser(view, "Open saved rig manual"));
            } catch (ActivityNotFoundException e) {
                toast("Install a PDF viewer to open saved manuals.");
            }
        } catch (Exception e) {
            sendManualStatus("Cannot open PDF: " + e.getMessage());
        }
    }

    @Override protected void onResume() {
        super.onResume();
        if (webView != null) { sendManualStatus(null); webView.evaluateJavascript("window.BoreLabCompanion && window.BoreLabCompanion.sync && window.BoreLabCompanion.sync()",null); }
    }


    /**
     * Searches actual text embedded in an imported manual, entirely on the device.
     * Scanned image-only PDFs require a future OCR pass and are reported as such.
     * Results are page-indexed: one excerpt per matching PDF page, maximum 100 matches.
     */
    private void searchSavedManual(String slot, String query, String requestId) {
        manualSearchExecutor.execute(() -> {
            JSONObject result = new JSONObject();
            JSONArray matches = new JSONArray();
            int textPages = 0, totalPages = 0, scannedPages = 0;
            try {
                if (query == null || query.trim().length() < 2 || query.length() > 80)
                    throw new IllegalArgumentException("Enter 2–80 characters to search.");
                File file = manualFile(slot);
                if (!isPdf(file))
                    throw new IllegalArgumentException("This PDF is not saved. Import it first.");
                PDFBoxResourceLoader.init(getApplicationContext());
                String needle = query.trim().toLowerCase(Locale.ROOT);
                try (PDDocument document = PDDocument.load(file)) {
                    totalPages = document.getNumberOfPages();
                    int limit = Math.min(900, totalPages);
                    PDFTextStripper reader = new PDFTextStripper();
                    for (int page = 1; page <= limit; page++) {
                        reader.setStartPage(page);
                        reader.setEndPage(page);
                        String text = reader.getText(document).replaceAll("\\s+", " ").trim();
                        if (!text.isEmpty()) textPages++;
                        int found = text.toLowerCase(Locale.ROOT).indexOf(needle);
                        if (found >= 0 && matches.length() < 100) {
                            int begin = Math.max(0, found - 70);
                            int end = Math.min(text.length(), found + needle.length() + 100);
                            String excerpt = (begin > 0 ? "…" : "") +
                                    text.substring(begin, end) + (end < text.length() ? "…" : "");
                            JSONObject hit = new JSONObject();
                            hit.put("page", page);
                            hit.put("snippet", excerpt);
                            matches.put(hit);
                        }
                    }
                    scannedPages = limit;
                }
                result.put("pageCount", totalPages);
                result.put("searchedPages", scannedPages);
                result.put("textPages", textPages);
                result.put("results", matches);
                result.put("truncated", matches.length() >= 100 || scannedPages < totalPages);
            } catch (Exception e) {
                try { result.put("error", String.valueOf(e.getMessage())); }
                catch (Exception ignored) {}
            }
            final String js = "window.borelabOnManualSearch && window.borelabOnManualSearch(" +
                JSONObject.quote(slot == null ? "" : slot) + "," +
                JSONObject.quote(query == null ? "" : query) + "," +
                JSONObject.quote(requestId == null ? "" : requestId) + "," + result.toString() + ");";
            runOnUiThread(() -> {
                if (webView != null) webView.evaluateJavascript(js, null);
            });
        });
    }

    /** Videos are stored as private Android files rather than base64 strings in IndexedDB.
     *  Camera clips and imported clips share the same 200MB per-file limit.
     */
    private void selectFieldVideo(boolean record) {
        runOnUiThread(() -> {
            try {
                if(record) {
                    File dir = new File(getCacheDir(), "captures");
                    if(!dir.isDirectory() && !dir.mkdirs())throw new IOException("Camera cache unavailable");
                    File tmp = new File(dir, "capture_" + UUID.randomUUID().toString() + ".mp4");
                    capturedVideoFile = tmp;
                    capturedVideoUri = FileProvider.getUriForFile(this, getPackageName() + ".manuals", tmp);
                    Intent camera = new Intent(MediaStore.ACTION_VIDEO_CAPTURE);
                    camera.putExtra(MediaStore.EXTRA_OUTPUT, capturedVideoUri);
                    camera.putExtra(MediaStore.EXTRA_DURATION_LIMIT, 60);
                    camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    camera.setClipData(ClipData.newRawUri("BoreLab field video", capturedVideoUri));
                    startActivityForResult(camera, REQ_VIDEO);
                } else {
                    Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    pick.addCategory(Intent.CATEGORY_OPENABLE);
                    pick.setType("video/*");
                    startActivityForResult(pick, REQ_VIDEO);
                }
            } catch(Exception e) {
                capturedVideoUri = null;capturedVideoFile = null;
                toast("Unable to open video capture/picker: " + e.getMessage());
                reportFieldVideo("{\"error\":\"Video picker unavailable\"}");
            }
        });
    }

    private void reportFieldVideo(String resultJson) {
        runOnUiThread(() -> {
            if(webView != null)webView.evaluateJavascript(
                "window.BoreLabMediaV25 && window.BoreLabMediaV25.onVideoImported(" +
                resultJson + ");", null);
        });
    }

    private void copyFieldVideo(Uri source) {
        final File captureToClean=capturedVideoFile;
        new Thread(() -> {
            File target = null;
            try {
                String type = getContentResolver().getType(source);
                if(type == null)type = "video/mp4";
                if(!type.startsWith("video/"))throw new IOException("Selected file is not a video");
                String extension = type.contains("webm") ? ".webm" : type.contains("quicktime") ? ".mov" :
                    type.contains("3gpp") ? ".3gp" : ".mp4";
                String id=UUID.randomUUID().toString();
                File folder = new File(getFilesDir(), "field_videos");
                if(!folder.isDirectory()&&!folder.mkdirs())throw new IOException("Video storage unavailable");
                target = new File(folder, id+extension);
                long total=0L;
                try(InputStream in=getContentResolver().openInputStream(source);
                    OutputStream out=new FileOutputStream(target)){
                    if(in==null)throw new IOException("Selected video could not be read");
                    byte[] buffer=new byte[64*1024];int count;
                    while((count=in.read(buffer))!=-1){
                        total+=count;
                        if(total>MAX_VIDEO_BYTES)throw new IOException("Video exceeds 200 MB. Select a shorter clip.");
                        out.write(buffer,0,count);
                    }
                }
                if(total<=0L)throw new IOException("Selected video was empty");
                Uri playable=FileProvider.getUriForFile(this,getPackageName()+".manuals",target);
                JSONObject data=new JSONObject();
                data.put("id",id);data.put("uri",playable.toString());data.put("mime",type);
                data.put("bytes",total);data.put("addedAt",new java.util.Date().toInstant().toString());
                reportFieldVideo(data.toString());
                target=null;
            }catch(Exception e){
                try{JSONObject problem=new JSONObject();problem.put("error",e.getMessage()==null?"Unable to save video":e.getMessage());reportFieldVideo(problem.toString());}
                catch(Exception ignored){reportFieldVideo("{\"error\":\"Unable to save video\"}");}
            }finally{
                if(target!=null && target.exists())target.delete();
                if(captureToClean!=null && captureToClean.exists())captureToClean.delete();
            }
        },"BoreLab-video-copy").start();
    }
    private boolean deleteFieldVideoFile(String id){
        if(id==null||!id.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"))return false;
        File folder=new File(getFilesDir(),"field_videos");
        for(String ext:new String[]{".mp4",".webm",".mov",".3gp"}){
            File file=new File(folder,id+ext);
            if(file.isFile())return file.delete();
        }
        return false;
    }

    final class FileExportBridge {
        @JavascriptInterface public void importCloseoutPlan(String jobId) { closeoutFiles.importPlan(jobId); }
        @JavascriptInterface public String listCloseoutPlans(String jobId) { return closeoutFiles.listPlans(jobId); }
        @JavascriptInterface public void openCloseoutPlan(String id) { closeoutFiles.openPlan(id); }
        @JavascriptInterface public void deleteCloseoutPlan(String id) { closeoutFiles.deletePlan(id); }
        @JavascriptInterface public void connectCloseoutFolder() { closeoutFiles.connectFolder(); }
        @JavascriptInterface public String closeoutFolderName() { return closeoutFiles.folderName(); }
        @JavascriptInterface public void exportCloseoutFolder(String name, String mime, String base64) { closeoutFiles.exportFolder(name,mime,base64); }
        @JavascriptInterface public void exportCloseoutPdfFolder(String name, String reportJson) { closeoutFiles.exportPdfFolder(name,reportJson); }
        @JavascriptInterface public void importFieldVideo(){selectFieldVideo(false);}
        @JavascriptInterface public void recordFieldVideo(){selectFieldVideo(true);}
        @JavascriptInterface public boolean deleteFieldVideo(String id){return deleteFieldVideoFile(id);}
        @JavascriptInterface public void shareFieldVideo(String contentUri) {
            runOnUiThread(()->{
                try{
                    Uri uri=Uri.parse(contentUri);
                    if(!"content".equals(uri.getScheme()) ||
                       !(getPackageName()+".manuals").equals(uri.getAuthority()))throw new SecurityException("Only saved BoreLab videos may be shared");
                    Intent send=new Intent(Intent.ACTION_SEND);
                    send.setType(getContentResolver().getType(uri));
                    send.putExtra(Intent.EXTRA_STREAM,uri);
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    send.setClipData(ClipData.newRawUri("BoreLab field video",uri));
                    startActivity(Intent.createChooser(send,"Export BoreLab video"));
                }catch(Exception err){toast("Unable to share video: "+err.getMessage());}
            });
        }

        /** Mi OS Daily sends its own immutable daily-log IDs, never a direct pipe transaction. */
        @JavascriptInterface public String getLauncherLogs() {
            try (Cursor rows=getContentResolver().query(
                Uri.parse("content://com.luis.mios.daily.borelab/logs"),
                new String[]{"json"},null,null,null)) {
                if(rows!=null&&rows.moveToFirst()){
                    String payload=rows.getString(rows.getColumnIndexOrThrow("json"));
                    return payload!=null&&payload.length()<=2000000?payload:"{\"entries\":[]}";
                }
            } catch (Exception ignored) { /* Companion not installed, not paired, or not authorized. */ }
            return "{\"entries\":[]}";
        }
        @JavascriptInterface public boolean isMiOsEnabled() {
            return getSharedPreferences(MiOsCompanionProvider.PREFS,Context.MODE_PRIVATE).getBoolean("enabled",false);
        }
        @JavascriptInterface public void setMiOsEnabled(boolean enabled) {
            getSharedPreferences(MiOsCompanionProvider.PREFS,Context.MODE_PRIVATE)
                .edit().putBoolean("enabled",enabled).apply();
        }
        @JavascriptInterface public void publishMiOsSnapshot(String raw) {
            if(!isMiOsEnabled()||raw==null||raw.length()>250000)return;
            try {
                JSONObject obj=new JSONObject(raw);
                if(obj.optInt("version")!=1||!obj.has("points"))return;
                getSharedPreferences(MiOsCompanionProvider.PREFS,Context.MODE_PRIVATE)
                    .edit().putString("snapshot",obj.toString()).apply();
            } catch (Exception ignored) {}
        }

        /** The user's speech-recognition app handles one requested voice command. */
        @JavascriptInterface public void startVoiceCommand() {
            runOnUiThread(() -> {
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault());
                intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Ask BoreLab about your field work");
                try { startActivityForResult(intent, REQ_VOICE); }
                catch (ActivityNotFoundException e) { toast("No speech recognition app installed. Type your question instead."); }
                catch (Exception e) { toast("Voice unavailable. Type your question instead."); }
            });
        }


        @JavascriptInterface public void searchManual(String slot, String query, String requestId) {
            try {
                safeManualSlot(slot);
                if (requestId == null || !requestId.matches("[0-9]{1,12}"))
                    throw new IllegalArgumentException("Invalid request");
                searchSavedManual(slot, query, requestId);
            } catch (Exception e) {
                sendManualStatus("Search unavailable: " + e.getMessage());
            }
        }

        @JavascriptInterface public void openManualPage(String slot, int page) {
            try {
                File file = manualFile(slot);
                if (!isPdf(file) || page < 1 || page > 9000)
                    throw new IllegalArgumentException("Page or PDF unavailable.");
                runOnUiThread(() -> {
                    Intent intent = new Intent(BoreLabActivity.this, ManualReaderActivity.class);
                    intent.putExtra("slot", slot);
                    intent.putExtra("page", page);
                    startActivity(intent);
                });
            } catch (Exception e) {
                sendManualStatus("Cannot open page: " + e.getMessage());
            }
        }


        /** Open allowlisted manufacturer/manual sources in a real Android browser. */
        @JavascriptInterface public void openManualLink(String url) {
            try {
                Uri uri = Uri.parse(url);
                String host = uri.getHost();
                String[] allowed = {
                    "www.scribd.com", "manuals.plus", "www.ditchwitchmidwest.com",
                    "manualmachine.com", "www.manualslib.com", "www.manualsdir.com",
                    "partesyherramientas.us", "eliteundergroundtools.com", "sc-journal.com",
                    "diyrepairmanuals.com", "www.vermeer.com", "www.ditchwitch.com",
                    "ditchwitch.box.com", "data.ntsb.gov"
                };
                if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null ||
                    !java.util.Arrays.asList(allowed).contains(host.toLowerCase(java.util.Locale.ROOT)))
                    throw new IllegalArgumentException("Unsupported manual link.");
                runOnUiThread(() -> {
                    Intent external = new Intent(Intent.ACTION_VIEW, uri);
                    external.addCategory(Intent.CATEGORY_BROWSABLE);
                    try { startActivity(external); }
                    catch (Exception e) { toast("Cannot open manual link in a browser."); }
                });
            } catch (Exception e) {
                toast("Invalid manual link: " + e.getMessage());
            }
        }


        /** User-entered manual URL: always HTTPS and always opened outside the app. */
        @JavascriptInterface public void openUserManualLink(String url) {
            try {
                Uri uri = Uri.parse(url);
                String host = uri.getHost();
                if (url == null || url.length() > 1800 ||
                    !"https".equalsIgnoreCase(uri.getScheme()) ||
                    host == null || !host.contains(".") ||
                    uri.getUserInfo() != null ||
                    "appassets.androidplatform.net".equalsIgnoreCase(host) ||
                    host.equalsIgnoreCase("localhost") || host.toLowerCase(java.util.Locale.ROOT).endsWith(".localhost") ||
                    host.matches("\\d+\\.\\d+\\.\\d+\\.\\d+") || host.startsWith("["))
                    throw new IllegalArgumentException("Use a public https:// manual link.");
                runOnUiThread(() -> {
                    Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                    intent.addCategory(Intent.CATEGORY_BROWSABLE);
                    try { startActivity(intent); }
                    catch (Exception e) { toast("Cannot open this manual in a browser."); }
                });
            } catch (Exception e) { toast("Invalid manual link."); }
        }

        @JavascriptInterface public void listManuals() {
            sendManualStatus(null);
        }

        @JavascriptInterface public void importManual(String slot) {
            try { safeManualSlot(slot); }
            catch (Exception e) { sendManualStatus("Unknown manual slot."); return; }
            runOnUiThread(() -> {
                if (pendingManualSlot != null) { toast("Complete the current PDF import first."); return; }
                pendingManualSlot = slot;
                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                picker.setType("application/pdf");
                try { startActivityForResult(picker, REQ_MANUAL); }
                catch (Exception e) { pendingManualSlot = null; sendManualStatus("Could not choose a PDF."); }
            });
        }

        @JavascriptInterface public void openManual(String slot) {
            runOnUiThread(() -> openSavedManual(slot));
        }

        @JavascriptInterface public void removeManual(String slot) {
            new Thread(() -> {
                try {
                    File file = manualFile(slot);
                    if (file.exists() && !file.delete()) throw new IllegalStateException("PDF could not be removed");
                    sendManualStatus("Offline manual removed from BoreLab.");
                } catch (Exception e) { sendManualStatus("Remove failed: " + e.getMessage()); }
            }, "BoreLab-Manual-Remove").start();
        }
        /** OCR text scanning runs on-device using the model bundled inside the APK. */
        @JavascriptInterface public void scanProductLabel(String dataUrl) {
            recognizeProductLabel(dataUrl);
        }

        @JavascriptInterface public void scanAddressPhoto(String dataUrl) {
            recognizeAddressPhoto(dataUrl);
        }

        @JavascriptInterface public void scanShotSheet(String dataUrl) {
            recognizeShotSheet(dataUrl);
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
        // WebView screens use in-app navigation rather than real URL history.
        // Let JavaScript close an open modal or return to the previous field screen first.
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript(
            "(function(){ return !!(window.borelabHandleBack && window.borelabHandleBack()); })();",
            handled -> {
                if ("true".equals(handled)) return;
                // Only leave the app once its own navigation is exhausted.
                if (webView != null && webView.canGoBack()) webView.goBack();
                else BoreLabActivity.super.onBackPressed();
            });
    }

    @Override protected void onDestroy() {
        manualSearchExecutor.shutdownNow();
        if (webView != null) { webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
