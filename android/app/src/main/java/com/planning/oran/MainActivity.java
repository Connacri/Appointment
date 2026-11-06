package com.planning.oran;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String PREFS = "appointment_video_bubble";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        captureIncomingIntent(getIntent());
        registerPlugin(VideoBubblePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureIncomingIntent(intent);
        if (hasWindowFocus()) dispatchPendingIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        dispatchPendingIntent(getIntent());
    }

    private void dispatchPendingIntent(Intent intent) {
        if (intent == null || intent.getBooleanExtra("appointment_video_intent_dispatched", false)) return;
        boolean isShare = Intent.ACTION_SEND.equals(intent.getAction());
        boolean isBubbleTap = intent.getBooleanExtra(VideoBubbleIntents.EXTRA_OPEN_QUICK_ADD, false);
        if (!isShare && !isBubbleTap) return;
        intent.putExtra("appointment_video_intent_dispatched", true);
        setIntent(intent);
        dispatchIncomingIntent(intent);
    }

    private void captureIncomingIntent(Intent intent) {
        if (intent == null) return;
        String url = VideoBubbleIntents.extractSharedUrl(intent);
        boolean openQuickAdd = intent.getBooleanExtra(VideoBubbleIntents.EXTRA_OPEN_QUICK_ADD, false);
        SharedPreferences.Editor editor = getSharedPreferences(PREFS, MODE_PRIVATE).edit();
        if (Intent.ACTION_SEND.equals(intent.getAction()) || openQuickAdd) {
            editor.remove("pending_share_url").remove("pending_open_quick_add");
        }
        if (url != null) editor.putString("pending_share_url", url);
        if (openQuickAdd) editor.putBoolean("pending_open_quick_add", true);
        editor.apply();
    }

    private void dispatchIncomingIntent(Intent intent) {
        if (intent == null || getBridge() == null || getBridge().getWebView() == null) return;
        String url = VideoBubbleIntents.extractSharedUrl(intent);
        boolean openQuickAdd = intent.getBooleanExtra(VideoBubbleIntents.EXTRA_OPEN_QUICK_ADD, false);
        String detail = "{url:" + JSONObject.quote(url == null ? "" : url)
            + ",openQuickAdd:" + (openQuickAdd ? "true" : "false") + "}";
        String script = "window.dispatchEvent(new CustomEvent('appointment-video-share',{detail:" + detail + "}));";
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(script, null));
    }
}
