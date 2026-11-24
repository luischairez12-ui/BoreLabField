package com.borelab.field;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.webkit.JavascriptInterface;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** Explicit SAF grant, immutable project publications, bounded read-only inbox. */
final class SyncFolderBridge {
    static final int REQUEST=29831, LIMIT=2000000, MAX=500;
    private final Activity a;
    SyncFolderBridge(Activity activity){a=activity;}
    private android.content.SharedPreferences prefs(){return a.getSharedPreferences("borelab-sync-folder-v1",0);}
    private Uri tree(){String t=prefs().getString("tree","");if(t.isEmpty())throw new IllegalStateException("Choose a sync folder first");return Uri.parse(t);}
    private Uri root(Uri t){return DocumentsContract.buildDocumentUriUsingTree(t,DocumentsContract.getTreeDocumentId(t));}
    private boolean name(String n){return n!=null&&n.matches("BLX_[A-Za-z0-9_-]{1,160}\\.json");}
    private String error(Exception e){return "ERROR: "+(e.getMessage()==null?e.getClass().getSimpleName():e.getMessage());}
    @JavascriptInterface public void choose(){a.runOnUiThread(()->{try{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION|Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);a.startActivityForResult(i,REQUEST);}catch(Exception ignored){}});}
    boolean result(int code,int result,Intent data){if(code!=REQUEST)return false;if(result==Activity.RESULT_OK&&data!=null&&data.getData()!=null)try{Uri t=data.getData();int flags=data.getFlags()&(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);a.getContentResolver().takePersistableUriPermission(t,flags);prefs().edit().putString("tree",t.toString()).apply();}catch(Exception ignored){}return true;}
    @JavascriptInterface public String folder(){try{return tree().toString();}catch(Exception e){return "";}}
    @JavascriptInterface public void disconnect(){try{a.getContentResolver().releasePersistableUriPermission(tree(),Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);}catch(Exception ignored){}prefs().edit().remove("tree").apply();}
    private JSONArray documents() throws Exception{Uri t=tree();Uri children=DocumentsContract.buildChildDocumentsUriUsingTree(t,DocumentsContract.getTreeDocumentId(t));JSONArray rows=new JSONArray();try(Cursor c=a.getContentResolver().query(children,new String[]{"document_id","_display_name","_size"},null,null,null)){if(c==null)throw new IOException("Folder unavailable");while(c.moveToNext()){String n=c.getString(1);if(!name(n))continue;if(rows.length()>=MAX)throw new IOException("Folder has over 500 sync files. Archive older files manually.");JSONObject j=new JSONObject();j.put("name",n);j.put("id",c.getString(0));j.put("size",c.isNull(2)?-1:c.getLong(2));rows.put(j);}}return rows;}
    @JavascriptInterface public String list(){try{JSONArray rows=documents(),out=new JSONArray();for(int i=0;i<rows.length();i++)out.put(rows.getJSONObject(i).getString("name"));return out.toString();}catch(Exception e){return error(e);}}
    @JavascriptInterface public String read(String n){try{if(!name(n))throw new IOException("Invalid filename");Uri t=tree();JSONArray rows=documents();for(int i=0;i<rows.length();i++){JSONObject j=rows.getJSONObject(i);if(!n.equals(j.getString("name")))continue;if(j.optLong("size")>LIMIT)throw new IOException("File too large");try(InputStream in=a.getContentResolver().openInputStream(DocumentsContract.buildDocumentUriUsingTree(t,j.getString("id")));ByteArrayOutputStream out=new ByteArrayOutputStream()){if(in==null)throw new IOException("Read unavailable");byte[] b=new byte[8192];int k,total=0;while((k=in.read(b))!=-1){total+=k;if(total>LIMIT)throw new IOException("File too large");out.write(b,0,k);}return out.toString("UTF-8");}}throw new IOException("File unavailable");}catch(Exception e){return error(e);}}
    @JavascriptInterface public String write(String n,String body){Uri doc=null;try{if(!name(n)||body==null)throw new IOException("Invalid publication");byte[] bytes=body.getBytes(StandardCharsets.UTF_8);if(bytes.length>LIMIT)throw new IOException("Publication exceeds 2 MB");JSONArray rows=documents();for(int i=0;i<rows.length();i++)if(n.equals(rows.getJSONObject(i).getString("name")))throw new IOException("Publication already exists");if(rows.length()>=MAX)throw new IOException("Folder full; archive old sync files");doc=DocumentsContract.createDocument(a.getContentResolver(),root(tree()),"application/json",n);if(doc==null)throw new IOException("Could not create file");try(OutputStream out=a.getContentResolver().openOutputStream(doc,"w")){if(out==null)throw new IOException("Write unavailable");out.write(bytes);out.flush();}return "OK";}catch(Exception e){if(doc!=null)try{DocumentsContract.deleteDocument(a.getContentResolver(),doc);}catch(Exception ignored){}return error(e);}}
}