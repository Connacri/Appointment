package com.planning.oran;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VideoBubble")
public class VideoBubblePlugin extends Plugin {
    private static final String PREFS = "appointment_video_bubble";
    private static final String KEY_URL = "pending_share_url";
    private static final String KEY_OPEN = "pending_open_quick_add";

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("overlayPermission", Settings.canDrawOverlays(getContext()));
        result.put("bubbleEnabled", getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean("bubble_enabled", false));
        call.resolve(result);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        if (Settings.canDrawOverlays(getContext())) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + getContext().getPackageName()));
        getActivity().startActivity(intent);
        JSObject result = new JSObject();
        result.put("granted", false);
        result.put("settingsOpened", true);
        call.resolve(result);
    }

    @PluginMethod
    public void startBubble(PluginCall call) {
        if (!Settings.canDrawOverlays(getContext())) {
            call.reject("La permission Android « Afficher par-dessus les autres applications » est requise.", "OVERLAY_PERMISSION_REQUIRED");
            return;
        }
        Intent service = new Intent(getContext(), VideoBubbleService.class);
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean("bubble_enabled", true).apply();
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                getContext().startForegroundService(service);
            } else {
                getContext().startService(service);
            }
            call.resolve();
        } catch (Exception error) {
            getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putBoolean("bubble_enabled", false).apply();
            call.reject("Impossible de démarrer la bulle Android : " + error.getMessage());
        }
    }

    @PluginMethod
    public void stopBubble(PluginCall call) {
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean("bubble_enabled", false).apply();
        getContext().stopService(new Intent(getContext(), VideoBubbleService.class));
        call.resolve();
    }

    @PluginMethod
    public void getPendingShare(PluginCall call) {
        android.content.SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String url = prefs.getString(KEY_URL, null);
        boolean openQuickAdd = prefs.getBoolean(KEY_OPEN, false);
        if (url == null || url.trim().isEmpty()) {
            Intent launchIntent = getActivity().getIntent();
            if (launchIntent != null) {
                url = VideoBubbleIntents.extractSharedUrl(launchIntent);
                openQuickAdd = openQuickAdd || launchIntent.getBooleanExtra(VideoBubbleIntents.EXTRA_OPEN_QUICK_ADD, false);
            }
        }
        prefs.edit().remove(KEY_URL).remove(KEY_OPEN).apply();
        JSObject result = new JSObject();
        result.put("url", url);
        result.put("openQuickAdd", openQuickAdd);
        call.resolve(result);
    }
}
