package com.borelab.field;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PointF;
import android.graphics.RectF;
import android.graphics.pdf.PdfDocument;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/** On-device PDF plan reader, touch redline editor and flattened redline PDF export. */
public final class PlanRedlineActivity extends Activity {
    private static final int REQ_EXPORT=310;
    private String planId;
    private SharedPreferences prefs;
    private ParcelFileDescriptor fileDescriptor;
    private PdfRenderer renderer;
    private Bitmap pageBitmap;
    private PlanView image;
    private TextView label;
    private Button modeButton;
    private int index=0;
    private boolean drawMode=true;
    private byte[] pendingExport;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        planId=getIntent().getStringExtra("planId");
        if(planId==null||!planId.matches("[0-9a-fA-F-]{36}")){finish();return;}
        File file=new File(new File(getFilesDir(),"closeout_plans"),planId+".pdf");
        prefs=getSharedPreferences(CloseoutFiles.PREF,MODE_PRIVATE);
        try{
            fileDescriptor=ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);
            renderer=new PdfRenderer(fileDescriptor);
        }catch(Exception ex){toast("Could not read PDF plan: "+ex.getMessage());finish();return;}
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(239,243,247));
        LinearLayout bar=new LinearLayout(this);bar.setOrientation(LinearLayout.HORIZONTAL);bar.setPadding(9,10,9,10);bar.setBackgroundColor(Color.WHITE);
        Button back=button("‹ Back",()->finish());bar.addView(back);
        label=new TextView(this);label.setTextColor(Color.rgb(30,42,54));label.setTextSize(14);label.setGravity(android.view.Gravity.CENTER);
        bar.addView(label,new LinearLayout.LayoutParams(0,-1,1));
        Button prev=button("‹",()->showPage(index-1));bar.addView(prev);
        Button next=button("›",()->showPage(index+1));bar.addView(next);
        root.addView(bar);
        image=new PlanView();root.addView(image,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout actions=new LinearLayout(this);actions.setBackgroundColor(Color.WHITE);actions.setPadding(6,10,6,10);
        actions.setOrientation(LinearLayout.VERTICAL);
        LinearLayout row1=new LinearLayout(this);row1.setOrientation(LinearLayout.HORIZONTAL);
        modeButton=button("Redline: ON",()->{drawMode=!drawMode;modeButton.setText(drawMode?"Redline: ON":"Redline: OFF");toast(drawMode?"Drag a finger to draw redlines.":"Drawing disabled.");});
        row1.addView(modeButton,new LinearLayout.LayoutParams(0,-2,1));
        row1.addView(button("Undo",()->undo()),new LinearLayout.LayoutParams(0,-2,1));
        row1.addView(button("Clear",()->new AlertDialog.Builder(this).setTitle("Clear this page?")
                .setMessage("Remove all redline strokes on this page?").setNegativeButton("Cancel",null)
                .setPositiveButton("Clear",(d,which)->{writePaths(index,new JSONArray());loadPaths();}).show()),new LinearLayout.LayoutParams(0,-2,1));
        actions.addView(row1);
        Button export=button("Export Flattened Redline PDF",()->exportMarked());
        actions.addView(export,new LinearLayout.LayoutParams(-1,-2));
        TextView note=new TextView(this);note.setText("Offline marked plan • Rasterized export • Not a certified engineering redline");note.setTextSize(11);note.setTextColor(Color.DKGRAY);note.setPadding(10,5,10,5);
        actions.addView(note);
        root.addView(actions);
        setContentView(root);
        showPage(0);
    }
    private Button button(String text,Runnable click){
        Button button=new Button(this);button.setText(text);button.setAllCaps(false);button.setTextSize(12);
        button.setOnClickListener(v->click.run());return button;
    }
    private void toast(String text){runOnUiThread(()->Toast.makeText(this,text,Toast.LENGTH_LONG).show());}
    private JSONObject redlines(){
        try{return new JSONObject(prefs.getString("redlines_"+planId,"{}"));}
        catch(Exception ignored){return new JSONObject();}
    }
    private JSONArray readPaths(int page){
        JSONArray arr=redlines().optJSONArray(String.valueOf(page));return arr==null?new JSONArray():arr;
    }
    private void writePaths(int page,JSONArray strokes){
        try{JSONObject object=redlines();object.put(String.valueOf(page),strokes);prefs.edit().putString("redlines_"+planId,object.toString()).apply();}
        catch(Exception ex){toast("Could not save redlines.");}
    }
    static int redlineCount(SharedPreferences prefs,String id){
        try{
            JSONObject o=new JSONObject(prefs.getString("redlines_"+id,"{}"));int count=0;
            java.util.Iterator<String> keys=o.keys();while(keys.hasNext()){JSONArray paths=o.optJSONArray(keys.next());if(paths!=null)count+=paths.length();}
            return count;
        }catch(Exception ignored){return 0;}
    }
    private void showPage(int p) {
        if(renderer==null||p<0||p>=renderer.getPageCount())return;
        try(PdfRenderer.Page page=renderer.openPage(p)){
            if(pageBitmap!=null){pageBitmap.recycle();pageBitmap=null;}
            float scale=Math.min(2f,1800f/Math.max(page.getWidth(),page.getHeight()));
            int w=Math.max(1,(int)(page.getWidth()*scale)),h=Math.max(1,(int)(page.getHeight()*scale));
            pageBitmap=Bitmap.createBitmap(w,h,Bitmap.Config.ARGB_8888);
            pageBitmap.eraseColor(Color.WHITE);
            page.render(pageBitmap,null,null,PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
            index=p;label.setText("Plan page "+(index+1)+" / "+renderer.getPageCount());
            loadPaths();
        }catch(Exception ex){toast("Could not render page: "+ex.getMessage());}
    }
    private void loadPaths(){if(image!=null){image.setContent(pageBitmap,readPaths(index));image.invalidate();}}
    private void undo(){JSONArray arr=readPaths(index);if(arr.length()==0)return;JSONArray shorter=new JSONArray();for(int i=0;i<arr.length()-1;i++)shorter.put(arr.opt(i));writePaths(index,shorter);loadPaths();}
    private void exportMarked(){
        if(renderer==null||pendingExport!=null)return;
        try{
            PdfDocument document=new PdfDocument();
            int count=renderer.getPageCount();
            for(int i=0;i<count;i++){
                try(PdfRenderer.Page page=renderer.openPage(i)){
                    int w=page.getWidth(),h=page.getHeight();
                    float scale=Math.min(2f,2100f/Math.max(w,h));
                    Bitmap bmp=Bitmap.createBitmap(Math.max(1,(int)(w*scale)),Math.max(1,(int)(h*scale)),Bitmap.Config.ARGB_8888);
                    bmp.eraseColor(Color.WHITE);
                    page.render(bmp,null,null,PdfRenderer.Page.RENDER_MODE_FOR_PRINT);
                    PdfDocument.Page dst=document.startPage(new PdfDocument.PageInfo.Builder(w,h,i+1).create());
                    Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);paint.setFilterBitmap(true);
                    dst.getCanvas().drawBitmap(bmp,null,new RectF(0,0,w,h),paint);
                    drawStrokes(dst.getCanvas(),readPaths(i),new RectF(0,0,w,h));
                    document.finishPage(dst);bmp.recycle();
                }
            }
            ByteArrayOutputStream out=new ByteArrayOutputStream();document.writeTo(out);document.close();
            pendingExport=out.toByteArray();
            Intent picker=new Intent(Intent.ACTION_CREATE_DOCUMENT);
            picker.addCategory(Intent.CATEGORY_OPENABLE);picker.setType("application/pdf");
            picker.putExtra(Intent.EXTRA_TITLE,"BoreLab_Redlined_Plan_"+planId.substring(0,8)+".pdf");
            startActivityForResult(picker,REQ_EXPORT);
        }catch(Exception ex){pendingExport=null;toast("Redline export failed: "+ex.getMessage());}
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request!=REQ_EXPORT)return;
        if(result==RESULT_OK&&data!=null&&data.getData()!=null&&pendingExport!=null){
            try(OutputStream out=getContentResolver().openOutputStream(data.getData())){if(out==null)throw new IllegalStateException("No write permission");out.write(pendingExport);toast("Flattened redline PDF saved.");}
            catch(Exception ex){toast("Could not save marked PDF: "+ex.getMessage());}
        }
        pendingExport=null;
    }
    static void drawStrokes(Canvas canvas,JSONArray paths,RectF rect){
        Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(Color.rgb(221,42,37));paint.setStrokeWidth(Math.max(2f,Math.min(rect.width(),rect.height())/240f));
        paint.setStyle(Paint.Style.STROKE);paint.setStrokeCap(Paint.Cap.ROUND);paint.setStrokeJoin(Paint.Join.ROUND);
        for(int i=0;i<paths.length();i++){
            JSONArray points=paths.optJSONArray(i);if(points==null)continue;
            android.graphics.Path path=new android.graphics.Path();
            for(int j=0;j<points.length();j++){
                JSONArray pair=points.optJSONArray(j);if(pair==null)continue;
                float x=rect.left+(float)pair.optDouble(0)*rect.width(),y=rect.top+(float)pair.optDouble(1)*rect.height();
                if(j==0)path.moveTo(x,y);else path.lineTo(x,y);
            }
            canvas.drawPath(path,paint);
        }
    }
    private final class PlanView extends View {
        Bitmap bmp;JSONArray strokes=new JSONArray();JSONArray current;
        RectF rect=new RectF();Paint bmpPaint=new Paint(Paint.FILTER_BITMAP_FLAG);
        PlanView(){super(PlanRedlineActivity.this);setBackgroundColor(Color.rgb(227,233,238));}
        void setContent(Bitmap bitmap,JSONArray marks){bmp=bitmap;strokes=marks;current=null;invalidate();}
        private void calculate(){
            if(bmp==null||getWidth()==0||getHeight()==0)return;
            float scale=Math.min(getWidth()/(float)bmp.getWidth(),getHeight()/(float)bmp.getHeight());
            float w=bmp.getWidth()*scale,h=bmp.getHeight()*scale;
            rect.set((getWidth()-w)/2,(getHeight()-h)/2,(getWidth()+w)/2,(getHeight()+h)/2);
        }
        @Override protected void onDraw(Canvas canvas){
            super.onDraw(canvas);if(bmp==null)return;calculate();
            canvas.drawBitmap(bmp,null,rect,bmpPaint);
            drawStrokes(canvas,strokes,rect);
        }
        @Override public boolean onTouchEvent(MotionEvent event){
            if(!drawMode||bmp==null)return false;
            int action=event.getActionMasked();calculate();
            if(action==MotionEvent.ACTION_DOWN){
                if(!rect.contains(event.getX(),event.getY()))return false;
                current=new JSONArray();strokes.put(current);getParent().requestDisallowInterceptTouchEvent(true);
            }
            if(current==null)return false;
            if(action==MotionEvent.ACTION_DOWN||action==MotionEvent.ACTION_MOVE||action==MotionEvent.ACTION_UP){
                double x=Math.max(0,Math.min(1,(event.getX()-rect.left)/rect.width()));
                double y=Math.max(0,Math.min(1,(event.getY()-rect.top)/rect.height()));
                try { JSONArray pt=new JSONArray();pt.put(x);pt.put(y);current.put(pt); } catch (org.json.JSONException ignored) { return false; }
                invalidate();
                if(action==MotionEvent.ACTION_UP){writePaths(index,strokes);current=null;}
                return true;
            }
            if(action==MotionEvent.ACTION_CANCEL){writePaths(index,strokes);current=null;return true;}
            return true;
        }
    }
    @Override protected void onDestroy(){
        if(pageBitmap!=null){pageBitmap.recycle();pageBitmap=null;}
        if(renderer!=null){renderer.close();renderer=null;}
        if(fileDescriptor!=null){try{fileDescriptor.close();}catch(Exception ignored){}}
        super.onDestroy();
    }
}
