package com.planning.oran;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

public class VideoBubbleService extends Service {
    private static final String CHANNEL_ID = "appointment_video_bubble";
    private static final int NOTIFICATION_ID = 7402;
    private WindowManager windowManager;
    private View bubble;
    private WindowManager.LayoutParams params;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startBubbleForeground();
        showBubble();
        getSharedPreferences("appointment_video_bubble", MODE_PRIVATE)
            .edit().putBoolean("bubble_enabled", true).apply();
    }

    private void startBubbleForeground() {
        Intent open = new Intent(this, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        open.putExtra(VideoBubbleIntents.EXTRA_OPEN_QUICK_ADD, true);
        PendingIntent pending = PendingIntent.getActivity(this, 7402, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID) : new Notification.Builder(this);
        Notification notification = builder
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle("Appointment · HackTube")
            .setContentText("La bulle d’ajout rapide est active.")
            .setContentIntent(pending)
            .setOngoing(true)
            .build();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID,
                "Bulle HackTube", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Maintient active la bulle flottante HackTube.");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private void showBubble() {
        if (Build.VERSION.SDK_INT >= 23 && !android.provider.Settings.canDrawOverlays(this)) {
            stopSelf();
            return;
        }
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        TextView view = new TextView(this);
        view.setText("▶");
        view.setTextColor(0xFFFFFFFF);
        view.setTextSize(22);
        view.setGravity(Gravity.CENTER);
        GradientDrawable background = new GradientDrawable();
        background.setShape(GradientDrawable.OVAL);
        background.setColor(0xFF059669);
        background.setStroke(dp(2), 0xFFFFFFFF);
        view.setBackground(background);
        view.setElevation(dp(8));
        params = new WindowManager.LayoutParams(dp(58), dp(58),
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = dp(12);
        params.y = dp(180);
        view.setOnTouchListener(new View.OnTouchListener() {
            private float downX, downY;
            private int startX, startY;
            private boolean dragged;
            @Override public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        downX = event.getRawX(); downY = event.getRawY();
                        startX = params.x; startY = params.y; dragged = false;
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        float dx = event.getRawX() - downX;
                        float dy = event.getRawY() - downY;
                        if (Math.abs(dx) > dp(5) || Math.abs(dy) > dp(5)) dragged = true;
                        params.x = startX + (int) dx; params.y = startY + (int) dy;
                        try { windowManager.updateViewLayout(bubble, params); } catch (Exception ignored) {}
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (!dragged) openAppointment();
                        return true;
                    default: return true;
                }
            }
        });
        bubble = view;
        try { windowManager.addView(bubble, params); } catch (Exception error) { stopSelf(); }
    }

    private void openAppointment() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra(VideoBubbleIntents.EXTRA_OPEN_QUICK_ADD, true);
        startActivity(intent);
    }

    private int dp(int value) { return (int) (value * getResources().getDisplayMetrics().density + 0.5f); }

    @Override public int onStartCommand(Intent intent, int flags, int startId) { return START_STICKY; }

    @Override public void onDestroy() {
        if (bubble != null && windowManager != null) {
            try { windowManager.removeView(bubble); } catch (Exception ignored) {}
            bubble = null;
        }
        getSharedPreferences("appointment_video_bubble", MODE_PRIVATE)
            .edit().putBoolean("bubble_enabled", false).apply();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
