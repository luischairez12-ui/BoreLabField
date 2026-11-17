package com.borelab.field;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import android.text.InputType;
import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Offline, built-in PDF page reader. Page numbers are PDF page indices (including cover).
 * Search is handled by the BoreLab manual search bridge; this viewer opens exact result pages.
 */
public class ManualReaderActivity extends Activity {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private PdfRenderer pdf;
    private ParcelFileDescriptor descriptor;
    private ImageView image;
    private TextView counter;
    private Button previous, next;
    private ScrollView vertical;
    private HorizontalScrollView horizontal;
    private int pageIndex, pageCount;
    private int renderedWidth = 0, renderedHeight = 0;
    private float zoom = 1f;
    private Bitmap currentBitmap;
    private volatile boolean closing = false;

    private int dp(int points) {
        return Math.round(points * getResources().getDisplayMetrics().density);
    }

    private Button button(String text, View.OnClickListener onClick) {
        Button b = new Button(this);
        b.setAllCaps(false);
        b.setText(text);
        b.setTextSize(12f);
        b.setPadding(dp(5), 0, dp(5), 0);
        b.setOnClickListener(onClick);
        return b;
    }

    private void message(String text) {
        runOnUiThread(() -> Toast.makeText(this, text, Toast.LENGTH_LONG).show());
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(16, 35, 50));
        getWindow().setNavigationBarColor(Color.rgb(16, 35, 50));

        String slot = getIntent().getStringExtra("slot");
        if (slot == null || !slot.matches("[a-z0-9-]{2,70}")) {
            finish();
            return;
        }
        File manual = new File(new File(getFilesDir(), "manuals"), slot + ".pdf");
        if (!manual.isFile()) {
            message("PDF not found. Import it again.");
            finish();
            return;
        }

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(241, 245, 248));

        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(6), dp(5), dp(8), dp(5));
        header.setBackgroundColor(Color.rgb(16, 35, 50));
        Button back = button("‹ Library", v -> finish());
        back.setTextColor(Color.WHITE);
        header.addView(back);
        counter = new TextView(this);
        counter.setTextColor(Color.WHITE);
        counter.setTextSize(14);
        counter.setGravity(Gravity.CENTER);
        header.addView(counter, new LinearLayout.LayoutParams(0, dp(48), 1));
        root.addView(header);

        horizontal = new HorizontalScrollView(this);
        horizontal.setFillViewport(true);
        vertical = new ScrollView(this);
        vertical.setFillViewport(true);
        image = new ImageView(this);
        image.setBackgroundColor(Color.WHITE);
        image.setAdjustViewBounds(true);
        image.setScaleType(ImageView.ScaleType.FIT_XY);
        vertical.addView(image);
        horizontal.addView(vertical);
        root.addView(horizontal, new LinearLayout.LayoutParams(-1, 0, 1));

        LinearLayout controls = new LinearLayout(this);
        controls.setGravity(Gravity.CENTER_VERTICAL);
        controls.setPadding(dp(4), dp(3), dp(4), dp(3));
        previous = button("‹ Prev", v -> displayPage(pageIndex - 1));
        next = button("Next ›", v -> displayPage(pageIndex + 1));
        Button minus = button("−", v -> changeZoom(-0.25f));
        Button plus = button("+", v -> changeZoom(0.25f));
        EditText jump = new EditText(this);
        jump.setSingleLine(true);
        jump.setInputType(InputType.TYPE_CLASS_NUMBER);
        jump.setTextSize(13);
        jump.setHint("Page");
        jump.setGravity(Gravity.CENTER);
        Button go = button("Go", v -> {
            try {
                displayPage(Integer.parseInt(jump.getText().toString()) - 1);
                jump.setText("");
            } catch (NumberFormatException e) {
                message("Enter a page number.");
            }
        });
        controls.addView(previous);
        controls.addView(next);
        controls.addView(minus);
        controls.addView(plus);
        controls.addView(jump, new LinearLayout.LayoutParams(0, dp(44), 1));
        controls.addView(go);
        root.addView(controls);
        setContentView(root);
        counter.setText("Opening PDF...");

        int desiredPage = Math.max(1, getIntent().getIntExtra("page", 1));
        worker.execute(() -> {
            try {
                descriptor = ParcelFileDescriptor.open(manual, ParcelFileDescriptor.MODE_READ_ONLY);
                pdf = new PdfRenderer(descriptor);
                pageCount = pdf.getPageCount();
                if (pageCount <= 0) throw new IllegalStateException("PDF has no pages");
                runOnUiThread(() -> displayPage(Math.min(desiredPage, pageCount) - 1));
            } catch (Exception e) {
                message("Cannot display manual: " + e.getMessage());
                runOnUiThread(this::finish);
            }
        });
    }

    private void applyImageSize() {
        if (renderedWidth <= 0 || renderedHeight <= 0) return;
        int width = Math.round(renderedWidth * zoom);
        int height = Math.round(renderedHeight * zoom);
        image.setLayoutParams(new android.widget.FrameLayout.LayoutParams(width, height));
        image.requestLayout();
    }

    private void changeZoom(float delta) {
        zoom = Math.max(0.75f, Math.min(2.5f, zoom + delta));
        applyImageSize();
    }

    private void displayPage(int desiredIndex) {
        if (closing || pdf == null || desiredIndex < 0 || desiredIndex >= pageCount) return;
        pageIndex = desiredIndex;
        counter.setText("Page " + (pageIndex + 1) + " / " + pageCount);
        previous.setEnabled(pageIndex > 0);
        next.setEnabled(pageIndex < pageCount - 1);
        final int requested = desiredIndex;
        worker.execute(() -> {
            Bitmap rendered = null;
            try (PdfRenderer.Page p = pdf.openPage(requested)) {
                float scale = Math.min(2.25f, 1750f / Math.max(1f, p.getWidth()));
                scale = Math.min(scale, 3000f / Math.max(1f, p.getHeight()));
                int width = Math.max(1, Math.round(p.getWidth() * scale));
                int height = Math.max(1, Math.round(p.getHeight() * scale));
                rendered = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
                rendered.eraseColor(Color.WHITE);
                p.render(rendered, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                final Bitmap ready = rendered;
                runOnUiThread(() -> {
                    if (closing || pageIndex != requested) {
                        ready.recycle();
                        return;
                    }
                    Bitmap old = currentBitmap;
                    currentBitmap = ready;
                    image.setImageBitmap(ready);
                    renderedWidth = ready.getWidth();
                    renderedHeight = ready.getHeight();
                    zoom = 1f;
                    applyImageSize();
                    horizontal.scrollTo(0, 0);
                    vertical.scrollTo(0, 0);
                    if (old != null && !old.isRecycled()) old.recycle();
                });
            } catch (Exception e) {
                if (rendered != null && !rendered.isRecycled()) rendered.recycle();
                message("Unable to render page " + (requested + 1));
            }
        });
    }

    @Override protected void onDestroy() {
        closing = true;
        worker.execute(() -> {
            try { if (pdf != null) pdf.close(); } catch (Exception ignored) {}
            try { if (descriptor != null) descriptor.close(); } catch (Exception ignored) {}
        });
        worker.shutdown();
        if (currentBitmap != null && !currentBitmap.isRecycled()) currentBitmap.recycle();
        super.onDestroy();
    }
}
