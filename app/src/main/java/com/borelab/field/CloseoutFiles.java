package com.borelab.field;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.WebView;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.UUID;

/** Optional SAF folder output and offline imported PDF plans. No Drive credentials or server. */
final class CloseoutFiles {
    static final int REQ_PLAN = 4101, REQ_FOLDER = 4102;
    static final String PREF = "borelab-closeout-v026";
    private static final long MAX_PLAN = 80L * 1024 * 1024;
    private final BoreLabActivity host;
    private final WebView web;
    private final SharedPreferences prefs;
    private String pendingJob = "";

    CloseoutFiles(BoreLabActivity activity, WebView view) {
        host = activity; web = view;
        prefs = activity.getSharedPreferences(PREF, Activity.MODE_PRIVATE);
    }
    private void status(String message, boolean error) {
        try {
            JSONObject obj = new JSONObject();
            obj.put(error ? "error" : "message", message);
            web.post(() -> web.evaluateJavascript("if(window.BoreLabCloseoutStudio)window.BoreLabCloseoutStudio.onNativeResult(" + obj.toString() + ");", null));
        } catch (Exception ignored) {}
        host.runOnUiThread(() -> Toast.makeText(host, message, Toast.LENGTH_LONG).show());
    }
    private JSONArray savedPlans() {
        try { return new JSONArray(prefs.getString("plans", "[]")); }
        catch (Exception ignored) { return new JSONArray(); }
    }
    private String cleanJob(String id) {
        return id != null && id.matches("[A-Za-z0-9_-]{1,110}") ? id : "";
    }
    private boolean cleanId(String id) { return id != null && id.matches("[0-9a-fA-F-]{36}"); }
    String listPlans(String jobId) {
        JSONArray out = new JSONArray();
        String j = cleanJob(jobId);
        for (int i = 0; i < savedPlans().length(); i++) {
            JSONObject p = savedPlans().optJSONObject(i);
            if (p == null || !j.equals(p.optString("jobId"))) continue;
            if (!planFile(p.optString("id")).isFile()) continue;
            try {
                JSONObject copy = new JSONObject(p.toString());
                copy.put("redlineCount", PlanRedlineActivity.redlineCount(prefs, p.optString("id")));
                out.put(copy);
            } catch (Exception ignored) {}
        }
        return out.toString();
    }
    private File planFile(String id) {
        File dir = new File(host.getFilesDir(), "closeout_plans");
        if (!dir.exists()) dir.mkdirs();
        return new File(dir, id + ".pdf");
    }
    void importPlan(String jobId) {
        String j = cleanJob(jobId);
        if (j.isEmpty()) { status("Select a valid job first.", true); return; }
        host.runOnUiThread(() -> {
            pendingJob = j;
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.setType("application/pdf");
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            try { host.startActivityForResult(intent, REQ_PLAN); }
            catch (Exception ex) { pendingJob = "";status("Could not open PDF picker.", true); }
        });
    }
    void connectFolder() {
        host.runOnUiThread(() -> {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
                    Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
            try { host.startActivityForResult(intent, REQ_FOLDER); }
            catch (Exception ex) { status("This device cannot select a shared folder. Use Save to Drive for individual exports.", true); }
        });
    }
    String folderName() {
        String name=prefs.getString("folderName","");
        return prefs.getString("folderUri","").isEmpty()?"":name;
    }
    private String displayName(Uri uri, String fallback) {
        try (Cursor cur = host.getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)) {
            if (cur!=null && cur.moveToFirst() && !cur.isNull(0)) return cur.getString(0);
        } catch (Exception ignored) {}
        return fallback;
    }
    boolean onResult(int code, int result, Intent data) {
        if (code == REQ_PLAN) {
            final String j = pendingJob; pendingJob = "";
            if (result == Activity.RESULT_OK && data != null && data.getData()!=null && !j.isEmpty()) {
                Uri uri = data.getData();
                new Thread(() -> importFile(j, uri), "BoreLab-Plan-Import").start();
            }
            return true;
        }
        if (code == REQ_FOLDER) {
            if (result == Activity.RESULT_OK && data != null && data.getData()!=null) {
                Uri uri = data.getData();
                try {
                    host.getContentResolver().takePersistableUriPermission(uri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    String label = displayName(uri, DocumentsContract.getTreeDocumentId(uri));
                    prefs.edit().putString("folderUri",uri.toString()).putString("folderName",label).apply();
                    status("Connected folder: " + label, false);
                } catch (Exception ex) { status("Folder permission unavailable. Use normal Save picker instead: " + ex.getMessage(), true); }
            }
            return true;
        }
        return false;
    }
    private void importFile(String jobId, Uri uri) {
        String id = UUID.randomUUID().toString();
        File dest = planFile(id);
        String name = displayName(uri, "Imported plan.pdf");
        if (!name.toLowerCase(java.util.Locale.US).endsWith(".pdf")) name += ".pdf";
        name = name.replaceAll("[\\r\\n\\t]", " ").substring(0, Math.min(140, name.length()));
        long size = 0;
        try (InputStream input = host.getContentResolver().openInputStream(uri);
             OutputStream output = new FileOutputStream(dest)) {
            if (input==null) throw new IllegalStateException("Selected PDF is unreadable");
            byte[] bytes = new byte[16384]; int n;
            while ((n=input.read(bytes))!=-1) {
                size += n;
                if(size>MAX_PLAN) throw new IllegalArgumentException("PDF exceeds 80 MB limit");
                output.write(bytes,0,n);
            }
            if (size<5) throw new IllegalArgumentException("PDF was empty");
        } catch(Exception ex) { dest.delete();status("Plan import failed: "+ex.getMessage(),true);return; }
        try (FileInputStream input = new FileInputStream(dest)) {
            byte[] prefix = new byte[5];
            if(input.read(prefix)!=5 || !"%PDF-".equals(new String(prefix,java.nio.charset.StandardCharsets.US_ASCII)))
                throw new IllegalArgumentException("File is not a PDF");
            synchronized(this){
                JSONArray arr=savedPlans();JSONObject record=new JSONObject();
                record.put("id",id);record.put("jobId",jobId);record.put("name",name);
                record.put("bytes",size);record.put("importedAt",new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss",java.util.Locale.US).format(new java.util.Date()));
                arr.put(record);prefs.edit().putString("plans",arr.toString()).apply();
            }
            status("PDF saved offline. Open it in Studio to draw redlines.",false);
        }catch(Exception ex){dest.delete();status("Invalid PDF: "+ex.getMessage(),true);}
    }
    void openPlan(String id) {
        if (!cleanId(id)) { status("Invalid plan reference.",true);return; }
        boolean exists=false;
        for (int i=0;i<savedPlans().length();i++) {
            JSONObject p=savedPlans().optJSONObject(i);
            if(p!=null&&id.equals(p.optString("id")))exists=true;
        }
        if(!exists||!planFile(id).isFile()){status("Imported PDF not found.",true);return;}
        host.runOnUiThread(()->{
            Intent intent=new Intent(host,PlanRedlineActivity.class);
            intent.putExtra("planId",id);
            try{host.startActivity(intent);}catch(Exception ex){status("Could not open redline viewer: "+ex.getMessage(),true);}
        });
    }
    synchronized void deletePlan(String id) {
        if(!cleanId(id))return;
        JSONArray src=savedPlans(),keep=new JSONArray();boolean matched=false;
        for(int i=0;i<src.length();i++){
            JSONObject p=src.optJSONObject(i);
            if(p==null)continue;
            if(id.equals(p.optString("id")))matched=true;else keep.put(p);
        }
        if(matched){
            prefs.edit().putString("plans",keep.toString()).remove("redlines_"+id).apply();
            planFile(id).delete();
            status("Plan and saved redlines deleted.",false);
        }
    }
    private Uri folderDocument() {
        String raw=prefs.getString("folderUri","");
        if(raw.isEmpty())throw new IllegalStateException("Connect a compatible folder first");
        Uri tree=Uri.parse(raw);
        return DocumentsContract.buildDocumentUriUsingTree(tree,DocumentsContract.getTreeDocumentId(tree));
    }
    private void writeFolder(String name,String mime,byte[] bytes) throws Exception{
        if(bytes==null||bytes.length>85L*1024*1024)throw new IllegalArgumentException("File exceeds 85 MB limit");
        String safe=name==null?"BoreLab_Export":name.replaceAll("[/\\\\\\r\\n]","_").substring(0,Math.min(140,name.length()));
        Uri document=DocumentsContract.createDocument(host.getContentResolver(),folderDocument(),mime,safe);
        if(document==null)throw new IllegalStateException("Folder provider denied file creation");
        try(OutputStream output=host.getContentResolver().openOutputStream(document,"w")){
            if(output==null)throw new IllegalStateException("Cannot write selected folder");
            output.write(bytes);
        }
    }
    void exportFolder(String name,String mime,String base64){
        new Thread(()->{
            try{
                if(base64==null||base64.length()>115000000)throw new IllegalArgumentException("Export too large");
                writeFolder(name,mime==null?"application/octet-stream":mime,Base64.decode(base64,Base64.DEFAULT));
                status("Saved to connected folder.",false);
            }catch(Exception ex){status("Folder save failed. Try Save picker: "+ex.getMessage(),true);}
        },"BoreLab-Folder-Export").start();
    }
    void exportPdfFolder(String name,String reportJson){
        new Thread(()->{
            try{
                if(reportJson==null||reportJson.length()>40000000)throw new IllegalArgumentException("Report too large");
                writeFolder(name,"application/pdf",FieldPdfExporter.generate(reportJson));
                status("PDF saved to connected folder.",false);
            }catch(Exception ex){status("Folder PDF failed. Try Save picker: "+ex.getMessage(),true);}
        },"BoreLab-Folder-PDF").start();
    }
}
