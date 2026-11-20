package com.borelab.field;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.Binder;
import java.util.Arrays;

/** Opt-in, read-only snapshot for the authorized Mi OS Daily companion.
 *  This provider NEVER exposes BoreLab's complete WebView state, photos, PINs or backups.
 *  Approved caller package is checked using Binder UID, not an untrusted URI field.
 */
public final class MiOsCompanionProvider extends ContentProvider {
    static final String PREFS="borelab_mios_companion_v1";
    static final String TARGET="com.luis.mios.daily";
    @Override public boolean onCreate(){return true;}
    private void checkCaller(){
        Context c=getContext();
        if(c==null)throw new SecurityException("No Android context");
        String[] pkgs=c.getPackageManager().getPackagesForUid(Binder.getCallingUid());
        if(pkgs==null||(!Arrays.asList(pkgs).contains(TARGET)&&!Arrays.asList(pkgs).contains(c.getPackageName())))
            throw new SecurityException("Unauthorized BoreLab companion caller");
    }
    @Override public Cursor query(Uri uri,String[] projection,String selection,String[] selectionArgs,String sortOrder){
        checkCaller();
        if(!"/snapshot".equals(uri.getPath()))throw new IllegalArgumentException("Unknown BoreLab companion path");
        Context c=getContext();
        if(c==null||!c.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getBoolean("enabled",false))
            throw new SecurityException("BoreLab owner has not enabled companion access");
        String value=c.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getString("snapshot","");
        MatrixCursor out=new MatrixCursor(new String[]{"json"});
        if(value!=null&&!value.isEmpty())out.addRow(new Object[]{value});
        return out;
    }
    @Override public String getType(Uri uri){return "application/vnd.borelab.snapshot+json";}
    @Override public Uri insert(Uri uri,ContentValues values){throw new UnsupportedOperationException("Read only");}
    @Override public int delete(Uri uri,String selection,String[] selectionArgs){throw new UnsupportedOperationException("Read only");}
    @Override public int update(Uri uri,ContentValues values,String selection,String[] selectionArgs){throw new UnsupportedOperationException("Read only");}
}
