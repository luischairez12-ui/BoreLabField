package com.borelab.field;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Native, text-searchable multi-page PDF output for BoreLab field reports. */
public final class FieldPdfExporter {
    private static final int W = 612, H = 792;
    private static final float M = 42, RIGHT = W - M, BOTTOM = H - 52;
    private static final int INK = Color.rgb(24, 44, 56);
    private static final int MUTED = Color.rgb(86, 106, 118);
    private static final int ORANGE = Color.rgb(224, 115, 24);
    private static final int PALE = Color.rgb(245, 248, 250);
    private final PdfDocument document = new PdfDocument();
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private PdfDocument.Page page;
    private Canvas canvas;
    private int pageNumber;
    private float y;

    private FieldPdfExporter() {}

    public static byte[] generate(String serializedReport) throws Exception {
        FieldPdfExporter writer = new FieldPdfExporter();
        try {
            writer.render(new JSONObject(serializedReport));
            writer.endPage();
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            writer.document.writeTo(buffer);
            return buffer.toByteArray();
        } finally {
            writer.document.close();
        }
    }

    private void startPage() {
        pageNumber++;
        page = document.startPage(new PdfDocument.PageInfo.Builder(W, H, pageNumber).create());
        canvas = page.getCanvas();
        canvas.drawColor(Color.WHITE);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(INK);
        paint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        paint.setTextSize(13);
        canvas.drawText("BORELAB  FIELD", M, 36, paint);
        paint.setColor(ORANGE);
        canvas.drawRect(M, 44, RIGHT, 47, paint);
        y = 68;
    }

    private void endPage() {
        if (page == null) return;
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(0.5f);
        paint.setColor(Color.rgb(207, 218, 225));
        canvas.drawLine(M, H - 39, RIGHT, H - 39, paint);
        paint.setStyle(Paint.Style.FILL);
        paint.setTypeface(Typeface.DEFAULT);
        paint.setColor(MUTED);
        paint.setTextSize(8);
        canvas.drawText("BoreLab Field • Verify all records before submission", M, H - 26, paint);
        String right = "Page " + pageNumber;
        canvas.drawText(right, RIGHT - paint.measureText(right), H - 26, paint);
        document.finishPage(page);
        page = null;
        canvas = null;
    }

    private void ensure(float height) {
        if (page == null) startPage();
        if (y + height > BOTTOM) {
            endPage();
            startPage();
        }
    }

    private void write(String raw, int size, int color, boolean bold, float inset) {
        if (raw == null) raw = "";
        paint.setColor(color);
        paint.setTextSize(size);
        paint.setTypeface(Typeface.create(Typeface.DEFAULT, bold ? Typeface.BOLD : Typeface.NORMAL));
        float maxWidth = RIGHT - M - inset;
        float lineHeight = size + 5;
        String[] paragraphs = raw.replace("\r", "").split("\n", -1);
        for (String paragraph : paragraphs) {
            List<String> lines = wrap(paragraph, maxWidth);
            for (String line : lines) {
                ensure(lineHeight);
                canvas.drawText(line, M + inset, y, paint);
                y += lineHeight;
            }
        }
    }

    private List<String> wrap(String s, float maxWidth) {
        List<String> lines = new ArrayList<>();
        if (s.isEmpty()) { lines.add(""); return lines; }
        StringBuilder line = new StringBuilder();
        for (String word : s.trim().split("\\s+")) {
            String candidate = line.length() == 0 ? word : line + " " + word;
            if (paint.measureText(candidate) <= maxWidth) {
                line.setLength(0);
                line.append(candidate);
            } else {
                if (line.length() > 0) {
                    lines.add(line.toString());
                    line.setLength(0);
                }
                if (paint.measureText(word) <= maxWidth) {
                    line.append(word);
                } else {
                    StringBuilder part = new StringBuilder();
                    for (int i = 0; i < word.length(); i++) {
                        String trial = part.toString() + word.charAt(i);
                        if (paint.measureText(trial) > maxWidth && part.length() > 0) {
                            lines.add(part.toString());
                            part.setLength(0);
                        }
                        part.append(word.charAt(i));
                    }
                    line.append(part);
                }
            }
        }
        if (line.length() > 0) lines.add(line.toString());
        if (lines.isEmpty()) lines.add("");
        return lines;
    }

    private void section(String heading) {
        ensure(46);
        y += 13;
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(PALE);
        canvas.drawRoundRect(new RectF(M, y - 19, RIGHT, y + 9), 5, 5, paint);
        write(heading.toUpperCase(Locale.US), 11, ORANGE, true, 9);
        y += 4;
    }

    private void label(String name, String value) {
        write(name + ": " + (value == null || value.isEmpty() ? "Not recorded" : value), 10, INK, false, 0);
    }

    private void item(String name, String info, String notes) {
        ensure(40);
        y += 6;
        write(name, 11, INK, true, 0);
        write(info, 9, MUTED, false, 0);
        if (notes != null && !notes.trim().isEmpty()) {
            write("Notes: " + notes.trim(), 9, INK, false, 0);
        }
        paint.setColor(Color.rgb(224, 232, 237));
        canvas.drawLine(M, y + 4, RIGHT, y + 4, paint);
        y += 11;
    }

    private static JSONArray array(JSONObject obj, String name) {
        JSONArray x = obj.optJSONArray(name);
        return x == null ? new JSONArray() : x;
    }

    private static String str(JSONObject obj, String key) {
        String value = obj.optString(key, "");
        return value == null ? "" : value;
    }

    private void render(JSONObject report) {
        startPage();
        write(str(report, "title"), 21, INK, true, 0);
        y += 7;
        label("Job", str(report, "job"));
        label("Date / period", str(report, "period"));
        label("Home base", str(report, "homeBase"));
        label("Created", str(report, "generatedAt"));
        JSONObject summary = report.optJSONObject("summary");
        if (summary != null) {
            section("Summary");
            label("Shots reported", str(summary, "shots"));
            label("Completed footage", str(summary, "completedFeet"));
            label("Planned pipe", str(summary, "plannedPipe"));
            label("Actual pipe logged", str(summary, "actualPipe"));
            label("Crew-hours", str(summary, "crewHours"));
            label("Photos", str(summary, "photos"));
            label("Mud batches", str(summary, "mudBatches"));
            label("Mud stock movements", str(summary, "mudStockMoves"));
        }
        String closeoutNote = str(report, "closeoutNote");
        JSONArray checks = array(report, "checks");
        if (!closeoutNote.isEmpty() || checks.length() > 0) {
            section("Daily closeout review");
            for (int i = 0; i < checks.length(); i++) {
                JSONObject check = checks.optJSONObject(i);
                if (check != null) {
                    label(check.optBoolean("checked", false) ? "[REVIEWED]" : "[NOT REVIEWED]", str(check, "label"));
                }
            }
            if (!closeoutNote.isEmpty()) label("Foreman notes", closeoutNote);
        }

        section("Bore log");
        JSONArray shots = array(report, "shots");
        if (shots.length() == 0) write("No bore records for this period.", 10, MUTED, false, 0);
        for (int i = 0; i < shots.length(); i++) {
            JSONObject shot = shots.optJSONObject(i);
            if (shot == null) continue;
            item(str(shot, "name") + " — " + str(shot, "status"),
                 "Bore " + str(shot, "feet") + " ft  |  Planned pipe " + str(shot, "plannedPipe") +
                 " ft  |  Actual pipe " + str(shot, "actualPipe") + " ft",
                 str(shot, "notes"));
            label("Conduit size", str(shot, "pipeDiameter"));
            label("Product conduits / planned footage", str(shot, "conduitDetails"));
            label("Equipment", str(shot, "equipment"));
            label("Rod count / entry / exit", str(shot, "rodCount") + " / " + str(shot, "entryDepth") + " / " + str(shot, "exitDepth"));
            label("Started / finished", str(shot, "startedAt") + " / " + str(shot, "completedAt"));
            label("Location", str(shot, "address"));
            y += 4;
        }
        section("Crew hours");
        JSONArray crew = array(report, "crew");
        if (crew.length() == 0) write("No time records for this period.", 10, MUTED, false, 0);
        for (int i = 0; i < crew.length(); i++) {
            JSONObject row = crew.optJSONObject(i);
            if (row == null) continue;
            item(str(row, "name"),
                 str(row, "start") + " → " + str(row, "end") +
                 "  |  Lunch " + str(row, "lunch") + " min  |  Hours " + str(row, "hours"),
                 str(row, "notes"));
        }

        section("Pipe movements");
        JSONArray moves = array(report, "pipe");
        if (moves.length() == 0) write("No pipe transactions for this period.", 10, MUTED, false, 0);
        for (int i = 0; i < moves.length(); i++) {
            JSONObject move = moves.optJSONObject(i);
            if (move == null) continue;
            item(str(move, "reel") + " — " + str(move, "type"),
                 str(move, "feet") + " ft   |   " + str(move, "shot") + "   |   " + str(move, "date"),
                 str(move, "note"));
        }
        section("Drilling fluid / MixLab");
        JSONArray mud = array(report, "mud");
        if (mud.length() == 0) write("No mixing batches recorded for this period.", 10, MUTED, false, 0);
        for (int i = 0; i < mud.length(); i++) {
            JSONObject batch = mud.optJSONObject(i);
            if (batch == null) continue;
            String detail = "Water added: " + str(batch, "waterAdded") + " gal  |  Tank: " +
                    str(batch, "before") + " to " + str(batch, "target") + " gal  |  " +
                    str(batch, "mode") + "  |  Soil: " + str(batch, "soil");
            item("Mix recorded " + str(batch, "date"), detail, str(batch, "notes"));
            JSONArray products = array(batch, "products");
            for (int p = 0; p < products.length(); p++) {
                JSONObject additive = products.optJSONObject(p);
                if (additive == null) continue;
                write(str(additive, "name") + ": " + str(additive, "amount") + " " + str(additive, "unit"), 9, INK, false, 12);
            }
            y += 5;
        }
        section("Mud product stock movements");
        JSONArray stockMoves = array(report, "mudStock");
        if (stockMoves.length() == 0) write("No tracked product stock movements for this period.", 10, MUTED, false, 0);
        for (int i = 0; i < stockMoves.length(); i++) {
            JSONObject item = stockMoves.optJSONObject(i);
            if (item == null) continue;
            item(str(item, "product") + " — " + str(item, "kind"),
                 str(item, "delta") + " " + str(item, "units") + "   |   Remaining " +
                 str(item, "after") + "   |   " + str(item, "date"),
                 str(item, "note"));
        }
        section("Jobsite photos");
        JSONArray photos = array(report, "photos");
        if (photos.length() == 0) write("No jobsite photos available for this period.", 10, MUTED, false, 0);
        for (int i = 0; i < photos.length(); i++) {
            JSONObject photo = photos.optJSONObject(i);
            if (photo == null) continue;
            photo(photo);
        }
        y += 10;
        write("Generated from locally saved BoreLab records. Verify all field records before billing, payroll or compliance submission.", 9, MUTED, false, 0);
    }

    private void photo(JSONObject image) {
        String data = str(image, "dataUrl");
        if (data.isEmpty() || !data.startsWith("data:image/") || data.indexOf(',') < 0) {
            item(str(image, "shot") + " (image unavailable)", str(image, "date"), str(image, "location"));
            return;
        }
        Bitmap bitmap = null;
        try {
            byte[] bytes = Base64.decode(data.substring(data.indexOf(',') + 1), Base64.DEFAULT);
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
            int sample = 1;
            while (options.outWidth / sample > 1300 || options.outHeight / sample > 1300) sample *= 2;
            options.inSampleSize = sample;
            options.inJustDecodeBounds = false;
            bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
            if (bitmap == null) throw new IllegalArgumentException("Unreadable image");
            float maxH = 255, maxW = RIGHT - M;
            float scale = Math.min(maxW / bitmap.getWidth(), maxH / bitmap.getHeight());
            float imageW = bitmap.getWidth() * scale, imageH = bitmap.getHeight() * scale;
            ensure(imageH + 75);
            y += 8;
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(Color.WHITE);
            canvas.drawBitmap(bitmap, null, new RectF(M, y, M + imageW, y + imageH), paint);
            y += imageH + 17;
            write(str(image, "shot") + " | " + str(image, "date"), 10, INK, true, 0);
            write(str(image, "location"), 9, MUTED, false, 0);
            y += 13;
        } catch (Exception ignored) {
            item(str(image, "shot") + " (image could not be rendered)", str(image, "date"), str(image, "location"));
        } finally {
            if (bitmap != null) bitmap.recycle();
        }
    }
}
