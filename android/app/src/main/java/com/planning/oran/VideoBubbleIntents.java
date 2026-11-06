package com.planning.oran;

import android.content.Intent;
import android.net.Uri;
import android.text.TextUtils;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class VideoBubbleIntents {
    static final String EXTRA_OPEN_QUICK_ADD = "appointment_open_hacktube_quick_add";
    private static final Pattern URL_PATTERN = Pattern.compile("https?://[^\\s<>\\\"']+", Pattern.CASE_INSENSITIVE);

    private VideoBubbleIntents() {}

    static String extractSharedUrl(Intent intent) {
        if (intent == null) return null;
        String candidate = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (TextUtils.isEmpty(candidate) && intent.getData() != null) {
            candidate = intent.getData().toString();
        }
        if (TextUtils.isEmpty(candidate) && intent.getClipData() != null && intent.getClipData().getItemCount() > 0) {
            CharSequence text = intent.getClipData().getItemAt(0).getText();
            if (text != null) candidate = text.toString();
        }
        if (TextUtils.isEmpty(candidate)) return null;
        Matcher matcher = URL_PATTERN.matcher(candidate);
        if (matcher.find()) {
            String url = matcher.group();
            while (url.endsWith(".") || url.endsWith(",") || url.endsWith(")") || url.endsWith("]")) {
                url = url.substring(0, url.length() - 1);
            }
            Uri parsed = Uri.parse(url);
            String host = parsed.getHost();
            if (host == null) return null;
            host = host.toLowerCase();
            if (host.equals("youtu.be") || host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")
                || host.equals("tiktok.com") || host.endsWith(".tiktok.com")) return url;
        }
        return null;
    }
}
